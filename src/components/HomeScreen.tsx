import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Lock,
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
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowRight,
  Pause,
  Play,
  Users,
  Filter,
  RotateCcw,
  X as CloseIcon
} from 'lucide-react';
import { BawmCategory, Campaign, Transaction, BillService, CreatorProfile, AnnouncementBanner, AnnouncementItem } from '../types';
import { AnnouncementBannerCard } from './AnnouncementBannerCard';
import { BILL_SERVICES } from '../data/initialData';
import { formatDateDDMMYYYY, getCreatorExpiryStatus } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText } from '../utils/translations';
import { isCampaignCreator, DEFAULT_ANNOUNCEMENT_ITEMS } from '../utils/storage';
import { Megaphone } from 'lucide-react';
import { getUserRole, ROLE_METAS, canAccessAdminConsole } from '../utils/rbac';

interface HomeScreenProps {
  onStartScanner: (category?: BawmCategory | 'any') => void;
  onCreateQRClick: () => void;
  onSelectBawm: (category: BawmCategory) => void;
  onOpenBillService: (service: BillService) => void;
  campaigns: Campaign[];
  transactions: Transaction[];
  creatorProfile: CreatorProfile;
  announcement?: AnnouncementBanner;
  onOpenReports: () => void;
  onOpenMemberRoll?: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports', campaignId?: string) => void;
  onShowBalance: () => void;
  onShowBankTransfer: () => void;
  onOpenPhonePePortal?: () => void;
  onSelectCampaign?: (campaign: Campaign) => void;
  language?: Language;
  onOpenHistory?: () => void;
  onShareCampaign?: (campaign: Campaign) => void;
  onOpenAIHriatpui?: () => void;
  onOpenLogin?: () => void;
  onOpenAdminDashboard?: () => void;
  onPreviewImage?: (url: string, title?: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartScanner,
  onCreateQRClick,
  onSelectBawm,
  onOpenBillService,
  campaigns,
  transactions,
  creatorProfile,
  announcement,
  onOpenReports,
  onOpenMemberRoll,
  onShowBalance,
  onShowBankTransfer,
  onOpenPhonePePortal,
  onSelectCampaign,
  language = 'mizo',
  onOpenHistory,
  onShareCampaign,
  onOpenAIHriatpui,
  onOpenLogin,
}) => {

  const t = TRANSLATIONS[language] || TRANSLATIONS.mizo;
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState<boolean>(false);
  const [currentAnnounceIdx, setCurrentAnnounceIdx] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // QR Search & Filter State in Home
  const [qrSearchQuery, setQrSearchQuery] = useState<string>('');
  const [qrCategoryFilter, setQrCategoryFilter] = useState<'all' | BawmCategory>('all');
  const [showAllQRs, setShowAllQRs] = useState<boolean>(false);

  // Active items for rotating announcement banner
  const bannerItems: AnnouncementItem[] = announcement?.items && announcement.items.length > 0
    ? announcement.items.filter(item => item.isActive !== false)
    : (announcement?.title ? [{
        id: 'legacy-1',
        title: announcement.title,
        message: announcement.message,
        type: announcement.type || 'info',
        badge: announcement.type?.toUpperCase() || 'INFO',
        isActive: true
      }] : DEFAULT_ANNOUNCEMENT_ITEMS);

  const animationStyle = announcement?.animationStyle || 'slide';
  const autoRotate = announcement?.autoRotate !== false;
  const rotationSpeedMs = Math.max(2, announcement?.rotationSpeedSeconds || 4) * 1000;

  // Auto-rotation timer
  useEffect(() => {
    if (!autoRotate || isPaused || bannerItems.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentAnnounceIdx((prev) => (prev + 1) % bannerItems.length);
    }, rotationSpeedMs);
    return () => clearInterval(timer);
  }, [autoRotate, isPaused, bannerItems.length, rotationSpeedMs]);

  const fallbackItem: AnnouncementItem = {
    id: 'default',
    title: 'RonPay Community Platform',
    message: 'Mizoram mipuite tan 100% Direct & Transparent Donation Platform.',
    type: 'info',
    badge: 'INFO',
    isActive: true,
    linkText: 'Bawm En Rawh',
    linkAction: 'action_bawm_explorer'
  };

  const activeItem: AnnouncementItem = bannerItems[currentAnnounceIdx] || bannerItems[0] || fallbackItem;

  const handleNextAnnounce = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentAnnounceIdx((prev) => (prev + 1) % bannerItems.length);
  };

  const handlePrevAnnounce = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentAnnounceIdx((prev) => (prev - 1 + bannerItems.length) % bannerItems.length);
  };

  const handleActionLink = (action?: string) => {
    if (!action) return;
    if (action === 'action_bawm_explorer' || action === 'explore_bawm') {
      onSelectBawm('ralna');
    } else if (action === 'action_bill_payment' || action === 'open_bill_service') {
      const el = document.getElementById('quick-bill-recharge-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else if (BILL_SERVICES.length > 0) {
        onOpenBillService(BILL_SERVICES[0]);
      }
    } else if (action === 'action_creator_studio' || action === 'create_qr') {
      onCreateQRClick();
    } else if (action === 'action_kumtluang' || action === 'kumtluang_bawm') {
      onSelectBawm('kumtluang');
    } else if (action.startsWith('http://') || action.startsWith('https://') || action.includes('canva.com')) {
      window.open(action, '_blank');
    }
  };

  // Compute dynamic live stats
  const totalRaised = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const todayCount = transactions.length;
  const activeQRsCount = campaigns.filter(c => c.status === 'active').length;

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

  // Sorted campaigns newest first by createdAt timestamp
  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [campaigns]);

  // Filtered campaigns based on search query and category filter
  const filteredQRs = useMemo(() => {
    let list = sortedCampaigns;
    if (qrCategoryFilter !== 'all') {
      list = list.filter(c => c.category === qrCategoryFilter);
    }
    const q = qrSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(c => 
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        (c.creatorName && c.creatorName.toLowerCase().includes(q)) ||
        (c.upiId && c.upiId.toLowerCase().includes(q)) ||
        (c.category && c.category.toLowerCase().includes(q)) ||
        (c.id && c.id.toLowerCase().includes(q))
      );
    }
    return list;
  }, [sortedCampaigns, qrCategoryFilter, qrSearchQuery]);

  const isSearchingOrFiltered = qrSearchQuery.trim().length > 0 || qrCategoryFilter !== 'all';

  // Display list: if searching/filtering or user toggled showAllQRs, show all matched QRs; otherwise show top 5
  const displayedQRs = useMemo(() => {
    if (isSearchingOrFiltered || showAllQRs) {
      return filteredQRs;
    }
    return filteredQRs.slice(0, 5);
  }, [filteredQRs, isSearchingOrFiltered, showAllQRs]);

  // Counts for filter pills
  const categoryCounts = useMemo(() => {
    const q = qrSearchQuery.trim().toLowerCase();
    const baseList = q ? sortedCampaigns.filter(c => 
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.creatorName && c.creatorName.toLowerCase().includes(q)) ||
      (c.upiId && c.upiId.toLowerCase().includes(q)) ||
      (c.id && c.id.toLowerCase().includes(q))
    ) : sortedCampaigns;

    return {
      all: baseList.length,
      ralna: baseList.filter(c => c.category === 'ralna').length,
      khawlsak: baseList.filter(c => c.category === 'khawlsak').length,
      rikrum: baseList.filter(c => c.category === 'rikrum').length,
      kumtluang: baseList.filter(c => c.category === 'kumtluang').length,
    };
  }, [sortedCampaigns, qrSearchQuery]);

  return (
    <div className="space-y-4 pb-1 animate-fadeIn">
      {/* Admin Custom Live Rotating Announcement Banner with Canva & Media support */}
      {announcement && announcement.isActive && (
        <AnnouncementBannerCard
          announcement={announcement}
          onActionLink={handleActionLink}
        />
      )}

      {/* 0. No App Download Required Notice */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 p-2.5 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-[10px] sm:text-[11px] text-emerald-950 font-bold leading-tight truncate sm:whitespace-normal">
            {language === 'mizo' 
              ? 'RonPay Apps download kher a ngai lo, web & UPI apps dang atangin a pe nghal mai theih e.' 
              : 'No app download required. Scan & pay directly with any UPI app on the web.'}
          </p>
        </div>
        <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-full shrink-0">
          WEB READY
        </span>
      </div>

      {/* Smart Login & Active User Strip */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 rounded-2xl border border-indigo-800/60 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {creatorProfile?.avatarUrl ? (
            <img
              src={creatorProfile.avatarUrl}
              alt={creatorProfile.name}
              className="w-9 h-9 rounded-xl object-cover ring-2 ring-amber-400 shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-indigo-600/90 text-white flex items-center justify-center font-black text-sm shrink-0 border border-indigo-400/40">
              {creatorProfile?.name ? creatorProfile.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white truncate">
                {creatorProfile?.name || 'RonPay User'}
              </span>
              {(() => {
                const role = getUserRole(creatorProfile);
                const meta = ROLE_METAS[role];
                return (
                  <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full uppercase shrink-0 ${meta.badgeColor}`}>
                    {meta.badge}
                  </span>
                );
              })()}
            </div>
            <p className="text-[10px] text-indigo-200/80 truncate">
              {creatorProfile?.orgName || 'Mizoram Community'} • {creatorProfile?.phone ? `+91 ${creatorProfile.phone}` : 'Demo Session'}
            </p>
          </div>
        </div>

        {onOpenLogin && (
          <button
            type="button"
            onClick={onOpenLogin}
            className="bg-white/10 hover:bg-white/20 text-amber-300 hover:text-amber-200 border border-amber-400/30 px-2.5 py-1.5 rounded-xl text-[10.5px] font-black transition cursor-pointer active:scale-95 flex items-center gap-1 shrink-0 whitespace-nowrap shadow-2xs"
          >
            <span>Switch / Login</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

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
        <div className="grid grid-cols-6 gap-1 sm:gap-2 text-center">
          {/* Scan Any QR */}
          <button 
            id="home-quick-scan-btn"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onStartScanner('any');
            }}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs border border-indigo-100">
              <QrCode className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors truncate w-full">
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
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs border border-purple-200 relative">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-purple-900 group-hover:text-purple-600 transition-colors truncate w-full">
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
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs border border-blue-200 relative">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-blue-800 group-hover:text-blue-600 transition-colors truncate w-full">
              Member Roll
            </span>
          </button>

          {/* To Bank Transfer */}
          <button 
            onClick={onShowBankTransfer}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs border border-emerald-100">
              <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 group-hover:text-emerald-600 transition-colors truncate w-full">
              {t.toBank}
            </span>
          </button>

          {/* Create QR */}
          <button 
            onClick={onCreateQRClick}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-xs border border-amber-100 relative">
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
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 group-hover:text-amber-600 transition-colors truncate w-full">
              {t.createQR}
            </span>
          </button>

          {/* Check Balance */}
          <button 
            onClick={onShowBalance}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-50 text-slate-700 rounded-2xl flex items-center justify-center text-base sm:text-lg mb-1 group-hover:bg-slate-700 group-hover:text-white transition-all shadow-xs border border-slate-200">
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 group-hover:text-slate-900 transition-colors truncate w-full">
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

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-xs">
            <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">Total Raised</p>
            <p className="text-sm sm:text-base font-black text-amber-300 mt-1">
              ₹{totalRaised.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-xs">
            <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">Today Txns</p>
            <p className="text-sm sm:text-base font-black text-emerald-300 mt-1">
              {todayCount} Txns
            </p>
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 backdrop-blur-xs">
            <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">Active QRs</p>
            <p className="text-sm sm:text-base font-black text-cyan-300 mt-1">
              {activeQRsCount} LIVE
            </p>
          </div>
        </div>
      </div>

      {/* 2.5 PhonePe TSP & PG V2 Integration Quick Panel */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 p-3.5 rounded-2xl text-white shadow-sm border border-purple-700/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-black shadow-md border border-purple-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-xs text-white">PhonePe PG V2 & TSP</h3>
              <span className="text-[9px] bg-emerald-400 text-emerald-950 font-black px-1.5 py-0.2 rounded font-mono">
                UAT READY
              </span>
            </div>
            <p className="text-[10px] text-purple-200 font-medium">
              MID: <span className="font-mono text-amber-300 font-bold">TSPMIZOPAYUAT</span> • 1% Split Fee
            </p>
          </div>
        </div>

        <button
          onClick={onOpenPhonePePortal}
          className="bg-white hover:bg-purple-50 text-purple-950 font-black px-3 py-1.5 rounded-xl text-[10.5px] transition shadow-xs cursor-pointer active:scale-95 shrink-0"
        >
          View API & Test
        </button>
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

      {/* 5. QR Zawnna & Recent Created QRs Section */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-3">
        {/* Section Header */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                  {language === 'english' ? 'QR Search & Recent QRs' : 'QR Zawnna & Recent QRs'}
                </h3>
                <span className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded-md border border-indigo-100/80">
                  {campaigns.length} {language === 'english' ? 'Total' : 'Awmsa'}
                </span>
              </div>
              <p className="text-[9.5px] text-slate-500 font-medium">
                {language === 'english' 
                  ? 'Instant QR lookup, creator filter & recent campaigns' 
                  : 'QR pil bo tawh leh thar zawng zawng zawn chhuahna awlsam'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={onCreateQRClick}
            className="text-[10px] text-indigo-600 font-bold hover:text-indigo-700 hover:underline flex items-center gap-1 cursor-pointer shrink-0 bg-indigo-50/60 px-2.5 py-1 rounded-lg border border-indigo-100/60 active:scale-95 transition"
          >
            + {language === 'english' ? 'Create QR' : 'Create QR'} <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Search Bar Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text"
            value={qrSearchQuery}
            onChange={(e) => setQrSearchQuery(e.target.value)}
            placeholder={
              language === 'english'
                ? 'Search QR by name, creator, location, or UPI...'
                : 'QR / Bawm hming, vawngtu, hmun, UPI zawng rawh...'
            }
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-semibold text-slate-800 placeholder-slate-400 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition shadow-2xs"
          />
          {qrSearchQuery && (
            <button
              type="button"
              onClick={() => setQrSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition cursor-pointer"
              title="Clear search"
            >
              <CloseIcon className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 pt-0.5 text-[10.5px]">
          <button
            type="button"
            onClick={() => setQrCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1 ${
              qrCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <span>{language === 'english' ? 'All QRs' : 'Zawng zawng'}</span>
            <span className={`text-[9px] px-1 rounded-md ${qrCategoryFilter === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
              {categoryCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQrCategoryFilter('ralna')}
            className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1 ${
              qrCategoryFilter === 'ralna'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <Ribbon className="w-3 h-3 text-rose-500 shrink-0" />
            <span>Ralna</span>
            <span className={`text-[9px] px-1 rounded-md ${qrCategoryFilter === 'ralna' ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
              {categoryCounts.ralna}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQrCategoryFilter('khawlsak')}
            className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1 ${
              qrCategoryFilter === 'khawlsak'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <HandHeart className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Khawlsak</span>
            <span className={`text-[9px] px-1 rounded-md ${qrCategoryFilter === 'khawlsak' ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-200 text-slate-700'}`}>
              {categoryCounts.khawlsak}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQrCategoryFilter('rikrum')}
            className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1 ${
              qrCategoryFilter === 'rikrum'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
            <span>Rikrum</span>
            <span className={`text-[9px] px-1 rounded-md ${qrCategoryFilter === 'rikrum' ? 'bg-rose-800 text-rose-100' : 'bg-slate-200 text-slate-700'}`}>
              {categoryCounts.rikrum}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQrCategoryFilter('kumtluang')}
            className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 cursor-pointer active:scale-95 flex items-center gap-1 ${
              qrCategoryFilter === 'kumtluang'
                ? 'bg-blue-700 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <InfinityIcon className="w-3 h-3 text-blue-400 shrink-0" />
            <span>Kumtluang</span>
            <span className={`text-[9px] px-1 rounded-md ${qrCategoryFilter === 'kumtluang' ? 'bg-blue-800 text-blue-100' : 'bg-slate-200 text-slate-700'}`}>
              {categoryCounts.kumtluang}
            </span>
          </button>
        </div>

        {/* Active Filter Info / Reset Pill */}
        {isSearchingOrFiltered && (
          <div className="flex items-center justify-between bg-indigo-50/70 border border-indigo-100 rounded-xl px-2.5 py-1.5 text-[10px] text-indigo-900">
            <span className="font-semibold truncate">
              {qrSearchQuery ? (
                <>
                  <span className="font-bold">"{qrSearchQuery}"</span> {language === 'english' ? 'atan' : 'atan'} <strong className="font-black text-indigo-700">{filteredQRs.length}</strong> {language === 'english' ? 'QRs found' : 'QR hmuh a ni'}
                </>
              ) : (
                <>
                  Category filter: <strong className="capitalize font-black text-indigo-700">{qrCategoryFilter}</strong> ({filteredQRs.length} QRs)
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                setQrSearchQuery('');
                setQrCategoryFilter('all');
              }}
              className="text-[9.5px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5 shrink-0 ml-2 cursor-pointer"
            >
              <RotateCcw className="w-2.5 h-2.5" /> {language === 'english' ? 'Clear filter' : 'Tifai rawh'}
            </button>
          </div>
        )}

        {/* QRs List */}
        <div className="space-y-2.5">
          {displayedQRs.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/90 text-center space-y-2.5">
              <Search className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-700">
                  {isSearchingOrFiltered 
                    ? (language === 'english' ? 'No QRs match your search' : 'QR zawn hmuh a ni lo') 
                    : (language === 'english' ? 'No QRs created yet' : 'QR Siam a la awm lo')}
                </p>
                <p className="text-[11px] text-slate-500">
                  {isSearchingOrFiltered
                    ? (language === 'english' ? 'Try searching with a different name or clear the filter.' : 'Hming dang emaw category dang thlang la zawng chhin rawh.')
                    : (language === 'english' ? 'Click "+ Create QR" to create a new campaign.' : 'QR Code thar siam turin "+ Create QR" hmet rawh.')}
                </p>
              </div>
              {isSearchingOrFiltered && (
                <button
                  type="button"
                  onClick={() => {
                    setQrSearchQuery('');
                    setQrCategoryFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold shadow-2xs hover:bg-indigo-700 transition cursor-pointer"
                >
                  {language === 'english' ? 'Clear Search & Filters' : 'Filter & Search tifai rawh'}
                </button>
              )}
            </div>
          ) : (
            displayedQRs.map(camp => {
              const isOwner = isCampaignCreator(camp, creatorProfile);
              const campTransactions = transactions.filter(t => t.campaignId === camp.id || t.campaignTitle === camp.title);
              const totalRaised = campTransactions.reduce((sum, t) => sum + t.amount, 0);
              
              const hasTarget = Boolean(camp.targetAmount && camp.targetAmount > 0);
              const target = hasTarget ? camp.targetAmount! : 0;
              const percentage = target > 0 ? Math.round((totalRaised / target) * 100) : 0;
              const clampedPercentage = Math.min(percentage, 100);
              const targetPeriodText = camp.targetPeriod === 'monthly' ? (language === 'english' ? '/m' : '/thla') :
                                       camp.targetPeriod === 'yearly' ? (language === 'english' ? '/yr' : '/kum') : '';

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
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs font-bold ${
                        camp.category === 'ralna' ? 'bg-slate-900 border border-rose-500' :
                        camp.category === 'khawlsak' ? 'bg-emerald-600' :
                        camp.category === 'rikrum' ? 'bg-rose-600' : 'bg-blue-600'
                      }`}>
                        <QrCode className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                            {translateDynamicText(camp.title, language)}
                          </p>
                          <span className={`text-[7.5px] font-black uppercase px-1.5 py-0.2 rounded border ${
                            camp.category === 'ralna' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            camp.category === 'khawlsak' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            camp.category === 'rikrum' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {camp.category}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                          <span className="truncate">{camp.location}</span>
                          {camp.creatorName && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="text-slate-500 truncate">{camp.creatorName}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      {camp.category === 'kumtluang' && (isOwner || canAccessAdminConsole(creatorProfile)) && onOpenMemberRoll && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMemberRoll('members_list', camp.id);
                          }}
                          title="Open Member Roll"
                          className="p-1.5 px-2 rounded-lg bg-blue-600 text-white font-extrabold text-[9px] hover:bg-blue-700 transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
                        >
                          <Users className="w-3 h-3" /> Roll
                        </button>
                      )}

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
                        <p className="text-[8.5px] text-slate-400 font-mono mt-0.5 pr-0.5">
                          {formatDateDDMMYYYY(camp.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Progress Bar Section (Creator Only - Private to campaign creator) */}
                  {isOwner && (
                    <div className="bg-white/95 p-2 rounded-xl border border-indigo-100/90 space-y-1.5 shadow-2xs">
                      {!hasTarget ? (
                        <div className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1 font-bold text-slate-700">
                            <span className="font-black text-slate-900">₹{totalRaised.toLocaleString('en-IN')}</span>
                            <span className="text-slate-500 font-medium">{language === 'english' ? 'Total Collected' : 'Pek tlingkhawm zat'}</span>
                            <span className="text-[7.5px] font-black uppercase text-slate-700 bg-slate-100 border border-slate-200 px-1 py-0.2 rounded ml-1">
                              {language === 'english' ? 'Creator Only' : 'Creator View'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-600 font-bold bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded-md">
                              {campTransactions.length} {campTransactions.length === 1 ? 'txn' : 'txns'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1 font-bold text-slate-700">
                              <span className="font-black text-slate-900">₹{totalRaised.toLocaleString('en-IN')}</span>
                              <span className="text-slate-400 font-normal">/ ₹{target.toLocaleString('en-IN')}{targetPeriodText}</span>
                              <span className="text-[7.5px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded ml-1">
                                {language === 'english' ? 'Creator Goal' : 'Creator View'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-slate-400 font-medium">
                                {campTransactions.length} {campTransactions.length === 1 ? 'txn' : 'txns'}
                              </span>
                              <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-md text-[9.5px]">
                                {percentage}%
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* View All / Toggle Button (When not actively searching and more than 5 QRs exist) */}
        {!isSearchingOrFiltered && filteredQRs.length > 5 && (
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setShowAllQRs(!showAllQRs)}
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200/80 hover:border-indigo-200 text-xs font-bold text-slate-700 hover:text-indigo-600 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 shadow-2xs"
            >
              {showAllQRs ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{language === 'english' ? 'Show Recent 5 Only' : 'Recent 5 chauh ti lang rawh'}</span>
                </>
              ) : (
                <>
                  <span>
                    {language === 'english' 
                      ? `View all ${filteredQRs.length} QRs (${filteredQRs.length - 5} more)` 
                      : `QRs dang ${filteredQRs.length - 5} a la awm • QRs zawng zawng (${filteredQRs.length}) ti lang rawh`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
