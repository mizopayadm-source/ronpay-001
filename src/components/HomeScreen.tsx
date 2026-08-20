import React, { useState, useEffect, useRef } from 'react';
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
  ExternalLink,
  ArrowRight,
  Pause,
  Play
} from 'lucide-react';
import { BawmCategory, Campaign, Transaction, BillService, CreatorProfile, AnnouncementBanner, AnnouncementItem } from '../types';
import { BILL_SERVICES } from '../data/initialData';
import { formatDateDDMMYYYY, getCreatorExpiryStatus } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText } from '../utils/translations';
import { isCampaignCreator, DEFAULT_ANNOUNCEMENT_ITEMS } from '../utils/storage';
import { Megaphone, X as CloseIcon } from 'lucide-react';

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
  onShowBalance: () => void;
  onShowBankTransfer: () => void;
  onOpenPhonePePortal?: () => void;
  onSelectCampaign?: (campaign: Campaign) => void;
  language?: Language;
  onOpenHistory?: () => void;
  onShareCampaign?: (campaign: Campaign) => void;
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
  onShowBalance,
  onShowBankTransfer,
  onOpenPhonePePortal,
  onSelectCampaign,
  language = 'mizo',
  onOpenHistory,
  onShareCampaign,
}) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.mizo;
  const [isAnnouncementDismissed, setIsAnnouncementDismissed] = useState<boolean>(false);
  const [currentAnnounceIdx, setCurrentAnnounceIdx] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

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
    if (action === 'action_bawm_explorer') {
      onSelectBawm('ralna');
    } else if (action === 'action_bill_payment') {
      const el = document.getElementById('quick-bill-recharge-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else if (BILL_SERVICES.length > 0) {
        onOpenBillService(BILL_SERVICES[0]);
      }
    } else if (action === 'action_creator_studio') {
      onCreateQRClick();
    } else if (action === 'action_kumtluang') {
      onSelectBawm('kumtluang');
    } else if (action.startsWith('http://') || action.startsWith('https://')) {
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

  // Recent Created QRs (Latest 5 campaigns sorted by creation or active)
  const recentCreatedQRs = campaigns.slice(0, 5);

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* Admin Custom Live Rotating Announcement Banner */}
      {announcement && announcement.isActive && !isAnnouncementDismissed && bannerItems.length > 0 && (
        <div 
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className={`p-3.5 sm:p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all text-white ${
            activeItem.type === 'urgent'
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-red-500 shadow-red-200/50'
              : activeItem.type === 'info'
              ? 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 border-indigo-500 shadow-indigo-200/50'
              : activeItem.type === 'notice'
              ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-amber-500 shadow-amber-200/50'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 border-emerald-500 shadow-emerald-200/50'
          } ${animationStyle === 'pulse' ? 'animate-pulse' : ''}`}
        >
          {/* Top Row: Icon, Type Badge, Counter, Navigation & Close */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="p-1.5 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs mt-0.5 shadow-2xs">
                <Megaphone className="w-4 h-4 text-white" />
              </span>
              
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[8.5px] font-black uppercase px-2 py-0.2 rounded-full bg-white/25 text-white tracking-wider">
                    {activeItem.badge || activeItem.type || 'NOTICE'}
                  </span>
                  
                  {bannerItems.length > 1 && (
                    <span className="text-[8.5px] font-mono font-bold bg-black/25 text-white/90 px-1.5 py-0.2 rounded-full">
                      {currentAnnounceIdx + 1}/{bannerItems.length}
                    </span>
                  )}

                  {animationStyle === 'marquee' && (
                    <span className="text-[8px] bg-amber-400 text-slate-950 font-black uppercase px-1 rounded-sm">
                      Ticker
                    </span>
                  )}
                </div>

                {/* Animated Body Content */}
                {animationStyle === 'marquee' ? (
                  <div className="overflow-hidden whitespace-nowrap py-0.5">
                    <div className="inline-block animate-marquee font-bold text-xs">
                      <span className="text-amber-200 mr-2">[{activeItem.title}]</span>
                      <span>{activeItem.message}</span>
                    </div>
                  </div>
                ) : (
                  <div className={`transition-all duration-300 ${
                    animationStyle === 'fade' ? 'animate-fadeIn' : 
                    animationStyle === 'slide' ? 'animate-fadeIn' : ''
                  }`}>
                    <h4 className="text-xs sm:text-sm font-black tracking-wide leading-tight text-white drop-shadow-xs">
                      {activeItem.title}
                    </h4>
                    <p className="text-[11px] sm:text-xs text-white/95 leading-snug mt-0.5">
                      {activeItem.message}
                    </p>
                  </div>
                )}

                {/* Optional Action Button / Link */}
                {activeItem.linkText && (
                  <div className="pt-1">
                    <button
                      onClick={() => handleActionLink(activeItem.linkAction)}
                      className="inline-flex items-center gap-1 bg-white text-slate-900 hover:bg-amber-300 hover:text-slate-950 font-black text-[10.5px] px-2.5 py-1 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                    >
                      <span>{activeItem.linkText}</span>
                      <ArrowRight className="w-3 h-3 text-slate-700" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Controls: Prev/Next & Dismiss */}
            <div className="flex items-center gap-1 shrink-0">
              {bannerItems.length > 1 && (
                <div className="flex items-center bg-black/20 rounded-xl p-0.5 backdrop-blur-xs">
                  <button
                    onClick={handlePrevAnnounce}
                    className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                    title="Previous announcement"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                    title={isPaused ? "Play auto-rotation" : "Pause auto-rotation"}
                  >
                    {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={handleNextAnnounce}
                    className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
                    title="Next announcement"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                onClick={() => setIsAnnouncementDismissed(true)}
                className="p-1.5 rounded-xl bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition cursor-pointer"
                title="Dismiss announcement"
              >
                <CloseIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Dots Indicator for multiple items */}
          {bannerItems.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2 mt-1 border-t border-white/15">
              {bannerItems.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentAnnounceIdx(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    currentAnnounceIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                  title={`Go to item ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
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
        <div className="grid grid-cols-4 gap-2 text-center">
          {/* Scan Any QR */}
          <button 
            onClick={() => onStartScanner('any')}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-lg mb-1.5 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs border border-indigo-100">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[10.5px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors truncate w-full">
              {t.scanQR}
            </span>
          </button>

          {/* To Bank Transfer */}
          <button 
            onClick={onShowBankTransfer}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-lg mb-1.5 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-xs border border-emerald-100">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[10.5px] font-bold text-slate-700 group-hover:text-emerald-600 transition-colors truncate w-full">
              {t.toBank}
            </span>
          </button>

          {/* Create QR */}
          <button 
            onClick={onCreateQRClick}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform relative"
          >
            <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-lg mb-1.5 group-hover:bg-amber-500 group-hover:text-white transition-all shadow-xs border border-amber-100 relative">
              <PlusCircle className="w-5 h-5" />
              {creatorProfile.isApproved && (() => {
                const exp = getCreatorExpiryStatus(creatorProfile);
                if (exp.isExpiringSoon || exp.isExpired) {
                  return (
                    <span 
                      title={exp.isExpired ? "Creator Trial/Plan Expired" : `Expiring in ${exp.daysRemaining} days!`}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" 
                    />
                  );
                }
                return null;
              })()}
            </div>
            <span className="text-[10.5px] font-bold text-slate-700 group-hover:text-amber-600 transition-colors truncate w-full">
              {t.createQR}
            </span>
          </button>

          {/* Check Balance */}
          <button 
            onClick={onShowBalance}
            className="flex flex-col items-center group cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-lg mb-1.5 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs border border-blue-100">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[10.5px] font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate w-full">
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
          <button
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
            <div className="flex items-center justify-between w-full">
              <span className="text-[9px] text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-blue-200">
                <Search className="w-2.5 h-2.5" /> Browse & Select Heads
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </button>
        </div>
      </div>

      {/* 4. Recharge & Bill Payments Section */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-2.5">
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
        <div className="overflow-x-auto pb-1.5 pt-0.5 -mx-1 px-1 scroll-smooth">
          <div className="flex gap-2 sm:gap-3 min-w-max">
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

      {/* 5. Recent Created QRs Section (Replaces Recent Transactions as requested) */}
      <div className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-200/80 space-y-2.5">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <h3 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
              Recent Created QRs
            </h3>
          </div>
          <button 
            onClick={onCreateQRClick}
            className="text-[10px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            + Create / Manage QRs <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2.5">
          {recentCreatedQRs.map(camp => {
            const isOwner = isCampaignCreator(camp, creatorProfile);
            const campTransactions = transactions.filter(t => t.campaignId === camp.id || t.campaignTitle === camp.title);
            const totalRaised = campTransactions.reduce((sum, t) => sum + t.amount, 0);
            const target = camp.targetAmount || (
              camp.category === 'ralna' ? 25000 :
              camp.category === 'khawlsak' ? 50000 :
              camp.category === 'rikrum' ? 100000 :
              camp.category === 'kumtluang' ? 100000 : 50000
            );
            const percentage = target > 0 ? Math.round((totalRaised / target) * 100) : 0;
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
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs font-bold ${
                      camp.category === 'ralna' ? 'bg-slate-900 border border-rose-500' :
                      camp.category === 'khawlsak' ? 'bg-emerald-600' :
                      camp.category === 'rikrum' ? 'bg-rose-600' : 'bg-blue-600'
                    }`}>
                      <QrCode className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                        {translateDynamicText(camp.title, language)}
                      </p>
                      <p className="text-[9.5px] text-slate-500 font-medium flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                        <span className="truncate">{camp.location}</span>
                      </p>
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

                    <div className="text-right">
                      <span className="text-[9.5px] font-black text-indigo-600 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                        {language === 'mizo' ? 'Pekna' : 'Contribute'} <ChevronRight className="w-3 h-3" />
                      </span>
                      <p className="text-[8.5px] text-slate-400 font-mono mt-0.5">
                        {formatDateDDMMYYYY(camp.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar Section (Creator Only - Private to campaign creator) */}
                {isOwner && (
                  <div className="bg-white/95 p-2 rounded-xl border border-indigo-100/90 space-y-1.5 shadow-2xs">
                    {camp.category === 'ralna' ? (
                      <div className="flex items-center justify-between text-[10px]">
                        <div className="flex items-center gap-1 font-bold text-slate-700">
                          <span className="font-black text-slate-900">₹{totalRaised.toLocaleString('en-IN')}</span>
                          <span className="text-slate-500 font-medium">Pek tlingkhawm zat</span>
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
                            <span className="text-slate-400 font-normal">/ ₹{target.toLocaleString('en-IN')}</span>
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
          })}
        </div>
      </div>
    </div>
  );
};
