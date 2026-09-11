import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  ShieldCheck, 
  MapPin, 
  Sparkles, 
  ArrowRight, 
  ExternalLink, 
  Calendar, 
  AlertCircle, 
  Search, 
  User, 
  Users, 
  UserPlus, 
  UserCheck, 
  Check, 
  RotateCcw, 
  Building, 
  CreditCard,
  Plus,
  Coins,
  Zap
} from 'lucide-react';
import { Campaign, MemberRecord, MemberDependent } from '../types';
import { createUPIPaymentString } from '../utils/qr';
import { formatDateDDMMYYYY, isCampaignExpired } from '../utils/date';
import { getMembers } from '../utils/storage';
import { Language, translateCampaignCause } from '../utils/translations';

interface ExternalUPILandingModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  language?: Language;
  onClose: () => void;
  onProceedRonPay: (campaign: Campaign) => void;
}

const DEFAULT_KUMTLUANG_SUBCATS = [
  'Biak In Sakna',
  'Ramthianghlim',
  'Synod Mission',
  'Kohhran Hmeichhia',
  'Tualchhung / General'
];

const MONTHS_LIST = [
  'January 2026', 'February 2026', 'March 2026', 'April 2026', 
  'May 2026', 'June 2026', 'July 2026', 'August 2026', 
  'September 2026', 'October 2026', 'November 2026', 'December 2026',
  'January 2027', 'February 2027', 'March 2027'
];

export const ExternalUPILandingModal: React.FC<ExternalUPILandingModalProps> = ({
  isOpen,
  campaign,
  language = 'mizo',
  onClose,
  onProceedRonPay,
}) => {
  const isKumtluang = campaign?.category === 'kumtluang';

  // Member search & selection state
  const [memberMode, setMemberMode] = useState<'search' | 'guest'>('search');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string>('primary'); // 'primary' or dependent id
  
  // Guest inputs
  const [guestName, setGuestName] = useState<string>('');
  const [guestPhone, setGuestPhone] = useState<string>('');
  const [guestSection, setGuestSection] = useState<string>('Tualchhung');

  // Month / Period selector
  const [selectedMonth, setSelectedMonth] = useState<string>('August 2026');

  // Dynamic category amounts
  const [categoryAmounts, setCategoryAmounts] = useState<{ [categoryName: string]: number }>({});

  // Non-kumtluang generic donation amount
  const [genericAmount, setGenericAmount] = useState<number>(() => {
    if (campaign?.customAmount && campaign.customAmount > 0) return campaign.customAmount;
    if (campaign?.targetAmount && campaign.targetAmount > 0) return campaign.targetAmount;
    return 200;
  });
  const [genericDonorName, setGenericDonorName] = useState<string>('');

  // Load members list
  const [allMembers, setAllMembers] = useState<MemberRecord[]>([]);

  useEffect(() => {
    if (campaign && isOpen) {
      const explicitAmt = (campaign.customAmount && campaign.customAmount > 0)
        ? campaign.customAmount
        : (campaign.targetAmount && campaign.targetAmount > 0)
        ? campaign.targetAmount
        : null;
      if (explicitAmt && explicitAmt > 0) {
        setGenericAmount(explicitAmt);
      }

      const members = getMembers(campaign.id);
      setAllMembers(members);
      
      // Auto-select first member if available and none selected
      if (members.length > 0 && !selectedMember) {
        setSelectedMember(members[0]);
      }

      // Initialize subCategories
      const subCats = (campaign.subCategories && campaign.subCategories.length > 0)
        ? campaign.subCategories
        : DEFAULT_KUMTLUANG_SUBCATS;
      
      const initialMap: { [key: string]: number } = {};
      subCats.forEach((sc, idx) => {
        initialMap[sc] = idx === 0 ? 300 : idx === 1 ? 200 : 0;
      });
      setCategoryAmounts(initialMap);
    }
  }, [campaign, isOpen]);

  // Categories list
  const subCategories = useMemo(() => {
    if (!campaign) return DEFAULT_KUMTLUANG_SUBCATS;
    return (campaign.subCategories && campaign.subCategories.length > 0)
      ? campaign.subCategories
      : DEFAULT_KUMTLUANG_SUBCATS;
  }, [campaign]);

  // Filtered members matching search query (Phone last 4, full phone, Member ID, or name)
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allMembers.slice(0, 5);
    return allMembers.filter(m => 
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.phoneLast4.includes(q) ||
      (m.fullPhone && m.fullPhone.includes(q)) ||
      (m.section && m.section.toLowerCase().includes(q)) ||
      (m.dependents && m.dependents.some(d => d.name.toLowerCase().includes(q) || d.subId.toLowerCase().includes(q)))
    );
  }, [allMembers, searchQuery]);

  // Total amount calculation
  const totalAmount = useMemo(() => {
    if (!isKumtluang) return genericAmount;
    return Object.values(categoryAmounts).reduce((acc: number, curr: number) => acc + (Number(curr) || 0), 0);
  }, [isKumtluang, categoryAmounts, genericAmount]);

  if (!isOpen || !campaign) return null;

  const isSessionExpired = campaign.gatewaySessionExpiresAt 
    ? new Date(campaign.gatewaySessionExpiresAt).getTime() < Date.now()
    : false;
  const isExpired = isCampaignExpired(campaign.validityDate, campaign.status) || isSessionExpired;
  const isOthers = campaign.category === 'others';
  const isRalna = campaign.category === 'ralna';
  const isRikrum = campaign.category === 'rikrum';
  const isKhawlsak = campaign.category === 'khawlsak';
  const isDynamicGateway = Boolean(campaign.isDynamicGateway);

  // Get active payer name and ID
  const getActivePayerInfo = () => {
    if (memberMode === 'guest') {
      return {
        id: 'GST',
        name: guestName.trim() || 'Guest Donor',
        section: guestSection || 'Visitor'
      };
    }
    if (!selectedMember) {
      return {
        id: campaign.orgCode || 'KTL',
        name: 'Member',
        section: ''
      };
    }
    if (selectedSubId === 'primary') {
      return {
        id: selectedMember.id,
        name: selectedMember.name,
        section: selectedMember.section || ''
      };
    }
    const dep = selectedMember.dependents?.find(d => d.subId === selectedSubId);
    if (dep) {
      return {
        id: dep.subId,
        name: `${dep.name} (${dep.relation})`,
        section: selectedMember.section || ''
      };
    }
    return {
      id: selectedMember.id,
      name: selectedMember.name,
      section: selectedMember.section || ''
    };
  };

  const payerInfo = getActivePayerInfo();

  // Create formatted category summary for note
  const getCategoriesNote = () => {
    if (!isKumtluang) {
      return campaign.title;
    }
    const activeCats = Object.entries(categoryAmounts)
      .filter(([_, amt]) => (Number(amt) || 0) > 0)
      .map(([cat, amt]) => `${cat}: ₹${amt}`);
    
    if (activeCats.length === 0) return 'Kumtluang Thawhlawm';
    if (activeCats.length <= 2) return activeCats.join(', ');
    return `${activeCats.slice(0, 2).join(', ')} +${activeCats.length - 2} more`;
  };

  // Generate strict audit note: RonPay KTL [ID] Name - Category (Month)
  const generateAuditNote = () => {
    const orgTag = campaign.orgCode || 'KTL';
    const catNote = getCategoriesNote();
    return `RonPay ${orgTag} [${payerInfo.id}] ${payerInfo.name} - ${catNote} (${selectedMonth})`;
  };

  const upiNote = isKumtluang 
    ? generateAuditNote() 
    : isOthers 
    ? (campaign.title || 'UPI Payment')
    : `RonPay ${campaign.category.toUpperCase()} - ${campaign.title}`;

  const upiPayUrl = createUPIPaymentString(
    campaign.upiId || 'ronpay@axl',
    campaign.title,
    totalAmount > 0 ? totalAmount : undefined,
    upiNote
  );

  const handleOpenUPI = () => {
    if (isExpired) {
      alert('⚠️ He campaign/QR hi a expire tawh avangin payment tih theih a ni rih lo.');
      return;
    }
    if (totalAmount <= 0) {
      alert('⚠️ Khawngaihin amount (₹) dah phawt rawh le.');
      return;
    }
    window.location.href = upiPayUrl;
  };

  const handleCategoryAmountChange = (cat: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    setCategoryAmounts(prev => ({
      ...prev,
      [cat]: num
    }));
  };

  const handleQuickAdd = (cat: string, increment: number) => {
    setCategoryAmounts(prev => ({
      ...prev,
      [cat]: (prev[cat] || 0) + increment
    }));
  };

  const handleClearCategory = (cat: string) => {
    setCategoryAmounts(prev => ({
      ...prev,
      [cat]: 0
    }));
  };

  const handleClearAll = () => {
    const resetMap: { [key: string]: number } = {};
    subCategories.forEach(sc => {
      resetMap[sc] = 0;
    });
    setCategoryAmounts(resetMap);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-2.5 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-md rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200 relative space-y-3.5 max-h-[92vh] overflow-y-auto my-auto shrink-0">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header Badge */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
            isKumtluang ? 'bg-blue-100 text-blue-900 border-blue-300' :
            isRalna ? 'bg-slate-900 text-white border-slate-700' :
            isRikrum ? 'bg-rose-100 text-rose-800 border-rose-300' :
            isKhawlsak ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
            isOthers ? 'bg-purple-100 text-purple-900 border-purple-300' :
            'bg-indigo-100 text-indigo-800 border-indigo-300'
          }`}>
            {isKumtluang 
              ? 'KUMTLUANG BAWM • MEMBER PORTAL' 
              : isOthers 
              ? 'DIRECT UPI PAYMENT • EXTERNAL' 
              : `${campaign.category.toUpperCase()} BAWM SCAN`}
          </span>
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified
          </span>
        </div>

        {/* Campaign Info */}
        <div className="border-b border-slate-100 pb-2.5 space-y-1">
          <h3 className="text-base font-black text-slate-900 leading-snug">
            {campaign.title}
          </h3>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              {campaign.location}
            </span>
            <span className="font-bold text-indigo-700">UPI: {campaign.upiId}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* KUMTLUANG BAWM SPECIFIC SECTION: MEMBER SEARCH, SUB-IDS & CATEGORIES       */}
        {/* ========================================================================= */}
        {isKumtluang ? (
          <div className="space-y-3.5">
            {/* 1. Member In-hriattirna (Search vs Guest) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>1. Member In-hriattirna</span>
                </span>
                
                {/* Mode Selector */}
                <div className="bg-slate-200/80 p-0.5 rounded-lg flex text-[10.5px] font-bold">
                  <button
                    onClick={() => setMemberMode('search')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      memberMode === 'search' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Member Roll Search
                  </button>
                  <button
                    onClick={() => setMemberMode('guest')}
                    className={`px-2 py-1 rounded-md transition cursor-pointer ${
                      memberMode === 'guest' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Guest / Thar
                  </button>
                </div>
              </div>

              {memberMode === 'search' ? (
                <div className="space-y-2">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search Phone (e.g. 1460), Roll No (BCM-8622)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Search Results / Selected Member Card */}
                  {selectedMember ? (
                    <div className="bg-white border-2 border-blue-500/40 rounded-xl p-2.5 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-xs">
                            {selectedMember.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              {selectedMember.name}
                              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded-md border border-blue-200">
                                {selectedMember.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {selectedMember.section || 'General'} • Ph: ...{selectedMember.phoneLast4}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedMember(null);
                            setSearchQuery('');
                          }}
                          className="text-[10.5px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>

                      {/* Family Sub-IDs Selector (Primary vs Dependents) */}
                      {selectedMember.dependents && selectedMember.dependents.length > 0 && (
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <span className="text-[10px] font-extrabold text-slate-600 block">
                            Tu pual nge i chhun dawn? (Select Person):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {/* Primary button */}
                            <button
                              onClick={() => setSelectedSubId('primary')}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                                selectedSubId === 'primary'
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <User className="w-3 h-3" />
                              <span>{selectedMember.name} (Chhungkaw Pu)</span>
                            </button>

                            {/* Dependents buttons */}
                            {selectedMember.dependents.map((dep) => (
                              <button
                                key={dep.subId}
                                onClick={() => setSelectedSubId(dep.subId)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                                  selectedSubId === dep.subId
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <span className="text-[10px] font-mono opacity-80">{dep.subId}</span>
                                <span>{dep.name} ({dep.relation})</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Search suggestions list */
                    <div className="max-h-32 overflow-y-auto space-y-1 bg-white p-1 rounded-xl border border-slate-200">
                      {searchResults.length > 0 ? (
                        searchResults.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedMember(m);
                              setSelectedSubId('primary');
                            }}
                            className="p-1.5 hover:bg-blue-50 rounded-lg cursor-pointer flex items-center justify-between text-xs transition"
                          >
                            <div>
                              <span className="font-black text-slate-800">{m.name}</span>
                              <span className="ml-1.5 font-mono text-[10px] text-blue-700 font-bold">[{m.id}]</span>
                              <span className="text-[10px] text-slate-400 block">{m.section} • {m.phoneLast4}</span>
                            </div>
                            <button className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                              Select
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-2 text-xs text-slate-400">
                          Member hmuh a ni lo. "Guest / Thar" ah hian i hming chhu lut rawh le.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Guest / Member Thar mode */
                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">I Hming (Full Name):</label>
                    <input
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="E.g. Lalrinkima"
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-bold"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phone No:</label>
                      <input
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder="9862..."
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Veng / Section:</label>
                      <input
                        type="text"
                        value={guestSection}
                        onChange={(e) => setGuestSection(e.target.value)}
                        placeholder="E.g. Khatla South"
                        className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Month (Thla) Selector */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>2. Thla (Month) Thlanna:</span>
                </span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                  {selectedMonth}
                </span>
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                {MONTHS_LIST.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* 3. Dynamic Categories & Amount Inputs */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>3. Dynamic Categories & Amount:</span>
                </span>
                <button
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Clear All
                </button>
              </div>

              <div className="space-y-2">
                {subCategories.map((sc) => {
                  const currentAmt = categoryAmounts[sc] || 0;
                  return (
                    <div key={sc} className="bg-white p-2 rounded-xl border border-slate-200 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800">{sc}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={currentAmt === 0 ? '' : currentAmt}
                            onChange={(e) => handleCategoryAmountChange(sc, e.target.value)}
                            placeholder="0"
                            className="w-20 text-right px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-black text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* Quick Add Buttons */}
                      <div className="flex items-center justify-end gap-1 text-[10px] font-bold">
                        <button
                          onClick={() => handleQuickAdd(sc, 100)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 cursor-pointer active:scale-95"
                        >
                          +100
                        </button>
                        <button
                          onClick={() => handleQuickAdd(sc, 200)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 cursor-pointer active:scale-95"
                        >
                          +200
                        </button>
                        <button
                          onClick={() => handleQuickAdd(sc, 500)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200 cursor-pointer active:scale-95"
                        >
                          +500
                        </button>
                        {currentAmt > 0 && (
                          <button
                            onClick={() => handleClearCategory(sc)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-md border border-rose-200 cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Total Amount Summary Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white rounded-2xl p-3.5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-extrabold text-blue-200 tracking-wide block">
                  Total Amount Pek Tur
                </span>
                <span className="text-xl font-black text-amber-300">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10.5px] text-blue-100 block opacity-90 mt-0.5">
                  Payer: <b>{payerInfo.name}</b> [{payerInfo.id}]
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-blue-200 bg-blue-800/60 px-2 py-0.5 rounded-md block border border-blue-700">
                  {selectedMonth}
                </span>
              </div>
            </div>

            {/* Audit Note Preview */}
            <div className="p-2 bg-slate-100 rounded-xl text-[10.5px] text-slate-600 font-mono border border-slate-200">
              <span className="font-bold text-slate-700 block text-[9.5px]">UPI Audit Note:</span>
              <p className="truncate text-indigo-950 font-bold">{upiNote}</p>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* GENERIC / NON-KUMTLUANG BAWM SECTION (Ralna, Rikrum, Khawlsak, etc.)      */
          /* ========================================================================= */
          <div className="space-y-3">
            {isRalna && campaign.mitthiHming && (
              <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                Mitthi: <span className="text-slate-950 font-black">{campaign.mitthiHming}</span>
                {campaign.age ? ` (${campaign.age} yrs)` : ''}
                {campaign.vuiHun && (
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    Vui hun: {formatDateDDMMYYYY(campaign.vuiHun)}
                  </p>
                )}
              </div>
            )}

            {isRikrum && (campaign.emergencyTitle || campaign.cause) && (
              <div className="text-xs font-bold text-rose-900 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                🚨 {translateCampaignCause(campaign, language) || campaign.emergencyTitle || campaign.cause}
              </div>
            )}

            {isKhawlsak && campaign.cause && (
              <p className="text-xs text-slate-700 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 font-medium leading-relaxed">
                {translateCampaignCause(campaign, language) || campaign.cause}
              </p>
            )}

            {isDynamicGateway ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1.5 text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-black text-amber-950">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Dynamic Payment Gateway Session (One-Time QR)</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  He QR code hi Website / PhonePe gateway-in order bik atan a siam a ni a. Minute 3–5 chhung chauh nung tur leh <strong>vawi khat chiah pek theih (Single-use)</strong> a ni.
                </p>
                {campaign.customAmount && (
                  <div className="bg-white/80 p-2 rounded-xl border border-amber-200/80 flex items-center justify-between text-xs font-bold mt-1">
                    <span className="text-slate-600">Fixed Invoice Bill Amount:</span>
                    <span className="font-black text-amber-950 text-sm">₹{campaign.customAmount}</span>
                  </div>
                )}
              </div>
            ) : isOthers ? (
              <div className="text-xs text-purple-900 bg-purple-50 p-2.5 rounded-xl border border-purple-200 font-medium flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Standard UPI QR Code a ni a, RonPay Bawm dangte nen inzawmna a nei lo.</span>
              </div>
            ) : null}

            {/* Generic Amount Input */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 block">
                  Pek Tur Zat (Amount in ₹):
                </label>
                {campaign.customAmount ? (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md">
                    Invoice Amount Fixed
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500">
                    QR-ah amount a in-fix lo
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 font-black text-slate-400 text-sm">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={genericAmount || ''}
                  onChange={(e) => setGenericAmount(Number(e.target.value) || 0)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Quick Pills */}
              <div className="flex gap-1.5 text-xs font-bold">
                {[100, 200, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setGenericAmount(amt)}
                    className={`flex-1 py-1 rounded-lg border transition cursor-pointer ${
                      genericAmount === amt
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Expired Warning or Payment Buttons */}
        {isExpired ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center space-y-1">
            <AlertCircle className="w-5 h-5 text-rose-600 mx-auto" />
            <p className="text-xs font-black text-rose-900">
              {isSessionExpired ? 'Payment Gateway Session Expired' : 'Pek Hun a Tawp Tawh (Expired)'}
            </p>
            <p className="text-[10.5px] text-rose-700">
              {isSessionExpired
                ? 'He dynamic payment gateway session hi a hun tiam (minute 3–5) a ral tawh avangin bank/PhonePe server lamin a pawm tawh lo vang. Website-ah QR thar i siam nawn a ngai ang.'
                : 'He campaign/QR hi a tawp tawh avangin sum pek theih a ni tawh rih lo.'}
            </p>
          </div>
        ) : (
          /* Payment Mode Selection */
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-black text-slate-700 px-0.5">
              <span>Payment Mode Thlang Rawh:</span>
              <span className="text-[10px] text-indigo-600 font-bold">2 Options Available</span>
            </div>

            {/* Option 1: RonPay Smart Checkout (Receipt + Expense Tracker) */}
            <button
              type="button"
              onClick={() => onProceedRonPay({ 
                ...campaign, 
                targetAmount: totalAmount > 0 ? totalAmount : genericAmount,
                customAmount: totalAmount > 0 ? totalAmount : genericAmount,
                feeOptionRule: campaign.category === 'others' ? 'DEDUCT' : campaign.feeOptionRule
              })}
              className="w-full text-left bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 hover:from-slate-800 hover:to-indigo-900 text-white p-3.5 rounded-2xl shadow-md border border-indigo-500/40 transition cursor-pointer active:scale-98 group space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-white group-hover:text-amber-300 transition">
                    Pay with RonPay (Recommended)
                  </span>
                </div>
                <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase">
                  Smart Tracker
                </span>
              </div>
              <p className="text-[10.5px] text-indigo-200/90 leading-tight pl-9">
                ✓ Official Digital Receipt & QR Slip • Personal Expense / Sulhnu Tracker • Real-time Cloud Sync
              </p>
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 pt-1 pl-9 border-t border-white/10">
                <span>Amount: ₹{(totalAmount > 0 ? totalAmount : genericAmount).toLocaleString('en-IN')}</span>
                <span className="flex items-center gap-1 text-[10.5px] text-white">Proceed to Checkout <ArrowRight className="w-3.5 h-3.5" /></span>
              </div>
            </button>

            {/* Option 2: Direct UPI App Launch */}
            <button
              type="button"
              onClick={handleOpenUPI}
              className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 p-3 rounded-2xl transition cursor-pointer active:scale-98 group flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h5 className="text-xs font-black text-slate-900 truncate">
                    Direct UPI App (GPay / PhonePe / Paytm)
                  </h5>
                  <p className="text-[10px] text-slate-500 truncate">
                    RonPay receipt awm lovin UPI app-ah a lut tlang nghal ang
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-black text-indigo-600 block">
                  ₹{(totalAmount > 0 ? totalAmount : genericAmount).toLocaleString('en-IN')}
                </span>
                <span className="text-[9.5px] text-slate-400 font-bold">Launch App ↗</span>
              </div>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10.5px] text-slate-500">
          <span>RonPay Verified Web Portal</span>
          <span className="font-bold text-slate-700">Audit Format Standardized</span>
        </div>
      </div>
    </div>
  );
};
