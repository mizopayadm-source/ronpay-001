import React, { useState, useEffect } from 'react';
import { 
  QrCode, 
  FileDown, 
  Bell, 
  MapPin, 
  Sparkles, 
  Monitor, 
  Smartphone, 
  Loader2, 
  History, 
  RotateCw,
  WifiOff,
  ShieldCheck
} from 'lucide-react';
import { ScreenId } from '../types';
import { Language } from '../utils/translations';

interface HeaderProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  onOpenScanner: () => void;
  onOpenReports: () => void;
  isDesktopView: boolean;
  onToggleDesktopView: () => void;
  notificationCount: number;
  onOpenNotifications: () => void;
  language: Language;
  onToggleLanguage: (lang: Language) => void;
  onOpenHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onNavigate,
  onOpenScanner,
  onOpenReports,
  isDesktopView,
  onToggleDesktopView,
  notificationCount,
  onOpenNotifications,
  language,
  onToggleLanguage,
  onOpenHistory,
}) => {
  const [userLocation, setUserLocation] = useState<string>(() => {
    const saved = localStorage.getItem('kut_app_user_location');
    // If invalid or cellular IP fallback like Assam, reset to default Mizoram capital
    if (!saved || saved.includes('Assam') || saved.includes('Detecting') || saved.includes('Nagaon')) {
      return 'Aizawl, Mizoram';
    }
    return saved;
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [searchLocText, setSearchLocText] = useState<string>('');

  const MIZORAM_LOCATIONS = [
    'Aizawl, Mizoram',
    'Chanmari, Aizawl',
    'Mission Veng, Aizawl',
    'Khatla, Aizawl',
    'Dawrpui, Aizawl',
    'Bawngkawn, Aizawl',
    'Kulikawn, Aizawl',
    'Ramhlun, Aizawl',
    'Zarkawt, Aizawl',
    'Tuikual, Aizawl',
    'Lunglei, Mizoram',
    'Bazar Veng, Lunglei',
    'Venglai, Lunglei',
    'Champhai, Mizoram',
    'Kolasib, Mizoram',
    'Serchhip, Mizoram',
    'Siaha, Mizoram',
    'Lawngtlai, Mizoram',
    'Mamit, Mizoram',
    'Saitual, Mizoram',
    'Khawzawl, Mizoram',
    'Hnahthial, Mizoram',
  ];

  const handleSelectLocation = (loc: string) => {
    setUserLocation(loc);
    localStorage.setItem('kut_app_user_location', loc);
    setIsLocationModalOpen(false);
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Approximate nearest Mizoram district helper
  const getNearestDistrict = (lat: number, lng: number): string => {
    const districts = [
      { name: 'Aizawl, Mizoram', lat: 23.7271, lng: 92.7176 },
      { name: 'Lunglei, Mizoram', lat: 22.8872, lng: 92.7410 },
      { name: 'Champhai, Mizoram', lat: 23.4735, lng: 93.3283 },
      { name: 'Kolasib, Mizoram', lat: 24.2256, lng: 92.6782 },
      { name: 'Serchhip, Mizoram', lat: 23.3417, lng: 92.8504 },
      { name: 'Siaha, Mizoram', lat: 22.4897, lng: 92.9774 },
      { name: 'Lawngtlai, Mizoram', lat: 22.5278, lng: 92.8920 },
      { name: 'Mamit, Mizoram', lat: 23.9268, lng: 92.4905 },
      { name: 'Saitual, Mizoram', lat: 23.9700, lng: 92.5700 },
      { name: 'Khawzawl, Mizoram', lat: 23.5350, lng: 93.1850 },
      { name: 'Hnahthial, Mizoram', lat: 22.9650, lng: 92.9300 },
    ];

    let closest = districts[0].name;
    let minDistance = Infinity;

    for (const d of districts) {
      const dist = Math.hypot(lat - d.lat, lng - d.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = d.name;
      }
    }

    return closest;
  };

  // Reverse Geocode accurately from real GPS coordinates
  const resolveLocationName = async (lat: number, lng: number) => {
    const isWithinMizoram = lat >= 21.8 && lat <= 24.6 && lng >= 92.1 && lng <= 93.6;
    const nearestDist = getNearestDistrict(lat, lng);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'en' }
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const state = addr.state || '';
        const localArea = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district || addr.hamlet || addr.road;
        const mainCity = addr.city || addr.town || addr.county || addr.state_district;

        if (state === 'Mizoram' || isWithinMizoram) {
          if (localArea && mainCity) {
            const resolved = `${localArea}, ${mainCity}`;
            setUserLocation(resolved);
            localStorage.setItem('kut_app_user_location', resolved);
            return;
          } else if (mainCity) {
            const resolved = `${mainCity}, Mizoram`;
            setUserLocation(resolved);
            localStorage.setItem('kut_app_user_location', resolved);
            return;
          }
        }
      }
    } catch (e) {
      // Fallback on network timeout
    }

    // Default to closest Mizoram district
    const defaultMizoramLoc = nearestDist || 'Aizawl, Mizoram';
    setUserLocation(defaultMizoramLoc);
    localStorage.setItem('kut_app_user_location', defaultMizoramLoc);
  };

  const triggerLiveGPS = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          resolveLocationName(lat, lng).finally(() => setIsLocating(false));
        },
        () => {
          // If browser GPS permission denied/blocked in iframe, keep clean Mizoram default
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
      );
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('kut_app_user_location');
    if (!saved || saved.includes('Assam') || saved.includes('Nagaon') || saved.includes('Detecting')) {
      localStorage.setItem('kut_app_user_location', 'Aizawl, Mizoram');
      setUserLocation('Aizawl, Mizoram');
    }
  }, []);

  return (
    <header className="Header-wrapper bg-slate-950 text-white shadow-xl relative shrink-0 border-b border-slate-800 sticky top-0 z-30 transition-all">
      {/* Subtle glowing ambient lighting */}
      <div className="absolute -right-6 -top-6 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute left-1/4 -bottom-6 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 relative z-10">
        {/* Top Section (Mobile) / Left Section (Desktop): Brand & Top Actions */}
        <div className="w-full sm:w-auto flex items-center justify-between gap-2 min-w-0">
          {/* Brand Logo & Title */}
          <button 
            onClick={() => onNavigate('screen-home')}
            className="flex items-center gap-2 sm:gap-3 text-left group transition cursor-pointer shrink-0"
          >
            {/* Logo Squircle */}
            <div className="relative shrink-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl p-0.5 bg-gradient-to-br from-amber-400 via-indigo-500 to-indigo-700 shadow-md group-hover:scale-105 transition-transform duration-200">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center relative overflow-hidden">
                  <svg viewBox="0 0 40 40" className="w-5.5 h-5.5 sm:w-6.5 sm:h-6.5 relative z-10" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="rPayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FDE047" />
                        <stop offset="45%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#FB7185" />
                      </linearGradient>
                      <linearGradient id="rPayGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#38BDF8" />
                        <stop offset="100%" stopColor="#818CF8" />
                      </linearGradient>
                    </defs>
                    <circle cx="20" cy="20" r="17" stroke="url(#rPayGrad2)" strokeWidth="1.5" strokeDasharray="4 2" strokeOpacity="0.4" />
                    <rect x="10" y="9" width="4.5" height="22" rx="2.25" fill="url(#rPayGrad)" />
                    <path 
                      d="M13 9H22C25.5 9 28.5 12 28.5 15.5C28.5 19 25.5 22 22 22H13" 
                      stroke="url(#rPayGrad)" 
                      strokeWidth="4.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                    />
                    <path 
                      d="M19 20L27 31" 
                      stroke="url(#rPayGrad)" 
                      strokeWidth="4.5" 
                      strokeLinecap="round" 
                    />
                    <circle cx="29" cy="11" r="2.2" fill="#38BDF8" />
                  </svg>
                </div>
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-950 shadow-xs ${isOnline ? 'bg-emerald-500' : 'bg-amber-400 animate-ping'}`} />
            </div>

            {/* Brand Name & FINTECH Badge (Unclipped with strict whitespace-nowrap) */}
            <div className="shrink-0 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-black text-lg sm:text-2xl tracking-tight text-white font-sans whitespace-nowrap">
                  RON<span className="text-amber-400">PAY</span>
                </span>
                <span className="inline-flex bg-amber-400/15 text-amber-300 text-[8.5px] sm:text-[9.5px] font-black px-1.5 sm:px-2 py-0.5 rounded-full border border-amber-400/40 tracking-wider uppercase items-center gap-0.5 shrink-0 whitespace-nowrap">
                  <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" /> FINTECH
                </span>
                {!isOnline && (
                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[8px] sm:text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-400/50 uppercase tracking-wider shrink-0 whitespace-nowrap animate-pulse">
                    <WifiOff className="w-2.5 h-2.5 text-amber-300" /> OFFLINE
                  </span>
                )}
              </div>
              {/* Desktop Location Subtext (Hidden on mobile, shown in bottom bar on mobile) */}
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsLocationModalOpen(true);
                }}
                className="hidden sm:flex text-xs text-slate-400 font-medium items-center gap-1.5 hover:text-amber-300 transition cursor-pointer mt-0.5 group"
                title="Click to select or change location"
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                ) : (
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                )}
                <span className="truncate max-w-[220px] font-bold text-slate-200 text-xs">
                  {userLocation}
                </span>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerLiveGPS();
                  }}
                  title="Auto-detect phone GPS"
                  className="p-1 hover:text-amber-400"
                >
                  <RotateCw className="w-2.5 h-2.5 text-slate-500 opacity-70 group-hover:opacity-100 group-hover:rotate-180 transition-all shrink-0" />
                </span>
              </div>
            </div>
          </button>

          {/* Mobile Top-Right Quick Actions: Language, Notification, & Scan */}
          <div className="flex sm:hidden items-center gap-1.5 shrink-0">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-[10px] font-black shadow-inner">
              <button
                type="button"
                onClick={() => onToggleLanguage('mizo')}
                className={`px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                  language === 'mizo'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MZ
              </button>
              <button
                type="button"
                onClick={() => onToggleLanguage('english')}
                className={`px-1.5 py-0.5 rounded-md transition cursor-pointer ${
                  language === 'english'
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
            </div>

            {/* Notifications Button */}
            <button
              type="button"
              onClick={onOpenNotifications}
              title="Notifications"
              className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition relative cursor-pointer active:scale-95 shrink-0 shadow-xs"
            >
              <Bell className="w-4 h-4" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-950 animate-pulse" />
              )}
            </button>

            {/* QR Scanner Primary Action Button (Square on Mobile to prevent text clipping) */}
            <button
              type="button"
              onClick={onOpenScanner}
              title="Scan QR Code"
              className="w-8 h-8 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-lg flex items-center justify-center transition shadow-xs cursor-pointer active:scale-95 border border-amber-300 shrink-0"
            >
              <QrCode className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Mobile Bottom Sub-Bar: Full-Width Balanced Grid with Live GPS on Left, History & Reports on Right */}
        <div className="w-full flex sm:hidden items-center justify-between bg-slate-900/90 backdrop-blur-xs border border-slate-800/80 rounded-xl px-2.5 py-1.5 gap-2 shadow-inner">
          {/* User's GPS Auto-Detect on Left */}
          <div 
            onClick={() => setIsLocationModalOpen(true)}
            className="flex items-center gap-1.5 min-w-0 text-slate-300 hover:text-amber-300 transition cursor-pointer group text-left"
            title="Click to select or change location"
          >
            {isLocating ? (
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
            ) : (
              <MapPin className="w-3 h-3 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
            )}
            <span className="truncate max-w-[130px] xs:max-w-[160px] font-semibold text-slate-200 text-[11px]">
              {userLocation}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerLiveGPS();
              }}
              title="Auto-detect phone GPS"
              className="p-1 hover:text-amber-400 cursor-pointer"
            >
              <RotateCw className={`w-2.5 h-2.5 text-slate-500 opacity-70 group-hover:opacity-100 transition-all shrink-0 ${isLocating ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Quick Navigation: Sulhnu (History) & Reports on Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onOpenHistory}
              title={language === 'mizo' ? 'Pekna Sulhnu (History)' : 'Transaction History'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold border border-slate-700 transition cursor-pointer active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-amber-400" />
              <span>Sulhnu</span>
            </button>

            <button
              onClick={onOpenReports}
              title="Reports & Export Sheet"
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold border border-slate-700 transition cursor-pointer active:scale-95"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-400" />
              <span>Report</span>
            </button>
          </div>
        </div>

        {/* Desktop Action Toolbar (sm+ screens) */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {/* Language Switcher (MZ | EN) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-[11px] font-black shadow-inner">
            <button
              onClick={() => onToggleLanguage('mizo')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                language === 'mizo'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mizo version"
            >
              MZ
            </button>
            <button
              onClick={() => onToggleLanguage('english')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                language === 'english'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="English version"
            >
              EN
            </button>
          </div>

          {/* Sulhnu / History Button */}
          <button
            onClick={onOpenHistory}
            title={language === 'mizo' ? 'Pekna Sulhnu (History)' : 'Transaction History'}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-amber-400 flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-xs"
          >
            <History className="w-4.5 h-4.5" />
          </button>

          {/* Reports & Export Button */}
          <button
            onClick={onOpenReports}
            title="Reports & Export Sheet"
            className="flex w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-xs"
          >
            <FileDown className="w-4.5 h-4.5 text-emerald-400" />
          </button>

          {/* Desktop/Phone View Toggle */}
          <button
            onClick={onToggleDesktopView}
            title={isDesktopView ? "Switch to Phone Frame" : "Switch to Wide Desktop View"}
            className="hidden md:flex w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-amber-300 items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-xs"
          >
            {isDesktopView ? <Smartphone className="w-4.5 h-4.5 text-amber-300" /> : <Monitor className="w-4.5 h-4.5 text-indigo-300" />}
          </button>

          {/* Notifications Button */}
          <button
            onClick={onOpenNotifications}
            title="Notifications"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition relative cursor-pointer active:scale-95 shrink-0 shadow-xs"
          >
            <Bell className="w-4.5 h-4.5" />
            {notificationCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-950 animate-pulse" />
            )}
          </button>

          {/* QR Scanner Primary Action Button */}
          <button
            onClick={onOpenScanner}
            title="Scan QR Code"
            className="h-10 px-3.5 sm:px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl flex items-center justify-center gap-1.5 font-black text-xs transition shadow-sm cursor-pointer transform active:scale-95 border border-amber-300 shrink-0"
          >
            <QrCode className="w-4.5 h-4.5" />
            <span className="text-xs font-black tracking-tight">SCAN</span>
          </button>
        </div>
      </div>

      {/* Location Selector Modal */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 text-slate-800 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-4 shadow-2xl border border-indigo-100 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    {language === 'english' ? 'Select Location' : 'Awmnah Hmun Thlang Rawh'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium">Mizoram Veng / District</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLocationModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* GPS Auto-Detect Button */}
            <button
              type="button"
              onClick={() => {
                triggerLiveGPS();
                setIsLocationModalOpen(false);
              }}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{language === 'english' ? 'Auto-Detect Phone GPS' : 'Phone GPS hmangin zawng rawh'}</span>
            </button>

            {/* Search Input */}
            <input
              type="text"
              value={searchLocText}
              onChange={(e) => setSearchLocText(e.target.value)}
              placeholder="Search Veng / District (e.g. Chanmari, Lunglei)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-amber-500"
            />

            {/* Location List */}
            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {MIZORAM_LOCATIONS
                .filter(l => l.toLowerCase().includes(searchLocText.toLowerCase()))
                .map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                      userLocation === loc
                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                        : 'bg-slate-50 hover:bg-indigo-50 text-slate-700'
                    }`}
                  >
                    <span>{loc}</span>
                    {userLocation === loc && <span className="text-[10px] text-amber-700 font-black">✓ Active</span>}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

