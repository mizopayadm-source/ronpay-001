import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  QrCode, 
  PlusCircle, 
  Building2, 
  Wallet, 
  TrendingUp, 
  Ribbon, 
  HandHeart, 
  AlertTriangle, 
  Infinity as InfinityIcon, 
  Camera, 
  ChevronRight,
  Smartphone,
  Zap,
  Tv,
  Car,
  Flame,
  Droplet,
  Wifi,
  CreditCard,
  Search,
  EyeOff,
  Lock,
  LogIn,
  UserCheck,
  ShieldCheck,
  Sparkles,
  Layers,
  MapPin,
  Landmark,
  Ticket,
  History,
  Share2,
  CheckCircle2,
  Info,
  ChevronLeft,
  ExternalLink,
  ArrowRight,
  Pause,
  Play,
  Users,
  Globe,
  Activity,
  X,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  Receipt,
  Database,
  Copy,
  Check,
  Navigation,
  RefreshCw,
  Compass
} from 'lucide-react';
import { BawmCategory, Campaign, Transaction, BillService, CreatorProfile, AnnouncementBanner, AnnouncementItem, PublicPoolStats } from '../types';
import { AnnouncementBannerCard } from './AnnouncementBannerCard';
import { GuestReengagementBanner } from './GuestReengagementBanner';
import { CampaignTransferModal } from './CampaignTransferModal';
import { SupabaseSyncModal } from './SupabaseSyncModal';
import { usePublicPoolStats } from '../hooks/usePublicPoolStats';
import { calculateHaversineKm, getCampaignCoordinates, formatDistance } from '../utils/geoUtils';

import { BILL_SERVICES, BCM_EBENEZER_DEFAULT_LOGO, BMP_SHILLONG_DEFAULT_LOGO } from '../data/initialData';
import { formatDateDDMMYYYY, getCreatorExpiryStatus, isCampaignExpired } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText, getCampaignListTitle } from '../utils/translations';
import { isCampaignCreator, isConfirmedTransaction, isTransactionForCampaign, getDeletedTransactionIds, DEFAULT_ANNOUNCEMENT_ITEMS, getActiveAuditorGrantsForUser, getMembers, getStoredExpenses } from '../utils/storage';
import { fetchTableData } from '../services/SupabaseSync';
import { canManageCampaignExpenses } from '../utils/rbac';
import { Megaphone, X as CloseIcon, PieChart, BarChart3, CheckSquare, ArrowUpRight, ArrowDownRight, FileSpreadsheet } from 'lucide-react';

interface HomeScreenProps {
  onStartScanner: (category?: BawmCategory | 'any') => void;
  onCreateQRClick: () => void;
  onSelectBawm: (category: BawmCategory) => void;
  onOpenBillService: (service: BillService) => void;
  campaigns: Campaign[];
  transactions: Transaction[];
  userPaidIds?: string[];
  creatorProfile: CreatorProfile;
  announcement?: AnnouncementBanner;
  onOpenReports: () => void;
  onOpenMemberRoll?: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports' | 'expenses', campaignId?: string) => void;
  onShowBalance: () => void;
  onShowBankTransfer: () => void;
  onOpenPhonePePortal?: () => void;
  onOpenPhonePeCheckout?: (amount?: number) => void;
  onSelectCampaign?: (campaign: Campaign) => void;
  language?: Language;
  onOpenHistory?: () => void;
  onShareCampaign?: (campaign: Campaign) => void;
  onOpenAIHriatpui?: () => void;
  onOpenLogin?: () => void;
  onOpenMemberships?: () => void;
  onOpenAdminDashboard?: () => void;
  onOpenSyncDiagnostic?: () => void;
  onOpenWebsite?: () => void;
  onPreviewImage?: (url: string, title?: string) => void;
  publicPoolStats?: PublicPoolStats;
  onOpenAuditorPortal?: (campaign?: Campaign) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartScanner,
  onCreateQRClick,
  onSelectBawm,
  onOpenBillService,
  campaigns = [],
  transactions: propTransactions = [],
  creatorProfile,
  announcement,
  publicPoolStats,
  onOpenReports,
  onOpenMemberRoll,
  onShowBalance,
  onShowBankTransfer,
  onOpenPhonePePortal,
  onOpenPhonePeCheckout,
  onSelectCampaign,
  language = 'mizo',
  onOpenHistory,
  onShareCampaign,
  onOpenAIHriatpui,
  onOpenLogin,
  onOpenMemberships,
  onOpenAdminDashboard,
  onOpenSyncDiagnostic,
  onOpenWebsite,
  onOpenAuditorPortal,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>(propTransactions);
  const [campaignsList, setCampaigns] = useState<Campaign[]>(campaigns);
  const t = TRANSLATIONS[language] || TRANSLATIONS.mizo;
  const [transferCampaign, setTransferCampaign] = useState<Campaign | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isSyncBannerDismissed, setIsSyncBannerDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ronpay_hide_sync_diagnostic_banner') === 'true';
    } catch {
      return false;
    }
  });

  const handleActionLink = (url?: string) => {
    if (url) window.open(url, '_blank');
  };

  // Safe fallback to props or fetched DB campaigns
  const safeCampaigns = useMemo(() => {
    if (Array.isArray(campaigns) && campaigns.length > 0) return campaigns;
    if (Array.isArray(campaignsList) && campaignsList.length > 0) return campaignsList;
    return [];
  }, [campaigns, campaignsList]);

  const safeTransactions = useMemo(() => {
    if (Array.isArray(propTransactions) && propTransactions.length > 0) return propTransactions.filter(Boolean);
    if (Array.isArray(transactions) && transactions.length > 0) return transactions.filter(Boolean);
    return [];
  }, [propTransactions, transactions]);

  // Ground truth confirmed transactions from safeTransactions (matches ReportsScreen 100%)
  const confirmedTxns = useMemo(() => {
    return safeTransactions.filter(t => t && isConfirmedTransaction(t) && Number(t.amount) > 0);
  }, [safeTransactions]);

  const ledgerTotalAmount = useMemo(() => {
    return Math.round(confirmedTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) * 100) / 100;
  }, [confirmedTxns]);

  const ledgerTotalCount = confirmedTxns.length;

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const ledgerTodayCount = useMemo(() => {
    return confirmedTxns.filter(t => {
      const d = (t.timestamp || t.createdAt || t.date || '').slice(0, 10);
      return d === todayStr;
    }).length;
  }, [confirmedTxns, todayStr]);

  const { stats: hookStats } = usePublicPoolStats();

  const poolStats = useMemo(() => {
    // If local confirmed transactions exist, use the exact ledger totals as authoritative truth
    if (ledgerTotalCount > 0) {
      return {
        totalAmount: ledgerTotalAmount,
        totalCount: ledgerTotalCount,
        todayCount: ledgerTodayCount,
      };
    }

    // Otherwise, fallback to live hookStats from Supabase
    return {
      totalAmount: Math.max(0, hookStats?.totalAmount || 0),
      totalCount: Math.max(0, hookStats?.totalCount || 0),
      todayCount: Math.max(0, hookStats?.todayCount || 0),
    };
  }, [hookStats, ledgerTotalAmount, ledgerTotalCount, ledgerTodayCount]);

  const totalRaised = poolStats.totalAmount;
  const totalTxnsCount = poolStats.totalCount;
  const todayTxnsCount = poolStats.todayCount;

  const [isDataInitialized, setIsDataInitialized] = useState(false);

  useEffect(() => {
    if (campaigns && campaigns.length > 0) {
      setIsDataInitialized(true);
    }
  }, [campaigns]);



  const renderBillIcon = (iconName: string) => {
    switch (iconName) {
      case 'Smartphone': return <Smartphone className="w-5 h-5 text-indigo-600" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-600" />;
      case 'Tv': return <Tv className="w-5 h-5 text-purple-600" />;
      case 'Car': return <Car className="w-5 h-5 text-orange-600" />;
      case 'Flame': return <Flame className="w-5 h-5 text-red-600" />;
      case 'Droplet': return <Droplet className="w-5 h-5 text-cyan-600" />;
      case 'Landmark': return <Landmark className="w-5 h-5 text-emerald-700" />;
      case 'Ticket': return <Ticket className="w-5 h-5 text-rose-600" />;
      case 'Wifi': return <Wifi className="w-5 h-5 text-teal-600" />;
      case 'CreditCard': return <CreditCard className="w-5 h-5 text-slate-700" />;
      default: return <Smartphone className="w-5 h-5 text-indigo-600" />;
    }
  };

  // Search and filter state for Existing QRs
  const [qrSearchQuery, setQrSearchQuery] = useState('');
  const [qrCategoryFilter, setQrCategoryFilter] = useState<string>('all');
  const [showAllQRs, setShowAllQRs] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  // Global Find Bawm / Campaign search query
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Check if current session is a Guest User (non-logged-in explorer or guest role)
  const isGuestUser = useMemo(() => {
    if (!creatorProfile) return true;
    if (!creatorProfile.phone || creatorProfile.phone.trim() === '') return true;
    if (creatorProfile.role === 'GUEST') return true;
    if (creatorProfile.name === 'Khualmi (Guest User)' || (creatorProfile.name && creatorProfile.name.toLowerCase().includes('guest'))) return true;
    return false;
  }, [creatorProfile]);

  // Check if current user is an authenticated and authorized Administrator
  const isAuthorizedAdmin = useMemo(() => {
    if (isGuestUser) return false;
    const role = creatorProfile?.role;
    const isAdminRole = role === 'SUPER_ADMIN' || role === 'ADMIN';
    const isAdminFlag = creatorProfile?.isAdmin === true || creatorProfile?.phone === '9862000001';
    return Boolean(isAdminRole || isAdminFlag);
  }, [isGuestUser, creatorProfile]);

  // Dual-Mode Workspace: 'hybrid' (Personal + Org) vs 'org_only' (Dedicated Organization / Accountant View)
  const isAccountantOrOrgOnlyProfile = useMemo(() => {
    if (!creatorProfile || isGuestUser) return false;
    if (creatorProfile.workspaceMode === 'org_only') return true;
    const desig = `${creatorProfile.designation || ''} ${creatorProfile.role || ''}`.toLowerCase();
    if (desig.includes('accountant') || desig.includes('auditor')) return true;
    return false;
  }, [creatorProfile, isGuestUser]);

  const [workspaceViewMode, setWorkspaceViewMode] = useState<'hybrid' | 'org_only'>(() => {
    try {
      const saved = localStorage.getItem('ronpay_home_workspace_mode');
      if (saved === 'org_only' || saved === 'hybrid') return saved;
    } catch {}
    return 'hybrid';
  });

  useEffect(() => {
    if (creatorProfile?.workspaceMode === 'org_only' || isAccountantOrOrgOnlyProfile) {
      setWorkspaceViewMode('org_only');
    } else if (creatorProfile?.workspaceMode === 'hybrid') {
      try {
        const saved = localStorage.getItem('ronpay_home_workspace_mode');
        if (!saved) setWorkspaceViewMode('hybrid');
      } catch {}
    }
  }, [creatorProfile?.workspaceMode, creatorProfile?.phone, isAccountantOrOrgOnlyProfile]);

  const toggleWorkspaceViewMode = (nextMode: 'hybrid' | 'org_only') => {
    setWorkspaceViewMode(nextMode);
    try {
      localStorage.setItem('ronpay_home_workspace_mode', nextMode);
    } catch {}
  };

  const [selectedOrgCampaignId, setSelectedOrgCampaignId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ronpay_selected_org_campaign_id');
      if (saved) return saved;
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const orgParam = params.get('org') || params.get('c') || params.get('campaign') || params.get('bawm');
        if (orgParam) return orgParam;
      }
    } catch {}
    return '';
  });

  const handleSelectOrgCampaign = (id: string) => {
    setSelectedOrgCampaignId(id);
    try {
      localStorage.setItem('ronpay_selected_org_campaign_id', id);
    } catch {}
  };

  // Organization Campaigns available for the Dedicated Organization Dashboard (Strict zero-leakage scope)
  const availableOrgCampaigns = useMemo(() => {
    const kumtluangList = campaignsList.filter(c => c && !c.isVoided && c.category === 'kumtluang');

    // 1. Super Admin sees all kumtluang campaigns
    if (isAuthorizedAdmin) {
      return kumtluangList.length > 0 ? kumtluangList : campaignsList.filter(c => c && !c.isVoided);
    }

    // 2. Authenticated Creator / Officer / Auditor: strictly limited to authorized campaigns
    if (!isGuestUser && creatorProfile?.phone) {
      const phone = creatorProfile.phone;
      const grants = getActiveAuditorGrantsForUser(phone);
      const grantCampIds = new Set(grants.map(g => String(g.campaignId || g.campaign_id || '').trim()));

      const authorized = kumtluangList.filter(
        c => isCampaignCreator(c, creatorProfile) || 
             canManageCampaignExpenses(c, creatorProfile) || 
             grantCampIds.has(String(c.id).trim())
      );
      if (authorized.length > 0) return authorized;
    }

    // 3. Guest / General Member: Strictly isolate to the selected or requested organization only
    if (selectedOrgCampaignId) {
      const matched = kumtluangList.filter(c => c.id === selectedOrgCampaignId || c.orgCode?.toUpperCase() === selectedOrgCampaignId.toUpperCase());
      if (matched.length > 0) return matched;
    }

    // Default: strictly single active campaign (e.g. BCM Ebenezer or first available), never the full list of all orgs
    const defaultCamp = kumtluangList.find(c => c.id === 'cmp-kumtluang-1') || kumtluangList[0];
    return defaultCamp ? [defaultCamp] : [];
  }, [campaignsList, isGuestUser, isAuthorizedAdmin, creatorProfile, selectedOrgCampaignId]);

  const activeOrgCampaign = useMemo(() => {
    if (selectedOrgCampaignId) {
      const found = availableOrgCampaigns.find(c => c.id === selectedOrgCampaignId || c.orgCode?.toUpperCase() === selectedOrgCampaignId.toUpperCase());
      if (found) return found;
    }
    if (!isGuestUser && creatorProfile?.phone) {
      const owned = availableOrgCampaigns.find(c => isCampaignCreator(c, creatorProfile));
      if (owned) return owned;
    }
    return availableOrgCampaigns.find(c => c.id === 'cmp-kumtluang-1') || availableOrgCampaigns[0] || null;
  }, [selectedOrgCampaignId, availableOrgCampaigns, isGuestUser, creatorProfile]);

  // Authorization check for active organization financial reports & administrative controls
  const isAuthorizedForOrg = useMemo(() => {
    if (!activeOrgCampaign) return false;
    if (isAuthorizedAdmin) return true;
    if (isGuestUser || !creatorProfile?.phone) return false;

    // Creator / Owner of this campaign
    if (isCampaignCreator(activeOrgCampaign, creatorProfile)) return true;

    // Authorized Officer / Treasurer / Expense Manager
    if (canManageCampaignExpenses(activeOrgCampaign, creatorProfile)) return true;

    // Active Assigned Auditor for this campaign
    const phone = creatorProfile.phone;
    const grants = getActiveAuditorGrantsForUser(phone);
    const hasAuditGrant = grants.some(
      g => String(g.campaignId || g.campaign_id || '').trim() === String(activeOrgCampaign.id).trim()
    );
    if (hasAuditGrant) return true;

    return false;
  }, [activeOrgCampaign, isAuthorizedAdmin, isGuestUser, creatorProfile]);

  // Comprehensive Statistics & Reports for the Active Organization Dashboard
  const orgDashboardStats = useMemo(() => {
    if (!activeOrgCampaign) return null;
    const deletedIds = new Set(getDeletedTransactionIds());
    const validTxns = transactions.filter(tx => {
      if (!tx || deletedIds.has(tx.id)) return false;
      if (!isConfirmedTransaction(tx)) return false;
      return isTransactionForCampaign(tx, activeOrgCampaign);
    });

    const totalCollections = validTxns.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxns = validTxns.filter(tx => String(tx.date || '').slice(0, 10) === todayStr);
    const todayTotal = todayTxns.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    // Members / Church Units in Roll
    const allMembers = getMembers();
    const orgPrefix = (activeOrgCampaign.orgCode || '').toUpperCase();
    const orgMembers = allMembers.filter(m => {
      if (m.campaignId === activeOrgCampaign.id) return true;
      if (orgPrefix && m.id && m.id.toUpperCase().startsWith(orgPrefix + '-')) return true;
      return false;
    });

    const activeRollMembers = orgMembers.filter(m => !m.isDeactivated);
    const uniqueSections = new Set(activeRollMembers.map(m => m.section).filter(Boolean));
    const uniqueAbcs = new Set(activeRollMembers.map(m => m.abcName).filter(Boolean));

    // Calculate Target (Campaign targetAmount or sum of member/church targets)
    const memberPledgeSum = activeRollMembers.reduce((sum, m) => sum + (Number(m.pledgeAmount) || 0), 0);
    const activeTarget = Number(activeOrgCampaign.targetAmount) > 0
      ? Number(activeOrgCampaign.targetAmount)
      : memberPledgeSum;
    const targetProgressPct = activeTarget > 0
      ? Math.min(100, Math.round((totalCollections / activeTarget) * 100))
      : 100;
    const targetRemaining = Math.max(0, activeTarget - totalCollections);

    // Expenses (Hmanral)
    const allExpenses = getStoredExpenses();
    const orgExpenses = allExpenses.filter(
      e => e.status !== 'rejected' && (e.campaignId === activeOrgCampaign.id || (!e.campaignId && activeOrgCampaign.id === 'cmp-kumtluang-1'))
    );
    const totalExpenses = orgExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netBalance = totalCollections - totalExpenses;

    // Category Breakdown (for Collection Progress Donut Chart)
    const enabledCats = Array.isArray(activeOrgCampaign.enabledCategories) && activeOrgCampaign.enabledCategories.length > 0
      ? activeOrgCampaign.enabledCategories
      : (Array.isArray(activeOrgCampaign.subCategories) && activeOrgCampaign.subCategories.length > 0
          ? activeOrgCampaign.subCategories
          : ['Pathian Ram', 'Ramthar', 'Tualchhung', 'Building', 'Thawhlawm']);

    const catTotalsMap: Record<string, number> = {};
    enabledCats.forEach(c => { catTotalsMap[c] = 0; });

    validTxns.forEach(tx => {
      const allocs = tx.subCategoryBreakdown;
      if (allocs && typeof allocs === 'object' && Object.keys(allocs).length > 0) {
        Object.entries(allocs).forEach(([k, val]) => {
          const amt = Number(val) || 0;
          if (amt > 0) {
            catTotalsMap[k] = (catTotalsMap[k] || 0) + amt;
          }
        });
      } else {
        const sub = tx.subCategory || enabledCats[0] || 'General Collection';
        catTotalsMap[sub] = (catTotalsMap[sub] || 0) + (Number(tx.amount) || 0);
      }
    });

    const palette = ['#4f46e5', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#8b5cf6', '#ef4444'];
    const categoryBreakdown = Object.entries(catTotalsMap)
      .map(([name, amount], idx) => ({
        name,
        amount,
        pct: totalCollections > 0 ? Math.round((amount / totalCollections) * 100) : 0,
        color: palette[idx % palette.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    // Monthly Revenue (Last 6 Months Bar Chart)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthlySeries: { label: string; key: string; revenue: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlySeries.push({
        label: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`,
        key: ym,
        revenue: 0,
        expense: 0,
      });
    }
    validTxns.forEach(tx => {
      const ym = String(tx.date || tx.timestamp || '').slice(0, 7);
      const slot = monthlySeries.find(m => m.key === ym);
      if (slot) slot.revenue += Number(tx.amount) || 0;
    });
    orgExpenses.forEach(ex => {
      const ym = String(ex.date || ex.spentDate || '').slice(0, 7);
      const slot = monthlySeries.find(m => m.key === ym);
      if (slot) slot.expense += Number(ex.amount) || 0;
    });
    const maxMonthlyVal = Math.max(1000, ...monthlySeries.map(m => Math.max(m.revenue, m.expense)));

    // Combined Recent Transactions (Received) & Expenses (Paid) for Bottom Table
    const combinedLedger = [
      ...validTxns.map(tx => {
        const allocs = tx.subCategoryBreakdown;
        return {
          id: tx.id,
          date: tx.date || tx.timestamp || '',
          partyName: tx.donorName || 'Member / Contributor',
          memberCode: tx.memberId || '-',
          category: allocs && typeof allocs === 'object' && Object.keys(allocs).length > 0
            ? Object.entries(allocs).filter(([, v]) => Number(v) > 0).map(([k]) => k).join(', ')
            : (tx.subCategory || 'Collection'),
          amount: Number(tx.amount) || 0,
          type: 'Received' as const,
          reference: tx.utr || tx.transactionId || tx.id.slice(-8).toUpperCase(),
        };
      }),
      ...orgExpenses.map(ex => ({
        id: ex.id,
        date: ex.date || ex.spentDate || '',
        partyName: ex.paidTo || ex.purpose || 'Organization Expense',
        memberCode: ex.voucherNo || 'VOUCHER',
        category: ex.head || ex.expenseHead || 'Hmanral / Expense',
        amount: Number(ex.amount) || 0,
        type: 'Paid' as const,
        reference: ex.voucherNo || ex.id.slice(-8).toUpperCase(),
      })),
    ].sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    return {
      totalCollections,
      todayTotal,
      todayCount: todayTxns.length,
      txnCount: validTxns.length,
      activeTarget,
      targetProgressPct,
      targetRemaining,
      memberCount: activeRollMembers.length,
      sectionCount: uniqueSections.size,
      abcCount: uniqueAbcs.size,
      totalExpenses,
      expenseCount: orgExpenses.length,
      netBalance,
      categoryBreakdown,
      enabledCats,
      monthlySeries,
      maxMonthlyVal,
      recentLedger: combinedLedger.slice(0, 12),
    };
  }, [activeOrgCampaign, transactions]);

  // Check if a campaign is active (not expired, voided, completed, cancelled, or archived)
  const isCampaignActive = (c: Campaign): boolean => {
    if (!c) return false;
    if (c.isVoided) return false;
    if (c.status === 'expired' || c.status === 'cancelled' || c.status === 'archived' || c.status === 'rejected') {
      return false;
    }
    if (c.status === 'pending_approval') {
      const isOwner = isCampaignCreator(c, creatorProfile);
      if (!isAuthorizedAdmin && !isOwner && !c.isApproved) {
        return false;
      }
    }
    const effDate = c.validityDate || c.expiry_date || c.valid_until || (c as any).validity_date || (c as any).metadata?.validityDate || (c as any).metadata?.expiry_date || (c as any).metadata?.valid_until;
    if (isCampaignExpired(effDate, c.status, c.category, c.createdAt)) {
      return false;
    }
    return c.status === 'active' || c.status === 'pending_approval' || !c.status;
  };

  // GPS Location-Based Sorting States
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    try {
      const savedLat = localStorage.getItem('kut_app_user_lat');
      const savedLng = localStorage.getItem('kut_app_user_lng');
      if (savedLat && savedLng) {
        const lat = parseFloat(savedLat);
        const lng = parseFloat(savedLng);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
      }
    } catch {}
    return null;
  });

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'detecting' | 'active' | 'denied' | 'unavailable'>(() => {
    try {
      if (localStorage.getItem('kut_app_gps_verified') === 'true' && localStorage.getItem('kut_app_user_lat')) {
        return 'active';
      }
    } catch {}
    return 'idle';
  });

  // Sort mode: 'gps' (closest first) vs 'newest' (recently created first)
  const [sortMode, setSortMode] = useState<'gps' | 'newest'>('gps');

  // Trigger browser/device GPS permission request and detection
  const requestUserGPS = useCallback((interactive: boolean = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }

    setGpsStatus('detecting');

    const handleSuccess = (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setUserCoords({ lat, lng });
      setGpsStatus('active');
      setSortMode('gps');
      try {
        localStorage.setItem('kut_app_user_lat', String(lat));
        localStorage.setItem('kut_app_user_lng', String(lng));
        localStorage.setItem('kut_app_gps_verified', 'true');
      } catch {}
    };

    const handleError = (err: GeolocationPositionError) => {
      // If high accuracy failed, attempt fallback to low accuracy
      if (err.code !== err.PERMISSION_DENIED) {
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err2) => {
            if (err2.code === err2.PERMISSION_DENIED) {
              setGpsStatus('denied');
            } else {
              setGpsStatus('unavailable');
            }
          },
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
        );
        return;
      }
      setGpsStatus('denied');
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  }, []);

  // Initialize or sync GPS location on mount
  useEffect(() => {
    if (!userCoords) {
      requestUserGPS(false);
    }

    // Listen to location updates dispatched from Header
    const handleLocationUpdated = (e: any) => {
      if (e?.detail?.lat && e?.detail?.lng) {
        setUserCoords({ lat: e.detail.lat, lng: e.detail.lng });
        setGpsStatus('active');
      }
    };

    window.addEventListener('kut_app_location_updated', handleLocationUpdated);
    return () => {
      window.removeEventListener('kut_app_location_updated', handleLocationUpdated);
    };
  }, [requestUserGPS, userCoords]);

  // Memoized distance lookup (in km) from current user position to each campaign
  const campaignDistances = useMemo(() => {
    const map = new Map<string, number>();
    if (!userCoords) return map;

    for (const c of safeCampaigns) {
      const coords = getCampaignCoordinates(c);
      if (coords) {
        const distKm = calculateHaversineKm(userCoords.lat, userCoords.lng, coords.lat, coords.lng);
        map.set(c.id, Math.round(distKm * 100) / 100);
      }
    }
    return map;
  }, [safeCampaigns, userCoords]);

  // Active QRs sorted based on user choice:
  // 1. If sortMode === 'gps' and GPS coordinates are available:
  //    Sort by distance (closest to farthest, Nearest to Farthest).
  // 2. Fallback (if user denies GPS, location unavailable, or sortMode === 'newest'):
  //    Sort by newest/recently created Active QRs.
  //    Hidden QRs are automatically excluded from default active lists and public services!
  const activeSortedQRs = useMemo(() => {
    const active = safeCampaigns.filter(c => isCampaignActive(c) && !c.isHidden);
    const isGpsActive = sortMode === 'gps' && userCoords !== null;

    return [...active].sort((a, b) => {
      if (isGpsActive) {
        const distA = campaignDistances.get(a.id);
        const distB = campaignDistances.get(b.id);

        const hasDistA = typeof distA === 'number';
        const hasDistB = typeof distB === 'number';

        if (hasDistA && hasDistB) {
          if (Math.abs(distA - distB) > 0.05) {
            return distA - distB; // Closest first!
          }
        } else if (hasDistA && !hasDistB) {
          return -1; // Has distance info comes first
        } else if (!hasDistA && hasDistB) {
          return 1;
        }
      }

      // Default Fallback: newest created first
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [safeCampaigns, sortMode, userCoords, campaignDistances]);

  const activeQRsCount = useMemo(() => {
    return isDataInitialized ? activeSortedQRs.length : 0;
  }, [isDataInitialized, activeSortedQRs]);

  // Global search across all active campaigns (including unlisted/hidden campaigns via Prefix code like "EBE" or name)
  const globalSearchResults = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return safeCampaigns.filter(c => {
      if (!isCampaignActive(c)) return false;
      const matchTitle = (c.title || '').toLowerCase().includes(q);
      const matchOrg = (c.orgName || '').toLowerCase().includes(q);
      const matchCode = (c.orgCode || '').toLowerCase().includes(q);
      const matchId = (c.id || '').toLowerCase().includes(q);
      const matchLoc = (c.location || '').toLowerCase().includes(q);
      const matchMitthi = (c.mitthiHming || '').toLowerCase().includes(q);
      const matchCause = (c.cause || '').toLowerCase().includes(q) || (c.causeMizo || '').toLowerCase().includes(q) || (c.causeEn || '').toLowerCase().includes(q);
      const matchCat = (c.category || '').toLowerCase().includes(q);
      return matchTitle || matchOrg || matchCode || matchId || matchLoc || matchMitthi || matchCause || matchCat;
    });
  }, [safeCampaigns, globalSearchQuery]);

  // Filtered QRs based on search keyword and category filter
  // If search query is typed, search across all active campaigns (including unlisted/hidden QRs)
  const filteredQRs = useMemo(() => {
    const query = qrSearchQuery.trim().toLowerCase();
    let list = query 
      ? safeCampaigns.filter(isCampaignActive) 
      : activeSortedQRs;

    if (qrCategoryFilter !== 'all') {
      list = list.filter(c => c.category === qrCategoryFilter);
    }

    if (query) {
      list = list.filter(c => {
        const matchTitle = (c.title || '').toLowerCase().includes(query);
        const matchLoc = (c.location || '').toLowerCase().includes(query);
        const matchUpi = (c.upiId || '').toLowerCase().includes(query);
        const matchDesc = (c.description || '').toLowerCase().includes(query);
        const matchCause = (c.cause || '').toLowerCase().includes(query) || (c.causeMizo || '').toLowerCase().includes(query) || (c.causeEn || '').toLowerCase().includes(query);
        const matchCode = (c.orgCode || '').toLowerCase().includes(query);
        const matchMitthi = (c.mitthiHming || '').toLowerCase().includes(query);
        const matchCat = (c.category || '').toLowerCase().includes(query);
        const matchId = (c.id || '').toLowerCase().includes(query);
        return matchTitle || matchLoc || matchUpi || matchDesc || matchCause || matchCode || matchMitthi || matchCat || matchId;
      });
    }

    return list;
  }, [activeSortedQRs, safeCampaigns, qrSearchQuery, qrCategoryFilter]);

  // Displayed QRs (Strictly Latest 5 on first page; expands on search, category filter, or showAllQRs toggle)
  const displayedQRs = useMemo(() => {
    if (qrSearchQuery.trim() || qrCategoryFilter !== 'all' || showAllQRs) {
      return filteredQRs;
    }
    return activeSortedQRs.slice(0, 5);
  }, [filteredQRs, activeSortedQRs, qrSearchQuery, qrCategoryFilter, showAllQRs]);

  return (
    <div className="space-y-4 pb-1 animate-fadeIn">
      {/* Browser Re-engagement & Retargeting Banner for Guest Users */}
      <GuestReengagementBanner
        creatorProfile={creatorProfile}
        campaigns={campaigns}
        onOpenReceipts={onOpenHistory || (() => {})}
        onOpenRegister={onCreateQRClick}
        onSelectCampaign={onSelectCampaign}
        language={language}
      />

      {/* Admin Custom Live Rotating Announcement Banner with Canva & Media support */}
      {announcement && announcement.isActive && (
        <AnnouncementBannerCard
          announcement={announcement}
          onActionLink={handleActionLink}
        />
      )}

      {/* 0. No App Download Required Notice */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 p-2.5 sm:p-3 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-[11px] sm:text-xs text-emerald-950 font-bold leading-snug break-words">
            {language === 'mizo' 
              ? 'RonPay Apps download kher a ngai lo, web & UPI apps dang atangin a pek nghal mai theih e.' 
              : 'No app download required. Scan & pay directly with any UPI app on the web.'}
          </p>
        </div>
        <button
          type="button"
          id="web-ready-website-link"
          onClick={() => {
            if (onOpenWebsite) {
              onOpenWebsite();
            } else if (typeof window !== 'undefined') {
              window.open('https://ronpay.app', '_blank', 'noopener,noreferrer');
            }
          }}
          className="group inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[9.5px] sm:text-[10px] font-black rounded-full shrink-0 self-center shadow-xs hover:shadow-sm transition cursor-pointer active:scale-95 border border-emerald-500/40"
          title={language === 'mizo' ? 'RonPay Website tlawh rawh (ronpay.app)' : 'Visit RonPay Website (ronpay.app)'}
        >
          <Globe className="w-3 h-3 text-emerald-100 group-hover:rotate-12 transition-transform" />
          <span>WEB READY</span>
          <ExternalLink className="w-2.5 h-2.5 text-emerald-200" />
        </button>
      </div>

      {/* Smart Login & Active User Strip */}
      {onOpenLogin && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 rounded-2xl border border-indigo-800/60 shadow-xs flex flex-col @2xl:flex-row @2xl:items-center justify-between gap-2.5 overflow-hidden">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shadow-xs shrink-0 ${
              creatorProfile.isApproved && creatorProfile.phone
                ? 'bg-emerald-600/80 border border-emerald-400/40 text-emerald-100'
                : 'bg-indigo-600/80 border border-indigo-400/40 text-amber-300'
            }`}>
              {creatorProfile.isApproved && creatorProfile.phone ? (
                <UserCheck className="w-4 h-4 text-emerald-200" />
              ) : (
                <Lock className="w-4 h-4 text-amber-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-xs sm:text-sm text-white truncate max-w-full">
                  {creatorProfile.isApproved && creatorProfile.phone
                    ? creatorProfile.name
                    : (language === 'mizo' ? 'Creator & Member Login' : 'Creator & Member Login')}
                </span>
                <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.2 rounded-full border shrink-0 ${
                  creatorProfile.isApproved && creatorProfile.phone
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                }`}>
                  {creatorProfile.isApproved && creatorProfile.phone
                    ? (creatorProfile.role || 'CREATOR')
                    : 'GUEST'}
                </span>
              </div>
              <p className="text-[10px] text-slate-300 truncate mt-0.5">
                {creatorProfile.isApproved && creatorProfile.phone
                  ? `${creatorProfile.orgName || 'RonPay Registered'} • ${creatorProfile.phone}`
                  : (language === 'mizo' ? 'Luhna leh Account inthlakna (Phone & MPIN)' : 'Login & Switch Account (Phone & MPIN)')}
              </p>
            </div>
          </div>

          <div className={`w-full @2xl:w-auto grid ${onOpenMemberships && !isGuestUser ? 'grid-cols-3' : 'grid-cols-2'} @2xl:flex items-center gap-1.5 shrink-0 pt-2 @2xl:pt-0 border-t border-indigo-900/60 @2xl:border-t-0`}>
            {/* Workspace Mode Switcher: Personal + Org vs Dedicated Organization Dashboard */}
            <button
              type="button"
              id="home-workspace-mode-toggle-btn"
              onClick={() => toggleWorkspaceViewMode(workspaceViewMode === 'org_only' ? 'hybrid' : 'org_only')}
              className={`w-full @2xl:w-auto justify-center px-2 py-2 @2xl:px-2.5 @2xl:py-1.5 rounded-xl font-black text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 border whitespace-nowrap min-w-0 ${
                workspaceViewMode === 'org_only'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-300/60'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-indigo-200 border-indigo-400/40'
              }`}
              title="Switch between Personal + Org View and Dedicated Organization-Only Dashboard"
            >
              <Building2 className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                {workspaceViewMode === 'org_only'
                  ? '🏛️ Org-Only'
                  : '🌐 Mimal + Pawl'}
              </span>
            </button>

            {/* Strictly hidden in Guest Mode as requested */}
            {onOpenMemberships && !isGuestUser && (
              <button
                type="button"
                id="home-open-memberships-btn"
                onClick={onOpenMemberships}
                className="w-full @2xl:w-auto justify-center px-2 py-2 @2xl:px-2.5 @2xl:py-1.5 rounded-xl font-black text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow-sm bg-indigo-600/90 hover:bg-indigo-500 text-white border border-indigo-400/40 active:scale-95 whitespace-nowrap min-w-0"
                title="My Memberships & Multi-Group Context"
              >
                <Layers className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">Pawl & Bawmte</span>
              </button>
            )}

            <button
              type="button"
              id="home-open-login-btn"
              onClick={onOpenLogin}
              className={`w-full @2xl:w-auto justify-center px-2 py-2 @2xl:px-3 @2xl:py-1.5 rounded-xl font-black text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 whitespace-nowrap min-w-0 ${
                creatorProfile.isApproved && creatorProfile.phone
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              <LogIn className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{creatorProfile.isApproved && creatorProfile.phone ? 'Switch / Login' : (language === 'mizo' ? 'Lut Rawh' : 'Login')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Admin Sync Diagnostic - Strictly hidden from Guest Users */}
      {!isSyncBannerDismissed && !isGuestUser && isAuthorizedAdmin && onOpenSyncDiagnostic && (
        <div 
          onClick={onOpenSyncDiagnostic}
          className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-2.5 px-3.5 rounded-2xl border border-indigo-500/30 text-white flex items-center justify-between shadow-xs cursor-pointer hover:border-indigo-400 transition group active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/50 border border-indigo-400/30 text-amber-300 flex items-center justify-center font-bold shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-white">Admin Sync Diagnostic</span>
                <span className="text-[8.5px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded-full">
                  Live
                </span>
              </div>
              <p className="text-[10px] text-slate-300 truncate">
                Cross-device consistency & database health monitor
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            <div className="px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-500 text-white text-[11px] font-black rounded-xl shadow-2xs transition flex items-center gap-1.5">
              <span>Enfiah Rawh</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <button
              type="button"
              title="Dah bo / Dismiss (Hide from Home)"
              onClick={(e) => {
                e.stopPropagation();
                setIsSyncBannerDismissed(true);
                try {
                  localStorage.setItem('ronpay_hide_sync_diagnostic_banner', 'true');
                } catch {}
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Active Auditor Grant Access Banner */}
      {(creatorProfile?.role === 'AUDITOR' || (creatorProfile?.phone && getActiveAuditorGrantsForUser(creatorProfile.phone).length > 0)) && onOpenAuditorPortal && (
        <div 
          onClick={() => onOpenAuditorPortal()}
          className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 p-3 rounded-2xl border border-amber-400 text-slate-950 flex items-center justify-between shadow-md cursor-pointer hover:brightness-105 transition group active:scale-[0.99] animate-fadeIn"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center font-bold shadow-inner shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-xs sm:text-sm text-slate-950">
                  ⚖️ Online Sum Endiktu (Auditor Portal Active)
                </span>
                <span className="text-[9px] font-black uppercase bg-slate-950 text-amber-300 px-2 py-0.5 rounded-full border border-slate-900">
                  TIME-BOUND ACCESS
                </span>
              </div>
              <p className="text-[10.5px] text-slate-950/80 font-medium truncate mt-0.5">
                Bawm financial records audit, period lock, leh printable certificate siam rawh le
              </p>
            </div>
          </div>
          <div className="px-3.5 py-2 bg-slate-950 group-hover:bg-slate-900 text-amber-300 text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 ml-2">
            <span>Hawng Rawh</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      )}

      {/* DEDICATED ORGANIZATION-ONLY WORKSPACE (Role-Based: Public Landing vs Admin Financial Dashboard) */}
      {workspaceViewMode === 'org_only' && activeOrgCampaign && orgDashboardStats ? (
        isAuthorizedForOrg ? (
        <div className="bg-slate-50 rounded-3xl p-3 sm:p-5 border border-slate-200/90 shadow-xs space-y-4 animate-fadeIn">
          {/* Top Organization Workspace Header & Selector */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col gap-3.5">
            <div className="flex flex-col @xl:flex-row @xl:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-slate-900 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0 overflow-hidden border border-indigo-200">
                  {activeOrgCampaign.imageUrl ? (
                    <img
                      src={activeOrgCampaign.imageUrl}
                      alt={activeOrgCampaign.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-amber-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9.5px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md">
                      🏛️ Organization-Only Workspace
                    </span>
                    <span className="text-[9.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {activeOrgCampaign.rollStructureType === 'hqrs_hierarchy' ? 'HQRS / Bial / Kohhran Mode' : 'Member & Family Roll'}
                    </span>
                    {activeOrgCampaign.orgCode && (
                      <span className="text-[9.5px] font-black uppercase bg-slate-900 text-amber-300 px-2 py-0.5 rounded-md font-mono">
                        [{activeOrgCampaign.orgCode}]
                      </span>
                    )}
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 truncate mt-0.5">
                    {activeOrgCampaign.title}
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {activeOrgCampaign.subTitle || activeOrgCampaign.location || 'Dedicated Organization & Accountant Financial Dashboard (Ralna/Khawlsak/Rikrum Hidden)'}
                  </p>
                </div>
              </div>

              {/* Organization Switcher & Mode Switcher */}
              <div className="w-full @xl:w-auto flex flex-col @xl:items-end gap-2 shrink-0">
                {availableOrgCampaigns.length > 1 && (
                  <select
                    value={activeOrgCampaign.id}
                    onChange={(e) => handleSelectOrgCampaign(e.target.value)}
                    className="w-full @xl:w-64 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-2 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {availableOrgCampaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        🏛️ {c.title} {c.orgCode ? `[${c.orgCode}]` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <div className="grid grid-cols-2 @xl:flex items-center gap-1.5 w-full @xl:w-auto">
                  <button
                    type="button"
                    onClick={() => toggleWorkspaceViewMode('hybrid')}
                    className="w-full @xl:w-auto justify-center px-2.5 py-2 @xl:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-extrabold border border-slate-300 transition cursor-pointer flex items-center whitespace-nowrap"
                  >
                    🌐 Mimal + Pawl View
                  </button>
                  <button
                    type="button"
                    onClick={onCreateQRClick}
                    className="w-full @xl:w-auto justify-center px-2.5 py-2 @xl:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-extrabold shadow-2xs transition cursor-pointer flex items-center gap-1 whitespace-nowrap"
                  >
                    <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Bawm Thar / Config</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Enabled Categories Pill Strip & Quick Action Bar */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col @xl:flex-row @xl:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3 text-indigo-600" /> Active Categories:
                </span>
                {orgDashboardStats.enabledCats.map((cat) => (
                  <span
                    key={cat}
                    className="text-[10px] font-extrabold bg-indigo-50/90 text-indigo-800 border border-indigo-200/80 px-2 py-0.5 rounded-lg"
                  >
                    ✓ {cat}
                  </span>
                ))}
              </div>

              {onOpenMemberRoll && (
                <div className="grid grid-cols-2 @xl:flex items-center gap-2 w-full @xl:w-auto">
                  <button
                    type="button"
                    onClick={() => onOpenMemberRoll('quick_entry', activeOrgCampaign.id)}
                    className="w-full @xl:w-auto justify-center px-3 py-2 @xl:py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-2xs transition cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
                  >
                    <Zap className="w-3.5 h-3.5 shrink-0" />
                    <span>Quick Entry</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMemberRoll('register_member', activeOrgCampaign.id)}
                    className="w-full @xl:w-auto justify-center px-3 py-2 @xl:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black shadow-2xs transition cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {activeOrgCampaign.rollStructureType === 'hqrs_hierarchy'
                        ? '+ Bial / Kohhran'
                        : '+ Member Roll'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMemberRoll('expenses', activeOrgCampaign.id)}
                    className="w-full @xl:w-auto justify-center px-3 py-2 @xl:py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black shadow-2xs transition cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
                  >
                    <Receipt className="w-3.5 h-3.5 shrink-0" />
                    <span>Hmanral</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenMemberRoll('print_reports', activeOrgCampaign.id)}
                    className="w-full @xl:w-auto justify-center px-3 py-2 @xl:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black shadow-2xs transition cursor-pointer flex items-center gap-1 active:scale-95 whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span>Statements</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* TOP SECTION: 4 Beautiful Statistic Cards (2x2 on Mobile, 4-col on Desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            {/* Card 1: Total Collections */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                    Total Collections
                  </p>
                  <h3 className="text-base sm:text-2xl font-black text-slate-900 mt-1 tabular-nums truncate">
                    ₹{orgDashboardStats.totalCollections.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 w-fit">
                  <ArrowUpRight className="w-3 h-3 shrink-0" /> {orgDashboardStats.txnCount} Txns
                </span>
                <span className="text-slate-500 font-bold tabular-nums truncate">
                  Vawiin: ₹{orgDashboardStats.todayTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Card 2: Active Targets & Progress */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                    Active Targets
                  </p>
                  <h3 className="text-base sm:text-2xl font-black text-indigo-950 mt-1 tabular-nums truncate">
                    {orgDashboardStats.activeTarget > 0
                      ? `₹${orgDashboardStats.activeTarget.toLocaleString('en-IN')}`
                      : 'Open Target'}
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <PieChart className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 text-[10px] sm:text-[11px]">
                  <span className="font-extrabold text-indigo-700 tabular-nums">
                    Achieved: {orgDashboardStats.targetProgressPct}%
                  </span>
                  {orgDashboardStats.activeTarget > 0 && (
                    <span className="text-slate-500 font-bold tabular-nums truncate">
                      Bang: ₹{orgDashboardStats.targetRemaining.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${orgDashboardStats.targetProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Card 3: Active Roll (Kohhran / Members) */}
            <div
              onClick={() => onOpenMemberRoll && onOpenMemberRoll('members_list', activeOrgCampaign.id)}
              className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between cursor-pointer hover:border-indigo-300 transition"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                    {activeOrgCampaign.rollStructureType === 'hqrs_hierarchy'
                      ? 'Kohhran & Bial Roll'
                      : 'Member Roll'}
                  </p>
                  <h3 className="text-base sm:text-2xl font-black text-slate-900 mt-1 tabular-nums truncate">
                    {orgDashboardStats.memberCount}{' '}
                    <span className="text-[10px] sm:text-xs font-extrabold text-slate-500">
                      {activeOrgCampaign.rollStructureType === 'hqrs_hierarchy' ? 'Kohhran' : 'Members'}
                    </span>
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md w-fit">
                  {orgDashboardStats.sectionCount} Bial
                </span>
                <span className="text-indigo-600 font-extrabold flex items-center gap-0.5">
                  Roll En Rawh <ChevronRight className="w-3 h-3 shrink-0" />
                </span>
              </div>
            </div>

            {/* Card 4: Expenses & Net Balance */}
            <div
              onClick={() => onOpenMemberRoll && onOpenMemberRoll('expenses', activeOrgCampaign.id)}
              className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between cursor-pointer hover:border-amber-300 transition"
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400 truncate">
                    Net Balance
                  </p>
                  <h3 className="text-base sm:text-2xl font-black text-emerald-700 mt-1 tabular-nums truncate">
                    ₹{orgDashboardStats.netBalance.toLocaleString('en-IN')}
                  </h3>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] sm:text-[11px]">
                <span className="font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5 w-fit tabular-nums truncate max-w-full">
                  <ArrowDownRight className="w-3 h-3 shrink-0" /> ₹{orgDashboardStats.totalExpenses.toLocaleString('en-IN')}
                </span>
                <span className="text-slate-500 font-bold">
                  {orgDashboardStats.expenseCount} Vouchers
                </span>
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION: Visual Statistics (Collection Progress Donut/Pie & Monthly Revenue Bar Chart) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {/* Chart 1: Collection Progress & Category Breakdown (Donut Chart) */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <PieChart className="w-4 h-4 text-indigo-600" />
                    <span>Collection Progress & Category Share</span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Bawm chhung category hrang hrang atanga pawisa lut zat
                  </p>
                </div>
                <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                  {orgDashboardStats.targetProgressPct}% Target
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 my-auto py-2">
                {/* Interactive SVG Donut Chart */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="46" fill="transparent" stroke="#f1f5f9" strokeWidth="16" />
                    {(() => {
                      const circumference = 2 * Math.PI * 46;
                      let accumulatedPct = 0;
                      const nonZeroCats = orgDashboardStats.categoryBreakdown.filter(c => c.amount > 0);
                      if (nonZeroCats.length === 0) {
                        return (
                          <circle
                            cx="60"
                            cy="60"
                            r="46"
                            fill="transparent"
                            stroke="#4f46e5"
                            strokeWidth="16"
                            strokeDasharray={`${(orgDashboardStats.targetProgressPct / 100) * circumference} ${circumference}`}
                          />
                        );
                      }
                      return nonZeroCats.map((cat) => {
                        const share = orgDashboardStats.totalCollections > 0 ? cat.amount / orgDashboardStats.totalCollections : 0;
                        const strokeLen = share * circumference;
                        const offset = accumulatedPct * circumference;
                        accumulatedPct += share;
                        return (
                          <circle
                            key={cat.name}
                            cx="60"
                            cy="60"
                            r="46"
                            fill="transparent"
                            stroke={cat.color}
                            strokeWidth="16"
                            strokeDasharray={`${strokeLen} ${circumference}`}
                            strokeDashoffset={-offset}
                          />
                        );
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                    <span className="text-[9.5px] font-extrabold uppercase text-slate-400">Total Lut</span>
                    <span className="text-xs font-black text-slate-900">
                      ₹{orgDashboardStats.totalCollections.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Category Legend & Progress Bars */}
                <div className="flex-1 w-full space-y-2">
                  {orgDashboardStats.categoryBreakdown.slice(0, 6).map((cat) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="font-extrabold text-slate-700 truncate">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-black text-slate-900">
                            ₹{cat.amount.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[9.5px] font-bold text-slate-400">({cat.pct}%)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(cat.amount > 0 ? 4 : 0, cat.pct)}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart 2: Monthly Revenue & Expense Bar Chart */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-emerald-600" />
                    <span>Monthly Revenue & Expense Trend</span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Thla 6 kalta chhung pawisa lut (Received) leh hmanral (Paid)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-extrabold">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Received
                  </span>
                  <span className="flex items-center gap-1 text-rose-600">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-400 inline-block" /> Paid
                  </span>
                </div>
              </div>

              <div className="h-44 flex items-end justify-between gap-2 pt-6 pb-1 px-1 border-b border-slate-100">
                {orgDashboardStats.monthlySeries.map((m) => {
                  const revHeightPct = Math.max(
                    m.revenue > 0 ? 10 : 3,
                    Math.round((m.revenue / orgDashboardStats.maxMonthlyVal) * 100)
                  );
                  const expHeightPct = Math.max(
                    m.expense > 0 ? 8 : 2,
                    Math.round((m.expense / orgDashboardStats.maxMonthlyVal) * 100)
                  );
                  return (
                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                      <div className="text-[9px] font-extrabold text-slate-600 truncate max-w-full">
                        {m.revenue > 0 ? `₹${(m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(1)}k` : m.revenue)}` : '₹0'}
                      </div>
                      <div className="w-full flex items-end justify-center gap-1 h-28">
                        <div
                          className="w-3.5 sm:w-5 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 shadow-2xs"
                          style={{ height: `${revHeightPct}%` }}
                          title={`${m.label} Received: ₹${m.revenue.toLocaleString('en-IN')}`}
                        />
                        <div
                          className="w-2.5 sm:w-3.5 bg-gradient-to-t from-rose-500 to-rose-300 rounded-t-md transition-all duration-500"
                          style={{ height: `${expHeightPct}%` }}
                          title={`${m.label} Paid: ₹${m.expense.toLocaleString('en-IN')}`}
                        />
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-500">{m.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2.5 flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-bold">
                  Total Received: <strong className="text-emerald-700">₹{orgDashboardStats.totalCollections.toLocaleString('en-IN')}</strong>
                </span>
                <span className="font-bold">
                  Total Paid: <strong className="text-rose-600">₹{orgDashboardStats.totalExpenses.toLocaleString('en-IN')}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* BOTTOM SECTION: Responsive Records & Report Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  <span>Recent Transactions & Reports ({activeOrgCampaign.title})</span>
                </h3>
                <p className="text-[10.5px] text-slate-500 font-medium">
                  Pawisa lut (Received) leh hmanral (Paid) chhinchhiahna hnuhnung berte
                </p>
              </div>
              <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                {onOpenMemberRoll && (
                  <button
                    type="button"
                    onClick={() => onOpenMemberRoll('print_reports', activeOrgCampaign.id)}
                    className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold transition cursor-pointer text-center whitespace-nowrap"
                  >
                    🖨️ Print Statement
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenReports}
                  className="w-full sm:w-auto justify-center px-3 py-2 sm:py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold transition cursor-pointer text-center whitespace-nowrap"
                >
                  Full Ledger & Excel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Member / Kohhran / Party</th>
                    <th className="py-2.5 px-4">Category / Head</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Amount (₹)</th>
                    <th className="py-2.5 px-4 text-right">Ref / Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {orgDashboardStats.recentLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                        Tun dinhmunah he Bawm-ah hian transaction record a la awm lo.
                      </td>
                    </tr>
                  ) : (
                    orgDashboardStats.recentLedger.map((row) => (
                      <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(row.date)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-extrabold text-slate-900">{row.partyName}</div>
                          {row.memberCode && row.memberCode !== '-' && (
                            <div className="text-[10px] font-mono font-bold text-indigo-600">{row.memberCode}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-700">
                          {row.category}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {row.type === 'Received' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ● Received
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                              ● Paid
                            </span>
                          )}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-black whitespace-nowrap ${
                          row.type === 'Received' ? 'text-emerald-700' : 'text-rose-600'
                        }`}>
                          {row.type === 'Received' ? '+' : '-'}₹{row.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[10.5px] font-bold text-slate-500 whitespace-nowrap">
                          {row.reference}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        ) : (
        /* PUBLIC / GUEST ORGANIZATION PORTAL (Protected: No sensitive statistics, collections, or donor ledgers leaked) */
        <div className="bg-slate-50 rounded-3xl p-3 sm:p-5 border border-slate-200/90 shadow-xs space-y-4 animate-fadeIn">
          {/* Public Organization Identity & Welcome Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0 overflow-hidden border-2 border-indigo-200">
                  {activeOrgCampaign.imageUrl ? (
                    <img
                      src={activeOrgCampaign.imageUrl}
                      alt={activeOrgCampaign.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-9 h-9 text-amber-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" /> Official Organization Portal
                    </span>
                    {activeOrgCampaign.orgCode && (
                      <span className="text-[10px] font-black uppercase bg-slate-900 text-amber-300 px-2 py-0.5 rounded-md font-mono">
                        [{activeOrgCampaign.orgCode}]
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg sm:text-2xl font-black text-slate-900 mt-1">
                    {activeOrgCampaign.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                    {activeOrgCampaign.subTitle || activeOrgCampaign.location || 'Official Online Giving & Contribution Portal'}
                  </p>
                  {activeOrgCampaign.description && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200/70">
                      {activeOrgCampaign.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Mode Switcher for users who want standard personal features */}
              <div className="shrink-0 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => toggleWorkspaceViewMode('hybrid')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black border border-slate-300 transition cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap active:scale-95"
                  title="Switch to Personal + Pawl Mode"
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span>🌐 Mimal + Pawl Mode</span>
                </button>
              </div>
            </div>

            {/* Target Goal Progress (Safe Public View: Target Goal & Progress % without internal ledger leak) */}
            {orgDashboardStats.activeTarget > 0 && (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/50 border border-indigo-100 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-indigo-600" /> Target / Hmalakna Goal
                  </span>
                  <span className="font-black text-indigo-900">
                    ₹{orgDashboardStats.activeTarget.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-700 shadow-2xs"
                    style={{ width: `${Math.min(100, Math.max(5, orgDashboardStats.targetProgressPct))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span className="text-emerald-700 font-extrabold">{orgDashboardStats.targetProgressPct}% Pek tawh a ni e</span>
                  <span>Target Goal: ₹{orgDashboardStats.activeTarget.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {/* Enabled Categories Pill Strip */}
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3 text-indigo-600" /> Thawhlawm / Giving Categories:
                </span>
                {orgDashboardStats.enabledCats.map((cat) => (
                  <span
                    key={cat}
                    className="text-[11px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200/80 px-2.5 py-1 rounded-xl"
                  >
                    ✓ {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* TWO PRIMARY ACTION BUTTONS (Lian leh Fiah tak) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Button 1: Thawh Rawh / Pekna (Contribute Now) */}
            <button
              type="button"
              onClick={() => onSelectCampaign && onSelectCampaign(activeOrgCampaign)}
              className="group relative bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-500 hover:to-teal-700 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-between gap-3 text-left border border-emerald-400/40 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20 group-hover:scale-110 transition-transform">
                  <Zap className="w-6 h-6 text-amber-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-base sm:text-lg text-white">⚡ Thawh Rawh / Pekna</span>
                    <span className="text-[9px] font-black uppercase bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-md">
                      DIRECT UPI
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 font-medium mt-0.5 truncate">
                    Thawhlawm, Target, emaw pekna online-in thawh nghal rawh
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-emerald-200 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>

            {/* Button 2: Quick Entry / Passbook (Digit 4) */}
            <button
              type="button"
              onClick={() => onOpenMemberRoll && onOpenMemberRoll('quick_entry', activeOrgCampaign.id)}
              className="group relative bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 hover:from-indigo-800 hover:to-slate-800 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-between gap-3 text-left border border-indigo-400/30 active:scale-[0.98]"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-indigo-400/30 group-hover:scale-110 transition-transform">
                  <Receipt className="w-6 h-6 text-indigo-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-base sm:text-lg text-white">📖 Quick Entry (Digit 4)</span>
                    <span className="text-[9px] font-black uppercase bg-indigo-500 text-white px-1.5 py-0.2 rounded-md font-mono">
                      PASSBOOK
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 font-medium mt-0.5 truncate">
                    Digit 4 chauh chhu lutin i mimal slip leh record en rawh
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-indigo-300 group-hover:translate-x-1 transition-transform shrink-0" />
            </button>
          </div>

          {/* Security & Confidentiality Notice + Officer Login Portal */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-start gap-2.5 min-w-0">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                He Bawm portal hi <strong className="text-slate-900">{activeOrgCampaign.title}</strong> pual liau liauva siam a ni a. Sum dinhmun chipchiar leh management tools hi Authorized Officers (Treasurer / Accountant / Auditor) tan chauha venghim a ni.
              </p>
            </div>
            {onOpenLogin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="shrink-0 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-black shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 border border-slate-800"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>🔐 Officer / Treasurer Login</span>
              </button>
            )}
          </div>
        </div>
        )
      ) : (
      <>
      {/* 1. Money Transfer, Quick Actions & UPI */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-indigo-100/80">
        <div className="flex justify-between items-center mb-2.5">
          <h2 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            {language === 'mizo' ? 'Quick Actions & Transfers' : 'Quick Actions & Transfers'}
          </h2>
          <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
            Instant Pay
          </span>
        </div>
        <div className="grid grid-cols-6 gap-1 sm:gap-2 text-center items-start">
          {/* Scan Any QR */}
          <button 
            id="home-quick-scan-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartScanner('any');
            }}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform min-w-0"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs border border-indigo-100 shrink-0">
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] leading-[1.15] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors line-clamp-2 w-full min-h-[21px]">
              {t.scanQR}
            </span>
          </button>

          {/* Sulhnu / History Quick Action */}
          <button 
            id="home-quick-sulhnu-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenHistory && onOpenHistory();
            }}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative min-w-0"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs border border-purple-200 relative shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] leading-[1.15] font-bold text-purple-900 group-hover:text-purple-600 transition-colors line-clamp-2 w-full min-h-[21px]">
              Sulhnu
            </span>
          </button>

          {/* Member Roll & Entry Quick Action */}
          <button 
            id="home-quick-member-roll-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOpenMemberRoll && onOpenMemberRoll('members_list');
            }}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative min-w-0"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs border border-blue-200 relative shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
            </div>
            <span className="text-[9px] leading-[1.15] font-bold text-blue-800 group-hover:text-blue-600 transition-colors line-clamp-2 w-full min-h-[21px]">
              Member Roll
            </span>
          </button>

          {/* To Bank Transfer */}
          <button 
            onClick={onShowBankTransfer}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform min-w-0"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs border border-emerald-100 shrink-0">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] leading-[1.15] font-bold text-slate-700 group-hover:text-emerald-600 transition-colors line-clamp-2 w-full min-h-[21px]">
              {t.toBank}
            </span>
          </button>

          {/* Create QR */}
          <button 
            onClick={onCreateQRClick}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative min-w-0"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-xs border border-amber-100 relative shrink-0">
              <PlusCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              {creatorProfile.isApproved && (() => {
                const exp = getCreatorExpiryStatus(creatorProfile);
                if (exp.isExpiringSoon || exp.isExpired) {
                  return (
                    <span 
                      title={exp.isExpired ? "Creator Trial/Plan Expired" : `Expiring in ${exp.daysRemaining} days!`}
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" 
                    />
                  );
                }
                return null;
              })()}
            </div>
            <span className="text-[9px] leading-[1.15] font-bold text-slate-700 group-hover:text-amber-600 transition-colors line-clamp-2 w-full min-h-[21px]">
              {t.createQR}
            </span>
          </button>

          {/* Check Balance */}
          <button 
            onClick={onShowBalance}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform min-w-0"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-50 text-slate-700 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-slate-700 group-hover:text-white transition-all shadow-xs border border-slate-200 shrink-0">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] leading-[1.15] font-bold text-slate-700 group-hover:text-slate-900 transition-colors line-clamp-2 w-full min-h-[21px]">
              {t.checkBalance}
            </span>
          </button>
        </div>
      </div>


      {/* 2. RonPay Live Stats Card */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4 rounded-2xl text-white shadow-md relative overflow-hidden border border-indigo-800/60">
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-400/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex justify-between items-center mb-2.5">
          <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> RonPay Public Fund Pool
          </span>
          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
            ● LIVE MIZORAM
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center items-stretch">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center min-w-0">
            <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider truncate w-full">Total Raised</p>
            <p className="text-sm sm:text-base font-black text-amber-300 mt-1 tabular-nums truncate w-full">
              ₹{totalRaised.toLocaleString('en-IN', { minimumFractionDigits: totalRaised % 1 !== 0 ? 1 : 0, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center min-w-0">
            <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider truncate w-full">Total Txns</p>
            <p className="text-sm sm:text-base font-black text-emerald-300 mt-1 tabular-nums truncate w-full">
              {totalTxnsCount} Txns
            </p>
            {todayTxnsCount > 0 && (
              <p className="text-[8px] text-emerald-200/90 font-bold mt-0.5 truncate w-full">
                ({language === 'mizo' ? 'Vawiin' : 'Today'}: {todayTxnsCount})
              </p>
            )}
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-xs flex flex-col items-center justify-center min-w-0">
            <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider truncate w-full">Active QRs</p>
            <p className="text-sm sm:text-base font-black text-cyan-300 mt-1 tabular-nums truncate w-full">
              {activeQRsCount} Lives
            </p>
          </div>
        </div>
      </div>

      {/* 2.5 PhonePe TSP & PG V2 Integration Quick Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-3 sm:p-3.5 rounded-2xl text-white shadow-sm border border-purple-700/60 flex flex-col @xl:flex-row @xl:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-black shadow-md border border-purple-400 shrink-0">
            <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-extrabold text-xs text-white">PhonePe PG V2 & TSP</h3>
              <span className="text-[8.5px] sm:text-[9px] bg-emerald-400 text-emerald-950 font-black px-1.5 py-0.2 rounded font-mono shrink-0">
                UAT READY
              </span>
            </div>
            <p className="text-[9.5px] sm:text-[10px] text-purple-200 font-medium truncate">
              MID: <span className="font-mono text-amber-300 font-bold">TSPMIZOPAYUAT</span> • 1% Split Fee
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full @xl:w-auto">
          {onOpenPhonePeCheckout && (
            <button
              type="button"
              id="home-phonepe-checkout-btn"
              onClick={() => onOpenPhonePeCheckout(100)}
              className="flex-1 @xl:flex-initial h-8 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black px-3 rounded-xl text-[10.5px] transition shadow-xs cursor-pointer active:scale-95 flex items-center justify-center gap-1 shrink-0 whitespace-nowrap"
              title="Open PhonePe PG Checkout Page"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950 text-slate-950 shrink-0" />
              <span>Checkout (₹100)</span>
            </button>
          )}
          <button
            type="button"
            id="home-phonepe-api-logs-btn"
            onClick={onOpenPhonePePortal}
            className="flex-1 @xl:flex-initial h-8 bg-white hover:bg-purple-50 text-purple-950 font-black px-3 rounded-xl text-[10.5px] transition shadow-xs cursor-pointer active:scale-95 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 border border-purple-200/80 text-center"
          >
            <Activity className="w-3 h-3 text-purple-700 shrink-0" />
            <span>API & Logs</span>
          </button>
        </div>
      </div>

      {/* 3. Community Collection Hubs - RONPAY SERVICES */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-indigo-100/80">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
              <HandHeart className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-[12px] font-black text-indigo-950 uppercase tracking-wide">
                RONPAY SERVICES
              </h2>
              <p className="text-[9px] text-slate-400 font-medium">Thlan la, Search la, Donate Rawh</p>
            </div>
          </div>
          <span className="text-[9px] bg-gradient-to-r from-slate-100 to-indigo-100 text-indigo-900 px-2.5 py-0.5 rounded-full font-bold border border-indigo-200">
            RonPay Bawmte
          </span>
        </div>

        {/* Global Search Bar: "Find Bawm / Campaign" */}
        <div className="mb-3 space-y-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-indigo-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              id="global-find-bawm-input"
              value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              placeholder={language === 'mizo' 
                ? 'Find Bawm / Campaign (e.g. EBE, BCM, Ralna, YMA, Khawlsak)...' 
                : 'Find Bawm / Campaign (Prefix code e.g. EBE, title, or NGO)...'}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-slate-900 border border-indigo-200/90 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-600 transition shadow-2xs placeholder:text-slate-400"
            />
            {globalSearchQuery && (
              <button
                type="button"
                onClick={() => setGlobalSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Real-time Global Search Results Dropdown/Card list */}
          {globalSearchQuery.trim() && (
            <div className="bg-slate-50 border border-indigo-100 rounded-xl p-2.5 space-y-2 animate-fadeIn max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-1">
                <span>{globalSearchResults.length} Bawm / Campaign hmuh a ni</span>
                {globalSearchResults.some(c => c.isHidden) && (
                  <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-extrabold flex items-center gap-1">
                    <EyeOff className="w-2.5 h-2.5" /> Unlisted QRs included
                  </span>
                )}
              </div>

              {globalSearchResults.length === 0 ? (
                <div className="text-center py-3 text-slate-500 text-xs">
                  <p className="font-semibold">&quot;{globalSearchQuery}&quot; nen inmil Bawm hmuh a awm lo.</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Prefix code (e.g. EBE), Kohhran hming, emaw Bawm hming zawn tum rawh.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {globalSearchResults.map(camp => (
                    <div
                      key={camp.id}
                      onClick={() => {
                        setGlobalSearchQuery('');
                        if (onSelectCampaign) onSelectCampaign(camp);
                        else onSelectBawm(camp.category);
                      }}
                      className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition cursor-pointer flex items-center justify-between gap-2 shadow-2xs group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0 ${
                          camp.category === 'ralna' ? 'bg-slate-900' :
                          camp.category === 'khawlsak' ? 'bg-emerald-600' :
                          camp.category === 'rikrum' ? 'bg-rose-600' :
                          camp.category === 'kumtluang' ? 'bg-blue-600' : 'bg-indigo-600'
                        }`}>
                          <QrCode className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition truncate">
                              {camp.title}
                            </span>
                            {camp.isHidden && (
                              <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5">
                                <EyeOff className="w-2.5 h-2.5 text-amber-700" /> Unlisted
                              </span>
                            )}
                          </div>
                          <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">
                            {camp.location || 'Mizoram'} • {camp.orgName || camp.cause || camp.category}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGlobalSearchQuery('');
                          if (onSelectCampaign) onSelectCampaign(camp);
                          else onSelectBawm(camp.category);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-600 text-white hover:bg-indigo-700 transition shrink-0 shadow-2xs flex items-center gap-1 cursor-pointer"
                      >
                        <span>+ Pay Now</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Ralna Bawm - Clean Card with YMA Flag Tri-Color Accent & Vibrant Red */}
          <button
            onClick={() => onSelectBawm('ralna')}
            className="bg-white hover:bg-slate-50 border-2 border-slate-200/90 p-3 rounded-2xl text-left transition flex flex-col justify-between group cursor-pointer shadow-xs active:scale-[0.98] text-slate-900 relative overflow-hidden"
          >
            {/* YMA Flag Tri-Color Mini Ribbon */}
            <div className="absolute top-0 right-0 overflow-hidden rounded-bl-lg border-l border-b border-slate-200">
              <div className="flex h-2.5 w-12">
                <div className="flex-1 bg-black" />
                <div className="flex-1 bg-white border-x border-slate-200" />
                <div className="flex-1 bg-red-600" />
              </div>
            </div>

            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 bg-red-600 text-white rounded-xl flex items-center justify-center text-sm shadow-xs shrink-0 group-hover:scale-105 transition-transform border border-red-500">
                <Ribbon className="w-5 h-5 text-white" />
              </div>
              <div className="overflow-hidden pr-6">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-slate-900 text-xs truncate">Ralna Bawm</h3>
                  <span className="text-[8px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.2 rounded font-black">
                    CHHIATNI
                  </span>
                </div>
                <p className="text-[9.5px] text-slate-500 font-medium">Chhiatni & Condolence (YMA)</p>
              </div>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] text-red-700 bg-red-50 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-red-200">
                <Search className="w-2.5 h-2.5 text-red-600" /> Search & Browse Ralna QRs
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-red-600 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Khawlsak Bawm */}
          <button
            onClick={() => onSelectBawm('khawlsak')}
            className="bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 p-3 rounded-2xl text-left transition flex flex-col justify-between group cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-sm shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <HandHeart className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-emerald-950 text-xs truncate">Khawlsak Bawm</h3>
                <p className="text-[9px] text-emerald-700 font-medium">Riangvai, Chanhai, Tanpui Directory</p>
              </div>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-emerald-200">
                <Search className="w-2.5 h-2.5" /> Search & Browse Khawlsak
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Rikrum Bawm */}
          <button
            onClick={() => onSelectBawm('rikrum')}
            className="bg-rose-50 hover:bg-rose-100/90 border border-rose-200/80 p-3 rounded-2xl text-left transition flex flex-col justify-between group cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 bg-rose-600 text-white rounded-xl flex items-center justify-center text-sm shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-rose-950 text-xs truncate">Rikrum Bawm</h3>
                <p className="text-[9px] text-rose-700 font-medium">Kangmei, Emergency Relief Hub</p>
              </div>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] text-rose-800 bg-rose-100/90 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-rose-200">
                <Search className="w-2.5 h-2.5" /> Search & Urgent Relief
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>

          {/* Kumtluang Bawm */}
          <div
            onClick={() => onSelectBawm('kumtluang')}
            className="bg-blue-50 hover:bg-blue-100/90 border border-blue-200/80 p-3 rounded-2xl text-left transition flex flex-col justify-between group cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center text-sm shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                <InfinityIcon className="w-5 h-5" />
              </div>
              <div className="overflow-hidden">
                <h3 className="font-bold text-blue-950 text-xs truncate">Kumtluang Bawm</h3>
                <p className="text-[9px] text-blue-700 font-medium">NGO, Kohhran & Pawl Directory</p>
              </div>
            </div>
            <div className="flex items-center justify-between w-full gap-1.5">
              <span className="text-[9px] text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-blue-200 truncate">
                <Search className="w-2.5 h-2.5 shrink-0" /> Browse Heads
              </span>
              {onOpenMemberRoll && (
                creatorProfile?.isAdmin || 
                creatorProfile?.role === 'SUPER_ADMIN' || 
                creatorProfile?.role === 'ADMIN' || 
                creatorProfile?.role === 'MODERATOR' ||
                campaigns.some(c => c.category === 'kumtluang' && isCampaignCreator(c, creatorProfile))
              ) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const firstKumtluang = campaigns.find(c => c.category === 'kumtluang');
                    onOpenMemberRoll('members_list', firstKumtluang?.id);
                  }}
                  className="text-[8.5px] font-black text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-md shadow-2xs flex items-center gap-1 shrink-0 cursor-pointer"
                  title="Open Member Roll"
                >
                  <Users className="w-2.5 h-2.5" /> Roll
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Recharge & Bill Payments Section */}
      <div id="quick-bill-recharge-section" className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-2.5 overflow-hidden">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Recharge & Bill Payments
            </h2>
            <p className="text-[9.5px] text-slate-500 font-medium">
              Instant BBPS Utilities • Scroll a zawn awlsam
            </p>
          </div>
          <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 flex items-center gap-1">
            <span>Scroll &rarr;</span>
          </span>
        </div>

        {/* Scrollable Container with horizontal swipe */}
        <div className="overflow-x-auto pb-1.5 pt-0.5 scroll-smooth no-scrollbar">
          <div className="flex gap-2 sm:gap-3 min-w-max px-0.5">
            {BILL_SERVICES.map(service => (
              <button
                key={service.id}
                onClick={() => onOpenBillService(service)}
                className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform w-[70px] sm:w-[76px] shrink-0 text-center"
              >
                <div className={`w-12 h-12 ${service.bgColor} rounded-2xl flex items-center justify-center text-sm mb-1.5 group-hover:scale-105 transition-all shadow-xs border border-slate-100/80`}>
                  {renderBillIcon(service.icon)}
                </div>
                <span className="text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors leading-tight line-clamp-2 px-0.5">
                  {service.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Official Website & Portal Link Card */}
      {onOpenWebsite && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 p-3.5 sm:p-4 rounded-2xl text-white shadow-md border border-indigo-500/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col @xl:flex-row @xl:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start @xl:items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md font-black">
                <Globe className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-white">
                    {language === 'mizo' ? 'RonPay Official Website & Kawtchhuah' : 'RonPay Official Website & Portal'}
                  </h3>
                  <span className="text-[8px] sm:text-[8.5px] bg-amber-400/20 text-amber-300 font-black px-1.5 py-0.2 rounded border border-amber-400/30">
                    LIVE WEB
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-medium mt-0.5">
                  {language === 'mizo'
                    ? 'Chungchang, Features, FAQ, Soundbox Live Demo leh Mizo Community Portal'
                    : 'About Us, Features, FAQ, Soundbox Demo & Community Helpdesk'}
                </p>
              </div>
            </div>

            <button
              type="button"
              id="home-open-website-btn"
              onClick={onOpenWebsite}
              className="w-full @xl:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md transition cursor-pointer active:scale-95 shrink-0"
            >
              <span>{language === 'mizo' ? 'Website Tlawh Rawh' : 'Visit Website'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 5. Recent Created QRs & Search Section */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-indigo-600" />
            <h3 className="text-[11px] sm:text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              {language === 'mizo' ? 'Active QRs & Zawnna' : 'Active QRs & Search'}
            </h3>
            <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
              {qrCategoryFilter !== 'all' || qrSearchQuery.trim()
                ? `${displayedQRs.length} of ${activeSortedQRs.length} Active`
                : `${activeSortedQRs.length} Active QRs`}
            </span>
          </div>
          <button 
            onClick={onCreateQRClick}
            className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            + Create / Manage QRs <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Real-time QR Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            id="home-qr-search-input"
            value={qrSearchQuery}
            onChange={(e) => setQrSearchQuery(e.target.value)}
            placeholder={language === 'mizo' ? 'QR hming, Veng, Khua, UPI emaw Bawm zawng rawh...' : 'Search QR title, location, category, or UPI...'}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          {qrSearchQuery && (
            <button
              type="button"
              onClick={() => setQrSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* GPS Location-Based Sorting Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5 pb-0.5">
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => {
                if (!userCoords) {
                  requestUserGPS(true);
                } else {
                  setSortMode('gps');
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                sortMode === 'gps' && userCoords
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
              title={language === 'mizo' ? 'I awmna GPS atanga hnai ber hmasak berin rem rawh' : 'Sort by nearest GPS distance'}
            >
              <Navigation className={`w-3 h-3 ${sortMode === 'gps' && userCoords ? 'text-white' : 'text-emerald-600'}`} />
              <span>{language === 'mizo' ? 'Hnai Ber (GPS)' : 'Nearest (GPS)'}</span>
              {gpsStatus === 'detecting' && (
                <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSortMode('newest')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                sortMode === 'newest' || !userCoords
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
              title={language === 'mizo' ? 'Siam thar ber hmasak berin rem rawh' : 'Sort by newest created'}
            >
              <History className="w-3 h-3" />
              <span>{language === 'mizo' ? 'Thar Ber' : 'Newest'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-[9.5px]">
            {sortMode === 'gps' && userCoords && (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/70 flex items-center gap-1 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{language === 'mizo' ? 'Hnai ber a lang hmasa' : 'Nearest to Farthest'}</span>
              </span>
            )}
            {gpsStatus === 'detecting' && (
              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/70 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-600" />
                <span>{language === 'mizo' ? 'GPS zawn mek...' : 'Detecting GPS...'}</span>
              </span>
            )}
            {gpsStatus === 'denied' && (
              <button
                type="button"
                onClick={() => requestUserGPS(true)}
                className="text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200/70 flex items-center gap-1 cursor-pointer"
                title={language === 'mizo' ? 'GPS phalsak nawn rawh' : 'Allow GPS permission'}
              >
                <span>⚠️ {language === 'mizo' ? 'GPS denied (Thar ber)' : 'GPS denied (Newest)'}</span>
                <span className="underline ml-0.5 text-indigo-600 font-extrabold">{language === 'mizo' ? 'Allow' : 'Enable'}</span>
              </button>
            )}
            {!userCoords && gpsStatus === 'idle' && (
              <button
                type="button"
                onClick={() => requestUserGPS(true)}
                className="text-indigo-600 hover:text-indigo-800 font-bold bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200/70 flex items-center gap-1 cursor-pointer"
              >
                <Navigation className="w-2.5 h-2.5 text-indigo-600" />
                <span>{language === 'mizo' ? 'GPS Hnai Ber' : 'Enable GPS'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[10px] scrollbar-none">
          {[
            { id: 'ralna', label: 'Ralna' },
            { id: 'khawlsak', label: 'Khawlsak' },
            { id: 'rikrum', label: 'Rikrum' },
            { id: 'kumtluang', label: 'Kumtluang' }
          ].map(pill => {
            const isActive = qrCategoryFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setQrCategoryFilter(prev => prev === pill.id ? 'all' : pill.id)}
                className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs ring-2 ring-indigo-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
                title={isActive ? (language === 'mizo' ? 'Filter paih nan hmet nawn rawh' : 'Click again to remove filter') : undefined}
              >
                {pill.label}
              </button>
            );
          })}
          {qrCategoryFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setQrCategoryFilter('all')}
              className="text-[9px] font-bold text-slate-500 hover:text-rose-600 px-1.5 py-0.5 rounded bg-slate-100/80 hover:bg-rose-50 border border-slate-200/60 transition cursor-pointer flex items-center gap-0.5"
              title="Filter paih bo rawh"
            >
              <X className="w-2.5 h-2.5" />
              <span>{language === 'mizo' ? 'Paih rawh' : 'Clear'}</span>
            </button>
          )}
          {(qrSearchQuery || qrCategoryFilter !== 'all') && (
            <span className="text-[9.5px] font-bold text-slate-500 ml-auto shrink-0">
              {filteredQRs.length} {language === 'mizo' ? 'hmuh a ni' : 'found'}
            </span>
          )}
        </div>

        <div className="space-y-2.5">
          {displayedQRs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 text-center space-y-2">
              <Search className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                {qrSearchQuery || qrCategoryFilter !== 'all'
                  ? (language === 'mizo' ? 'Zawn hmuh a awm lo' : 'No matching QRs found')
                  : (language === 'mizo' ? 'QR Siam a la awm lo' : 'No QRs created yet')}
              </p>
              <p className="text-[11px] text-slate-500">
                {qrSearchQuery || qrCategoryFilter !== 'all'
                  ? (language === 'mizo' 
                      ? `"${qrSearchQuery || qrCategoryFilter}" nen a inmil QR hmuh a ni lo. Khawngaihin hming emaw veng dang zawn tum rawh.` 
                      : 'Try adjusting your search or category filter.')
                  : (language === 'mizo' 
                      ? 'QR Code thar siam turin "+ Create / Manage QRs" hmet rawh.' 
                      : 'Click "+ Create / Manage QRs" to create a new QR.')}
              </p>
              {(qrSearchQuery || qrCategoryFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setQrSearchQuery('');
                    setQrCategoryFilter('all');
                  }}
                  className="text-[10.5px] font-bold text-indigo-600 hover:underline cursor-pointer pt-1"
                >
                  {language === 'mizo' ? 'Zawnna reset rawh' : 'Reset search filter'}
                </button>
              )}
            </div>
          ) : (
            displayedQRs.map(camp => {
            const isGuest = Boolean(
              isGuestUser || 
              !creatorProfile || 
              !creatorProfile.phone || 
              creatorProfile.phone.trim() === '' || 
              creatorProfile.phone === '9999999999' ||
              creatorProfile.role === 'GUEST' || 
              creatorProfile.name === 'Khualmi (Guest User)' || 
              (creatorProfile.name && (creatorProfile.name.toLowerCase().includes('guest') || creatorProfile.name.toLowerCase().includes('khualmi')))
            );
            const isStaff = !isGuest && Boolean(
              creatorProfile?.isAdmin || 
              creatorProfile?.role === 'SUPER_ADMIN' || 
              creatorProfile?.role === 'ADMIN' || 
              creatorProfile?.role === 'MODERATOR'
            );
            const isOwner = !isGuest && isCampaignCreator(camp, creatorProfile);
            const canManage = Boolean(!isGuest && (isStaff || isOwner));
            const campDistance = campaignDistances.get(camp.id);
            const effectiveValidity = camp.validityDate || camp.expiry_date || camp.valid_until || (camp as any).validity_date || (camp as any).metadata?.validityDate || (camp as any).metadata?.expiry_date || (camp as any).metadata?.valid_until || (camp.category === 'ralna' && camp.createdAt ? new Date(new Date(camp.createdAt).getTime() + 3 * 24 * 3600 * 1000).toISOString() : undefined);
            const isExpired = isCampaignExpired(effectiveValidity, camp.status, camp.category, camp.createdAt);
            const campTransactions = transactions.filter(t => isTransactionForCampaign(t, camp) && isConfirmedTransaction(t));
            const totalRaised = campTransactions.reduce((sum, t) => sum + t.amount, 0);
            const hasTarget = typeof camp.targetAmount === 'number' && camp.targetAmount > 0;
            const target = hasTarget ? camp.targetAmount : 0;
            const percentage = hasTarget && target > 0 ? Math.round((totalRaised / target) * 100) : 0;
            const clampedPercentage = Math.min(percentage, 100);

            const progressColor = 
              camp.category === 'khawlsak' ? 'bg-emerald-500' :
              camp.category === 'rikrum' ? 'bg-rose-500' :
              camp.category === 'kumtluang' ? 'bg-blue-600' :
              camp.category === 'ralna' ? 'bg-slate-900' : 'bg-indigo-600';

            return (
              <div 
                key={camp.id} 
                onClick={() => onSelectCampaign ? onSelectCampaign(camp) : onSelectBawm(camp.category)}
                className="p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/90 hover:border-indigo-300 transition cursor-pointer text-xs group space-y-2.5 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {camp.imageUrl ? (
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                        <img 
                          src={camp.imageUrl} 
                          alt={camp.title} 
                          className="w-full h-full object-cover rounded-[9px]"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const img = e.currentTarget;
                            if ((camp.id === 'cmp-kumtluang-1' || camp.title?.toLowerCase().includes('bcm ebenezer')) && img.src !== BCM_EBENEZER_DEFAULT_LOGO) {
                              img.src = BCM_EBENEZER_DEFAULT_LOGO;
                              return;
                            }
                            if ((camp.id === 'cmp-1788107291420' || camp.title?.toLowerCase().includes('bmp')) && img.src !== BMP_SHILLONG_DEFAULT_LOGO) {
                              img.src = BMP_SHILLONG_DEFAULT_LOGO;
                              return;
                            }
                            img.style.display = 'none';
                            const parent = img.parentElement;
                            if (parent) {
                              parent.classList.remove('bg-white', 'p-0.5', 'border-slate-200/90');
                              parent.classList.add(
                                camp.category === 'ralna' ? 'bg-slate-900' :
                                camp.category === 'khawlsak' ? 'bg-emerald-600' :
                                camp.category === 'rikrum' ? 'bg-rose-600' : 'bg-blue-600',
                                'text-white'
                              );
                              parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 7h.01"/><path d="M7 17h.01"/><path d="M17 17h.01"/></svg>';
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs font-bold ${
                        camp.category === 'ralna' ? 'bg-slate-900 border border-rose-500' :
                        camp.category === 'khawlsak' ? 'bg-emerald-600' :
                        camp.category === 'rikrum' ? 'bg-rose-600' : 'bg-blue-600'
                      }`}>
                        <QrCode className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                          {getCampaignListTitle(camp, language)}
                        </p>
                        {camp.isHidden && (
                          <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5">
                            <EyeOff className="w-2.5 h-2.5 text-amber-700" /> Unlisted
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <p className="text-[9.5px] text-slate-500 font-medium flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                          <span className="truncate">{camp.location || 'Mizoram'}</span>
                        </p>
                        {typeof campDistance === 'number' && (
                          <span 
                            className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200/90 shadow-2xs"
                            title={language === 'mizo' ? `I awmna atanga hlat zawng: ${formatDistance(campDistance, language)}` : `Distance: ${formatDistance(campDistance, language)}`}
                          >
                            <Navigation className="w-2 h-2 text-emerald-600 shrink-0" />
                            {formatDistance(campDistance, language)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    {onShareCampaign && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onShareCampaign(camp);
                        }}
                        title="Share Link & QR Code"
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 transition shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="text-right flex flex-col items-end">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectCampaign) {
                            onSelectCampaign(camp);
                          } else {
                            onSelectBawm(camp.category);
                          }
                        }}
                        className="text-[9.5px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded-lg border border-indigo-100/80 flex items-center gap-0.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        {language === 'mizo' ? 'Pekna' : 'Contribute'} <ChevronRight className="w-3 h-3" />
                      </button>
                      {isExpired ? (
                        <span className="text-[8.5px] font-extrabold text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded-md mt-0.5 inline-block">
                          Expired
                        </span>
                      ) : (
                        <p className="text-[8.5px] text-slate-500 font-medium mt-0.5 pr-0.5" title={effectiveValidity ? `Validity: ${formatDateDDMMYYYY(effectiveValidity)}` : (language === 'english' ? 'No Expiry' : 'Hun tiamchin awm lo')}>
                          {effectiveValidity ? formatDateDDMMYYYY(effectiveValidity) : (language === 'english' ? 'No Expiry' : 'Hun tiamchin awm lo')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar Section (Creator & Admin Management Area) */}
                {/* Guest Users strictly do not see internal Txns Amt, Roll, Hmanral, or Transfer Txns */}
                {!isGuest && canManage && (
                  <div className="bg-white/95 p-2 rounded-xl border border-indigo-100/90 space-y-1.5 shadow-2xs">
                    {!hasTarget ? (
                      <div className="flex items-center justify-between text-[10px] gap-2 flex-wrap sm:flex-nowrap">
                        <div className="flex items-center gap-1.5 font-bold text-slate-700 flex-wrap">
                          <div>
                            <span className="font-black text-slate-900">₹{totalRaised.toLocaleString('en-IN')}</span>
                            <span className="text-slate-500 font-medium ml-1">TT Amt</span>
                          </div>
                          {camp.category === 'kumtluang' && onOpenMemberRoll && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenMemberRoll('members_list', camp.id);
                              }}
                              className="p-1 px-2 rounded-lg bg-blue-600 text-white font-extrabold text-[9px] hover:bg-blue-700 transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                              title="Member Roll hawng rawh"
                            >
                              <Users className="w-3 h-3" /> Roll
                            </button>
                          )}
                          {camp.category === 'kumtluang' && onOpenMemberRoll && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenMemberRoll('expenses', camp.id);
                              }}
                              className="p-1 px-2 rounded-lg bg-amber-600 text-white font-extrabold text-[9px] hover:bg-amber-700 transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                              title="Pawisa hman chhuahna (Expense desk) en rawh"
                            >
                              <Receipt className="w-3 h-3 text-white" />
                              <span>Hmanral</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTransferCampaign(camp);
                              setIsTransferModalOpen(true);
                            }}
                            className="text-[9px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                            title="Bawm enkawlna hlan chhawng rawh (Creator Transfer)"
                          >
                            <ArrowRightLeft className="w-2.5 h-2.5 text-indigo-600" />
                            <span>Transfer</span>
                          </button>
                          <span className="text-[9px] text-slate-600 font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded-md">
                            {campTransactions.length} {campTransactions.length === 1 ? 'txn' : 'txns'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] gap-2 flex-wrap sm:flex-nowrap">
                          <div className="flex items-center gap-1.5 font-bold text-slate-700 flex-wrap">
                            <div>
                              <span className="font-black text-slate-900">₹{totalRaised.toLocaleString('en-IN')}</span>
                              <span className="text-slate-400 font-normal">/ ₹{target.toLocaleString('en-IN')}</span>
                            </div>
                            <span className="text-indigo-700 font-extrabold bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded text-[9px]">
                              {clampedPercentage}%
                            </span>
                            {camp.category === 'kumtluang' && onOpenMemberRoll && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenMemberRoll('members_list', camp.id);
                                }}
                                className="p-1 px-2 rounded-lg bg-blue-600 text-white font-extrabold text-[9px] hover:bg-blue-700 transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                                title="Member Roll hawng rawh"
                              >
                                <Users className="w-3 h-3" /> Roll
                              </button>
                            )}
                            {camp.category === 'kumtluang' && onOpenMemberRoll && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenMemberRoll('expenses', camp.id);
                                }}
                                className="p-1 px-2 rounded-lg bg-amber-600 text-white font-extrabold text-[9px] hover:bg-amber-700 transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                                title="Pawisa hman chhuahna (Expense desk) en rawh"
                              >
                                <Receipt className="w-3 h-3 text-white" />
                               <span>Hmanral</span>
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTransferCampaign(camp);
                                setIsTransferModalOpen(true);
                              }}
                              className="text-[9px] font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                              title="Bawm enkawlna hlan chhawng rawh (Creator Transfer)"
                            >
                              <ArrowRightLeft className="w-2.5 h-2.5 text-indigo-600" />
                              <span>Transfer</span>
                            </button>
                            <span className="text-[9px] text-slate-600 font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded-md">
                              {campTransactions.length} {campTransactions.length === 1 ? 'txn' : 'txns'}
                            </span>
                          </div>
                        </div>

                        {/* Progress Track */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${clampedPercentage}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })
          )}
        </div>

        {/* View All / Collapse toggle button when not actively searching */}
        {activeSortedQRs.length > 5 && !qrSearchQuery.trim() && qrCategoryFilter === 'all' && (
          <div className="pt-1 text-center">
            <button
              type="button"
              id="home-toggle-all-qrs-btn"
              onClick={() => setShowAllQRs(!showAllQRs)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50/80 active:bg-indigo-100 border border-slate-200/90 hover:border-indigo-200 text-indigo-700 font-extrabold text-[11px] transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shadow-2xs"
            >
              {showAllQRs ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>{language === 'mizo' ? 'Tlemte chauh entir rawh (Latest 5 Active)' : 'Show Less (Latest 5 Active)'}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>
                    {language === 'mizo'
                      ? `Active QRs zawng zawng entir rawh (${activeSortedQRs.length} Active QRs)`
                      : `View All Active QRs (${activeSortedQRs.length} Active QRs)`}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
      </>
      )}

      <CampaignTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => {
          setIsTransferModalOpen(false);
          setTransferCampaign(null);
        }}
        campaign={transferCampaign}
        currentCreator={creatorProfile}
        onTransferred={() => {
          setIsTransferModalOpen(false);
          setTransferCampaign(null);
        }}
      />

      <SupabaseSyncModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
      />
    </div>
  );
};
