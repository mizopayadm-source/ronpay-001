import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  QrCode, 
  MapPin, 
  ExternalLink, 
  Clock, 
  Calendar, 
  ChevronRight,
  ChevronLeft,
  Filter,
  Camera,
  Layers,
  Sparkles,
  Users,
  CheckCircle2,
  Maximize2,
  Share2,
  AlertCircle,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  RotateCcw,
  Ribbon,
  HandHeart,
  AlertTriangle,
  Infinity as InfinityIcon,
  Receipt,
  Compass,
  Check,
  TrendingUp
} from 'lucide-react';
import { BawmCategory, Campaign, Transaction, CreatorProfile } from '../types';
import { BAWM_CONFIG } from '../data/initialData';
import { formatDateDDMMYYYY, isCampaignExpired } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText } from '../utils/translations';
import { isCampaignCreator } from '../utils/storage';

interface BawmExplorerScreenProps {
  category: BawmCategory;
  campaigns: Campaign[];
  transactions?: Transaction[];
  creatorProfile?: CreatorProfile;
  onBack: () => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onStartScanner: (category: BawmCategory) => void;
  onPreviewImage?: (imageUrl: string, title?: string, subtitle?: string, location?: string) => void;
  onShareCampaign?: (campaign: Campaign) => void;
  onCategoryChange?: (category: BawmCategory) => void;
  onOpenMemberRoll?: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports') => void;
  language?: Language;
}

export const BawmExplorerScreen: React.FC<BawmExplorerScreenProps> = ({
  category,
  campaigns,
  transactions = [],
  creatorProfile,
  onBack,
  onSelectCampaign,
  onStartScanner,
  onPreviewImage,
  onShareCampaign,
  onCategoryChange,
  onOpenMemberRoll,
  language = 'mizo',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BawmCategory | 'all'>(category || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'az' | 'urgent'>('newest');
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const t = TRANSLATIONS[language];

  // Update scroll arrow indicators
  const checkScrollPosition = () => {
    const el = categoryScrollRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 6);
    }
  };

  useEffect(() => {
    checkScrollPosition();
    const el = categoryScrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScrollPosition, { passive: true });
      window.addEventListener('resize', checkScrollPosition);
      return () => {
        el.removeEventListener('scroll', checkScrollPosition);
        window.removeEventListener('resize', checkScrollPosition);
      };
    }
  }, []);

  const handleScrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -170 : 170;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(checkScrollPosition, 300);
    }
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: campaigns.length,
      ralna: 0,
      khawlsak: 0,
      rikrum: 0,
      kumtluang: 0,
      others: 0,
    };
    campaigns.forEach((c) => {
      if (counts[c.category] !== undefined) {
        counts[c.category]++;
      }
    });
    return counts;
  }, [campaigns]);

  // Unique locations from currently eligible campaigns
  const availableLocations = useMemo(() => {
    const targetCampaigns = selectedCategory === 'all' 
      ? campaigns 
      : campaigns.filter(c => c.category === selectedCategory);
    
    const locSet = new Set<string>();
    targetCampaigns.forEach(c => {
      if (c.location) {
        const parts = c.location.split(',');
        const mainLoc = parts[0].trim();
        if (mainLoc) locSet.add(mainLoc);
      }
    });
    return Array.from(locSet).sort();
  }, [campaigns, selectedCategory]);

  // Handle category selection
  const handleCategorySelect = (catKey: BawmCategory | 'all') => {
    setSelectedCategory(catKey);
    setFilterLocation('all');
    if (catKey !== 'all' && onCategoryChange) {
      onCategoryChange(catKey);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterLocation('all');
    setFilterStatus('all');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || filterLocation !== 'all' || filterStatus !== 'all' || sortBy !== 'newest';

  // Filtered & Sorted campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      // 1. Category filter
      if (selectedCategory !== 'all' && c.category !== selectedCategory) {
        return false;
      }

      // 2. Status filter
      const expired = isCampaignExpired(c.validityDate, c.status);
      if (filterStatus === 'active' && expired) {
        return false;
      }
      if (filterStatus === 'expired' && !expired) {
        return false;
      }

      // 3. Location filter
      if (filterLocation !== 'all' && !c.location.toLowerCase().includes(filterLocation.toLowerCase())) {
        return false;
      }

      // 4. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesSubtitle = c.subTitle ? c.subTitle.toLowerCase().includes(q) : false;
        const matchesLoc = c.location.toLowerCase().includes(q);
        const matchesMitthi = c.mitthiHming ? c.mitthiHming.toLowerCase().includes(q) : false;
        const matchesCause = c.cause ? c.cause.toLowerCase().includes(q) : false;
        const matchesOrg = c.orgName ? c.orgName.toLowerCase().includes(q) : false;
        const matchesEmergency = c.emergencyTitle ? c.emergencyTitle.toLowerCase().includes(q) : false;
        const matchesUpi = c.upiId ? c.upiId.toLowerCase().includes(q) : false;
        const matchesId = c.id.toLowerCase().includes(q);
        const matchesSubCats = c.subCategories ? c.subCategories.some(sub => sub.toLowerCase().includes(q)) : false;

        if (!matchesTitle && !matchesSubtitle && !matchesLoc && !matchesMitthi && !matchesCause && !matchesOrg && !matchesEmergency && !matchesUpi && !matchesId && !matchesSubCats) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'az') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'urgent') {
        const aUrgent = a.category === 'rikrum' || a.urgencyLevel === 'URGENT' || a.urgencyLevel === 'CRITICAL' ? 1 : 0;
        const bUrgent = b.category === 'rikrum' || b.urgencyLevel === 'URGENT' || b.urgencyLevel === 'CRITICAL' ? 1 : 0;
        if (aUrgent !== bUrgent) return bUrgent - aUrgent;
      }
      // Default: newest first by createdAt or validityDate
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [campaigns, selectedCategory, filterStatus, filterLocation, searchQuery, sortBy]);

  const openGoogleMaps = (e: React.MouseEvent, coords: string) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(coords || '23.7271, 92.7176')}`, '_blank');
  };

  const handleImageClick = (e: React.MouseEvent, camp: Campaign) => {
    e.stopPropagation();
    if (camp.imageUrl && onPreviewImage) {
      onPreviewImage(
        camp.imageUrl, 
        camp.title, 
        camp.mitthiHming ? `Mitthi: ${camp.mitthiHming} (${camp.age || 70} yrs)` : camp.cause || camp.orgName, 
        camp.location
      );
    }
  };

  const handleShareClick = (e: React.MouseEvent, camp: Campaign) => {
    e.stopPropagation();
    if (onShareCampaign) {
      onShareCampaign(camp);
    }
  };

  const activeCategoryConfig = selectedCategory !== 'all' ? BAWM_CONFIG[selectedCategory] : null;

  // Category Icon helper
  const renderCategoryIcon = (catKey: BawmCategory | 'all', className: string = 'w-3.5 h-3.5') => {
    switch (catKey) {
      case 'ralna':
        return <Ribbon className={className} />;
      case 'khawlsak':
        return <HandHeart className={className} />;
      case 'rikrum':
        return <AlertTriangle className={className} />;
      case 'kumtluang':
        return <InfinityIcon className={className} />;
      case 'others':
        return <Receipt className={className} />;
      default:
        return <Compass className={className} />;
    }
  };

  const categoriesList: { key: BawmCategory | 'all'; label: string; count: number }[] = [
    { key: 'all', label: language === 'english' ? 'All Bawm' : 'Bawm Zawng2', count: categoryCounts.all },
    { key: 'ralna', label: 'Ralna (Chhiatni)', count: categoryCounts.ralna },
    { key: 'khawlsak', label: 'Khawlsak (Tanpuina)', count: categoryCounts.khawlsak },
    { key: 'rikrum', label: 'Rikrum (Emergency)', count: categoryCounts.rikrum },
    { key: 'kumtluang', label: 'Kumtluang (Kohhran/NGO)', count: categoryCounts.kumtluang },
    { key: 'others', label: 'Others (Bills)', count: categoryCounts.others },
  ];

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 hover:text-indigo-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {language === 'english' ? 'Back to Home' : 'In lamah let leh rawh'}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[9.5px] uppercase font-black px-2.5 py-1 rounded-md border bg-white text-slate-900 border-slate-300 shadow-2xs">
            {selectedCategory === 'all' ? (language === 'english' ? 'Community Directory' : 'Bawm Khawmpui Directory') : `${activeCategoryConfig?.name} Hub`}
          </span>
        </div>
      </div>

      {/* Category Filter Tabs / Pills with Horizontal Scrolling */}
      <div className="space-y-1.5 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" /> {language === 'english' ? 'Bawm Category Filter' : 'Bawm Category Thliarna'}
          </label>
          <div className="flex items-center gap-1.5">
            <span className="text-[9.5px] text-slate-500 font-bold hidden sm:inline">
              {campaigns.length} Total Campaigns
            </span>
            {/* Scroll Navigation Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleScrollCategories('left')}
                disabled={!canScrollLeft}
                aria-label="Scroll categories left"
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition cursor-pointer ${
                  canScrollLeft
                    ? 'bg-white text-slate-800 border-slate-300 shadow-2xs hover:bg-slate-100 active:scale-95'
                    : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleScrollCategories('right')}
                disabled={!canScrollRight}
                aria-label="Scroll categories right"
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition cursor-pointer ${
                  canScrollRight
                    ? 'bg-white text-slate-800 border-slate-300 shadow-2xs hover:bg-slate-100 active:scale-95'
                    : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                }`}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Category Row */}
        <div className="relative">
          <div 
            ref={categoryScrollRef}
            className="flex items-center gap-2 overflow-x-auto scroll-smooth flex-nowrap pb-2 pt-1 px-1 touch-pan-x select-none scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-slate-100"
          >
            {categoriesList.map((catItem) => {
              const isSelected = selectedCategory === catItem.key;
              return (
                <button
                  key={catItem.key}
                  type="button"
                  onClick={(e) => {
                    handleCategorySelect(catItem.key);
                    (e.currentTarget as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs border whitespace-nowrap active:scale-95 ${
                    isSelected
                      ? catItem.key === 'ralna'
                        ? 'bg-slate-950 text-white border-slate-900 ring-2 ring-red-500/50 shadow-md'
                        : catItem.key === 'khawlsak'
                        ? 'bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-500/50 shadow-md'
                        : catItem.key === 'rikrum'
                        ? 'bg-rose-700 text-white border-rose-800 ring-2 ring-rose-500/50 shadow-md'
                        : catItem.key === 'kumtluang'
                        ? 'bg-indigo-700 text-white border-indigo-800 ring-2 ring-indigo-500/50 shadow-md'
                        : catItem.key === 'others'
                        ? 'bg-purple-700 text-white border-purple-800 ring-2 ring-purple-500/50 shadow-md'
                        : 'bg-indigo-900 text-white border-indigo-950 ring-2 ring-indigo-500/50 shadow-md'
                      : 'bg-white hover:bg-slate-100/90 text-slate-700 border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {renderCategoryIcon(catItem.key, 'w-3.5 h-3.5 shrink-0')}
                  <span>{catItem.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {catItem.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Hero / Summary Banner */}
      {selectedCategory !== 'all' && activeCategoryConfig ? (
        <div className={`p-4 rounded-2xl border text-slate-800 shadow-xs relative overflow-hidden ${
          selectedCategory === 'ralna' ? 'bg-gradient-to-br from-white via-slate-50 to-red-50/50 border-2 border-slate-200/90' :
          selectedCategory === 'khawlsak' ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/80 border-emerald-200' :
          selectedCategory === 'rikrum' ? 'bg-gradient-to-br from-rose-50 to-rose-100/80 border-rose-200' :
          selectedCategory === 'kumtluang' ? 'bg-gradient-to-br from-blue-50 to-blue-100/80 border-blue-200' :
          'bg-gradient-to-br from-purple-50 to-purple-100/80 border-purple-200'
        }`}>
          {/* YMA Tri-color accent for Ralna */}
          {selectedCategory === 'ralna' && (
            <div className="absolute top-0 right-0 overflow-hidden rounded-bl-lg border-l border-b border-slate-200">
              <div className="flex h-3 w-14">
                <div className="flex-1 bg-black" />
                <div className="flex-1 bg-white border-x border-slate-200" />
                <div className="flex-1 bg-red-600" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="font-black text-sm text-slate-900">{activeCategoryConfig.name}</h2>
                {selectedCategory === 'ralna' && (
                  <span className="text-[8px] bg-red-100 text-red-700 font-extrabold px-1.5 py-0.2 rounded border border-red-200 uppercase">
                    YMA PUAL
                  </span>
                )}
              </div>
              <p className="text-[10px] font-medium text-slate-600 truncate">{activeCategoryConfig.subtitle}</p>
              <p className="text-[9.5px] font-bold pt-0.5 text-slate-500">
                Active Verified QRs: <span className="font-black text-slate-900">{categoryCounts[selectedCategory]}</span>
              </p>
            </div>

            {selectedCategory === 'kumtluang' && onOpenMemberRoll && (
              <button
                type="button"
                onClick={() => onOpenMemberRoll('members_list')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-2 rounded-xl text-[10.5px] border border-indigo-500 shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
              >
                <Users className="w-3.5 h-3.5" /> {language === 'english' ? 'Member Roll & Statements' : 'Member Roll & Statement'}
              </button>
            )}

            <button
              onClick={() => onStartScanner(selectedCategory)}
              className={`${
                selectedCategory === 'ralna' ? 'bg-red-600 hover:bg-red-700 text-white border-red-500' : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200/90'
              } px-3 py-2 rounded-xl text-[10.5px] font-bold border shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0`}
            >
              <Camera className="w-3.5 h-3.5" /> {language === 'english' ? 'Scan This Bawm' : 'Hei hi Scan Rawh'}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3.5 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-800/80 shadow-xs flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <h2 className="font-black text-xs text-white truncate">
                {language === 'english' ? 'All Community Bawm Directory' : 'Mizoram Community Bawm Hrang Hrang'}
              </h2>
            </div>
            <p className="text-[10.5px] text-slate-300 line-clamp-1">
              {language === 'english' ? 'Explore and contribute to verified causes across all Mizoram districts' : 'Mizoram puma chhiatni, tanpuina, rikrum leh Kohhran bawm verified-te zawnna'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onOpenMemberRoll && (
              <button
                type="button"
                onClick={() => onOpenMemberRoll('members_list')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-[10.5px] border border-blue-500 shadow-xs flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0"
              >
                <Users className="w-3.5 h-3.5" /> Member Roll
              </button>
            )}
            <span className="text-[10px] bg-amber-400/20 text-amber-300 font-extrabold px-2.5 py-1 rounded-lg border border-amber-400/30 shrink-0">
              {filteredCampaigns.length} Active
            </span>
          </div>
        </div>
      )}

      {/* Advanced Search Engine & Filter Control Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-indigo-600" /> 
            {selectedCategory === 'all' 
              ? (language === 'english' ? 'Search All Campaigns' : 'Campaign Hrang Hrang Zawnna') 
              : `Search ${activeCategoryConfig?.name} Directory`}
          </label>
          <span className="text-[9px] text-slate-400 font-bold">
            Showing {filteredCampaigns.length} of {campaigns.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              selectedCategory === 'ralna' 
                ? (language === 'english' ? 'Search deceased name, locality, cause...' : 'Mitthi hming, veng, chhiatni hming...')
                : selectedCategory === 'kumtluang'
                ? (language === 'english' ? 'Search Church, NGO, locality, purpose...' : 'Kohhran, Pawl, NGO, Veng, Inkhawm...')
                : (language === 'english' ? 'Search campaign title, locality, cause, UPI ID...' : 'Title, Veng, Chhan, UPI ID, Emergency...')
            }
            className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-8.5 pr-8 text-xs font-bold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Filters Row: Locality, Status, Sort */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Locality Filter */}
          <div>
            <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">
              {language === 'english' ? 'Locality / Veng' : 'Veng-te Thliarna'}
            </label>
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            >
              <option value="all">{language === 'english' ? 'All Localities' : 'Veng-te: All Locations'}</option>
              {availableLocations.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">
              {language === 'english' ? 'Status' : 'Pek Theih Dinhmun'}
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            >
              <option value="all">{language === 'english' ? 'All Status' : 'Dinhmun: All'}</option>
              <option value="active">{language === 'english' ? 'Active Only (Live)' : 'Active / Pek theih lai'}</option>
              <option value="expired">{language === 'english' ? 'Expired / Closed' : 'Hun tawp tawh'}</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="text-[9.5px] font-bold text-slate-500 block mb-0.5">
              {language === 'english' ? 'Sort By' : 'Rem Dan'}
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'az' | 'urgent')}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            >
              <option value="newest">{language === 'english' ? 'Newest First' : 'A Thar Ber Hmasa'}</option>
              <option value="az">{language === 'english' ? 'Name (A to Z)' : 'Hming Indawt (A - Z)'}</option>
              <option value="urgent">{language === 'english' ? 'Urgent / Priority' : 'Hmanhmawh Thlak Ber'}</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Chips & Reset Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-1 text-[10px]">
              <span className="text-slate-400 font-bold">Active filters:</span>
              {searchQuery && (
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-indigo-200">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery('')} className="cursor-pointer hover:text-indigo-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filterLocation !== 'all' && (
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-slate-200">
                  Location: {filterLocation}
                  <button onClick={() => setFilterLocation('all')} className="cursor-pointer hover:text-slate-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {filterStatus !== 'all' && (
                <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-amber-200">
                  Status: {filterStatus}
                  <button onClick={() => setFilterStatus('all')} className="cursor-pointer hover:text-amber-950"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
              {sortBy !== 'newest' && (
                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-blue-200">
                  Sort: {sortBy}
                  <button onClick={() => setSortBy('newest')} className="cursor-pointer hover:text-blue-900"><X className="w-2.5 h-2.5" /></button>
                </span>
              )}
            </div>

            <button
              onClick={handleResetFilters}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer transition ml-auto"
            >
              <RotateCcw className="w-3 h-3" /> {language === 'english' ? 'Reset Filters' : 'Filter Siamtha'}
            </button>
          </div>
        )}
      </div>

      {/* Directory List of Active QRs */}
      <div className="space-y-3">
        {filteredCampaigns.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-800">
                {language === 'english' ? 'No Campaigns Found' : 'Campaign Hmuh A Ni Lo'}
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                {language === 'english' 
                  ? `No matching campaigns found for your search and filter criteria. Try adjusting keywords or clearing category/location filters.` 
                  : `I thil zawn leh filter thlanna nen inmil a awm rih lo. Zawn dan thlak la emaw filter tihtawp hian i hmu thei ang.`}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer active:scale-95 shadow-xs inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> {language === 'english' ? 'Clear All Filters' : 'Filter Zawng Zawng Tihtawp'}
              </button>
            )}
          </div>
        ) : (
          filteredCampaigns.map((camp) => {
            const expired = isCampaignExpired(camp.validityDate, camp.status);
            const translatedTitle = translateDynamicText(camp.title, language);
            const translatedCause = translateDynamicText(camp.cause, language);
            const campConfig = BAWM_CONFIG[camp.category] || BAWM_CONFIG.others;
            const isCampRalna = camp.category === 'ralna';

            // Check if active user is the creator of this specific campaign (Ama Create chauh)
            const isOwner = isCampaignCreator(camp, creatorProfile);

            // Campaign Transactions & Progress calculation (Private to creator)
            const campTransactions = transactions.filter(t => t.campaignId === camp.id || t.campaignTitle === camp.title);
            const totalRaised = campTransactions.reduce((sum, t) => sum + t.amount, 0);
            
            const hasTarget = Boolean(camp.targetAmount && camp.targetAmount > 0);
            const target = hasTarget ? camp.targetAmount! : 0;
            const percentage = target > 0 ? Math.round((totalRaised / target) * 100) : 0;
            const clampedPercentage = Math.min(percentage, 100);
            const targetPeriodText = camp.targetPeriod === 'monthly' ? (language === 'english' ? '/month' : '/thla') :
                                     camp.targetPeriod === 'yearly' ? (language === 'english' ? '/year' : '/kum') : '';

            const progressColor = 
              camp.category === 'khawlsak' ? 'bg-emerald-500' :
              camp.category === 'rikrum' ? 'bg-rose-500' :
              camp.category === 'kumtluang' ? 'bg-blue-600' :
              camp.category === 'ralna' ? 'bg-slate-900' : 'bg-indigo-600';

            return (
              <div
                key={camp.id}
                onClick={() => onSelectCampaign(camp)}
                className={`bg-white p-3.5 rounded-2xl border shadow-xs hover:shadow-md transition cursor-pointer space-y-2.5 group ${
                  expired ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/90 hover:border-indigo-400'
                }`}
              >
                <div className="flex gap-3">
                  {/* Clickable Photo to Enlarge or Category Icon */}
                  {camp.imageUrl ? (
                    <div 
                      onClick={(e) => handleImageClick(e, camp)}
                      className="relative group/img cursor-zoom-in shrink-0"
                      title="Click to view full photo"
                    >
                      <img
                        src={camp.imageUrl}
                        alt={camp.title}
                        referrerPolicy="no-referrer"
                        className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl object-cover border border-slate-200 shadow-xs group-hover/img:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-4 h-4 drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl flex items-center justify-center font-black text-xl text-white shadow-xs shrink-0 ${
                      isCampRalna ? 'bg-red-600 border border-red-500 text-white' :
                      camp.category === 'khawlsak' ? 'bg-emerald-600' :
                      camp.category === 'rikrum' ? 'bg-rose-600' :
                      camp.category === 'kumtluang' ? 'bg-blue-600' :
                      'bg-purple-600'
                    }`}>
                      {renderCategoryIcon(camp.category, 'w-7 h-7 sm:w-8 sm:h-8')}
                    </div>
                  )}

                  {/* Campaign Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase shrink-0 ${
                          isCampRalna ? 'bg-slate-900 text-white' :
                          camp.category === 'khawlsak' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          camp.category === 'rikrum' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          camp.category === 'kumtluang' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {campConfig.name}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-xs truncate group-hover:text-indigo-600 transition-colors">
                          {translatedTitle}
                        </h3>
                      </div>

                      <span className={`text-[8px] font-black px-1.5 py-0.2 rounded uppercase shrink-0 ${
                        expired 
                          ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {expired ? (language === 'english' ? 'EXPIRED' : 'HUN A TAWP') : (language === 'english' ? 'LIVE' : 'ACTIVE')}
                      </span>
                    </div>

                    {camp.mitthiHming && (
                      <p className="text-[10px] text-slate-600 font-medium">
                        {language === 'english' ? 'Deceased' : 'Mitthi'}: <span className="font-bold text-slate-800">{camp.mitthiHming}</span> ({language === 'english' ? `Age ${camp.age || 70}` : `Kum ${camp.age || 70}`})
                      </p>
                    )}

                    {camp.orgName && (
                      <p className="text-[10px] text-indigo-700 font-bold">
                        {camp.orgName}
                      </p>
                    )}

                    {camp.cause && (
                      <p className="text-[10px] text-slate-600 line-clamp-1 font-medium">
                        {translatedCause}
                      </p>
                    )}

                    {camp.emergencyTitle && (
                      <p className="text-[10px] text-rose-700 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" /> {camp.emergencyTitle}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-0.5 flex-wrap gap-1">
                      <button
                        onClick={(e) => openGoogleMaps(e, camp.gpsCoords)}
                        className="text-[9.5px] font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" /> {camp.location}
                      </button>

                      <span className="text-[9px] font-bold text-slate-400">
                        {language === 'english' ? 'Validity' : 'Hun tawp'}: {formatDateDDMMYYYY(camp.validityDate)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Visual Progress Bar Section (Creator Only - Private to campaign creator) */}
                {isOwner && (
                  <div className="bg-slate-50/95 p-2.5 rounded-xl border border-indigo-100 space-y-1.5 shadow-2xs">
                    {!hasTarget ? (
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <TrendingUp className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                          <span className="font-black text-slate-900 text-xs">
                            ₹{totalRaised.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {language === 'english' ? 'Total collected' : 'Pek tlingkhawm zat'}
                          </span>
                          <span className="text-[7.5px] font-black uppercase text-slate-700 bg-slate-200 border border-slate-300 px-1 py-0.2 rounded ml-1">
                            {language === 'english' ? 'Creator Only' : 'Creator View'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9.5px] text-slate-600 font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                            {campTransactions.length} {campTransactions.length === 1 ? 'txn' : 'txns'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="font-black text-slate-900 text-xs">
                              ₹{totalRaised.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {language === 'english' 
                                ? `of ₹${target.toLocaleString('en-IN')}${targetPeriodText} goal` 
                                : `tling tawh (Target: ₹${target.toLocaleString('en-IN')}${targetPeriodText})`}
                            </span>
                            <span className="text-[7.5px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded ml-1">
                              {language === 'english' ? 'Creator Only' : 'Creator View'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9.5px] text-slate-400 font-medium">
                              {campTransactions.length} {campTransactions.length === 1 ? 'txn' : 'txns'}
                            </span>
                            <span className="text-[9.5px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                              {percentage}% {language === 'english' ? 'Reached' : 'Tling'}
                            </span>
                          </div>
                        </div>

                        {/* Progress Track */}
                        <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden border border-slate-200/40">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                            style={{ width: `${clampedPercentage}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Action Strip with Share QR & 'Pekna-ah lut rawh' */}
                <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10.5px] flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 font-medium font-mono text-[9.5px] truncate max-w-[120px] sm:max-w-none">
                      UPI: {camp.upiId}
                    </span>
                    <button
                      onClick={(e) => handleShareClick(e, camp)}
                      className="p-1 px-2 text-[9.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition cursor-pointer border border-indigo-200 shadow-2xs shrink-0"
                      title="Share QR code"
                    >
                      <Share2 className="w-3 h-3" /> {t.share}
                    </button>
                    {camp.category === 'kumtluang' && (isOwner || creatorProfile?.isAdmin) && onOpenMemberRoll && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenMemberRoll('members_list');
                        }}
                        className="p-1 px-2 text-[9.5px] font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs shrink-0 active:scale-95"
                        title="Open Member Roll"
                      >
                        <Users className="w-3 h-3" /> Roll
                      </button>
                    )}
                  </div>

                  {expired ? (
                    <span className="font-extrabold text-rose-600 flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3.5 h-3.5" /> {language === 'english' ? 'Contribution Closed' : 'Pek hun a tawp'}
                    </span>
                  ) : (
                    <span className="font-extrabold text-indigo-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform shrink-0">
                      {language === 'english' ? 'Proceed to Contribute' : 'Pekna-ah lut rawh'} <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
