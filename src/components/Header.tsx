import React, { useState, useEffect, useCallback } from 'react';
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
  Crosshair,
  X,
  Search,
  Check,
  Navigation,
  Compass,
  AlertCircle
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

// Comprehensive database of Mizoram Towns, Districts & Localities for accurate fallback & nearest-point geofencing
const MIZORAM_GEO_DATABASE = [
  // Lunglei Core Localities & Towns
  { name: 'Zobawk, Lunglei', lat: 22.8420, lng: 92.7480 },
  { name: 'Venglai, Lunglei', lat: 22.8940, lng: 92.7420 },
  { name: 'Bazar Veng, Lunglei', lat: 22.8890, lng: 92.7400 },
  { name: 'Chanmari, Lunglei', lat: 22.8980, lng: 92.7380 },
  { name: 'Rahsi Veng, Lunglei', lat: 22.8820, lng: 92.7450 },
  { name: 'Farm Veng, Lunglei', lat: 22.8760, lng: 92.7440 },
  { name: 'Electric Veng, Lunglei', lat: 22.8910, lng: 92.7350 },
  { name: 'Serkawn, Lunglei', lat: 22.9120, lng: 92.7550 },
  { name: 'Luangmual, Lunglei', lat: 22.9050, lng: 92.7310 },
  { name: 'Pukpui, Lunglei', lat: 22.9240, lng: 92.7680 },
  { name: 'Lunglei, Mizoram', lat: 22.8872, lng: 92.7410 },
  { name: 'Tlabung, Lunglei', lat: 22.8950, lng: 92.4850 },
  { name: 'Haulawng, Lunglei', lat: 22.9900, lng: 92.7800 },

  // Aizawl Core Localities
  { name: 'Khatla, Aizawl', lat: 23.7160, lng: 92.7140 },
  { name: 'Dawrpui, Aizawl', lat: 23.7335, lng: 92.7176 },
  { name: 'Chanmari, Aizawl', lat: 23.7431, lng: 92.7196 },
  { name: 'Bawngkawn, Aizawl', lat: 23.7594, lng: 92.7302 },
  { name: 'Kulikawn, Aizawl', lat: 23.7050, lng: 92.7190 },
  { name: 'Mission Veng, Aizawl', lat: 23.7190, lng: 92.7185 },
  { name: 'Ramhlun, Aizawl', lat: 23.7505, lng: 92.7270 },
  { name: 'Zarkawt, Aizawl', lat: 23.7380, lng: 92.7180 },
  { name: 'Tuikual, Aizawl', lat: 23.7300, lng: 92.7120 },
  { name: 'Vaivakawn, Aizawl', lat: 23.7450, lng: 92.7050 },
  { name: 'Zemabawk, Aizawl', lat: 23.7610, lng: 92.7520 },
  { name: 'Armed Veng, Aizawl', lat: 23.7380, lng: 92.7310 },
  { name: 'Electric Veng, Aizawl', lat: 23.7370, lng: 92.7240 },
  { name: 'Bethlehem, Aizawl', lat: 23.7250, lng: 92.7320 },
  { name: 'Chaltlang, Aizawl', lat: 23.7520, lng: 92.7220 },
  { name: 'Durtlang, Aizawl', lat: 23.7850, lng: 92.7360 },
  { name: 'Sairang, Aizawl', lat: 23.7990, lng: 92.6580 },
  { name: 'Lengpui, Mizoram', lat: 23.8380, lng: 92.6280 },
  { name: 'Aizawl, Mizoram', lat: 23.7271, lng: 92.7176 },

  // Champhai District & Localities
  { name: 'Champhai, Mizoram', lat: 23.4735, lng: 93.3283 },
  { name: 'Vengthlang, Champhai', lat: 23.4680, lng: 93.3250 },
  { name: 'Kahrawt, Champhai', lat: 23.4790, lng: 93.3320 },
  { name: 'Zokhawthar, Champhai', lat: 23.3680, lng: 93.3850 },

  // Kolasib District
  { name: 'Kolasib, Mizoram', lat: 24.2256, lng: 92.6782 },
  { name: 'Vairengte, Kolasib', lat: 24.5050, lng: 92.7600 },
  { name: 'Bairabi, Kolasib', lat: 24.1900, lng: 92.5350 },
  { name: 'Bilkhawthlir, Kolasib', lat: 24.3350, lng: 92.7200 },

  // Serchhip District
  { name: 'Serchhip, Mizoram', lat: 23.3417, lng: 92.8504 },
  { name: 'Thenzawl, Serchhip', lat: 23.2850, lng: 92.7650 },
  { name: 'North Vanlaiphai, Serchhip', lat: 23.1350, lng: 93.0700 },
  { name: 'Chhiahtlang, Serchhip', lat: 23.3950, lng: 92.8350 },

  // Siaha District
  { name: 'Siaha, Mizoram', lat: 22.4897, lng: 92.9774 },
  { name: 'Tuipang, Siaha', lat: 22.3150, lng: 93.0250 },

  // Lawngtlai District
  { name: 'Lawngtlai, Mizoram', lat: 22.5278, lng: 92.8920 },
  { name: 'Chawngte, Lawngtlai', lat: 22.6450, lng: 92.6450 },
  { name: 'Sangau, Lawngtlai', lat: 22.7450, lng: 93.0600 },

  // Mamit District
  { name: 'Mamit, Mizoram', lat: 23.9268, lng: 92.4905 },
  { name: 'Zawlnuam, Mamit', lat: 24.1350, lng: 92.3450 },
  { name: 'West Phaileng, Mamit', lat: 23.7850, lng: 92.4150 },

  // Saitual District
  { name: 'Saitual, Mizoram', lat: 23.9700, lng: 92.5700 },
  { name: 'Keifang, Saitual', lat: 23.9550, lng: 92.5850 },
  { name: 'Ngopa, Saitual', lat: 23.8850, lng: 93.2050 },

  // Khawzawl District
  { name: 'Khawzawl, Mizoram', lat: 23.5350, lng: 93.1850 },
  { name: 'Khawhai, Khawzawl', lat: 23.3450, lng: 93.1650 },

  // Hnahthial District
  { name: 'Hnahthial, Mizoram', lat: 22.9650, lng: 92.9300 },
  { name: 'South Vanlaiphai, Hnahthial', lat: 23.0150, lng: 92.9950 },
];

// Great-circle distance using Haversine formula (km)
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
    if (!saved || saved.includes('Assam') || saved.includes('Detecting') || saved.includes('Nagaon')) {
      return 'Zobawk, Lunglei';
    }
    return saved;
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isGpsActive, setIsGpsActive] = useState<boolean>(false);
  const [gpsErrorMsg, setGpsErrorMsg] = useState<string>('');
  const [showLocationModal, setShowLocationModal] = useState<boolean>(false);
  const [customLocationInput, setCustomLocationInput] = useState<string>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

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

  // Find the closest geographical point in Mizoram using Haversine calculation
  const getNearestMizoramLocation = (lat: number, lng: number): { name: string; distanceKm: number } => {
    let closest = MIZORAM_GEO_DATABASE[0];
    let minDistance = Infinity;

    for (const point of MIZORAM_GEO_DATABASE) {
      const dist = calculateHaversineKm(lat, lng, point.lat, point.lng);
      if (dist < minDistance) {
        minDistance = dist;
        closest = point;
      }
    }

    return { name: closest.name, distanceKm: minDistance };
  };

  // Multi-tier Reverse Geocoding for maximum accuracy
  const resolveLocationName = async (lat: number, lng: number): Promise<string> => {
    const isWithinMizoramBox = lat >= 21.8 && lat <= 24.6 && lng >= 92.1 && lng <= 93.6;
    const nearest = getNearestMizoramLocation(lat, lng);

    // If within close proximity to a Mizoram locality (< 12km), prioritize local ground truth
    if (isWithinMizoramBox && nearest.distanceKm <= 12) {
      return nearest.name;
    }

    // Tier 1: BigDataCloud Reverse Geocode Client (Fast, CORS friendly, no API key limit, precise locality)
    try {
      const bdcController = new AbortController();
      const bdcTimeout = setTimeout(() => bdcController.abort(), 4000);
      const bdcRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
        { signal: bdcController.signal }
      );
      clearTimeout(bdcTimeout);

      if (bdcRes.ok) {
        const bdcData = await bdcRes.json();
        const subdivision = bdcData.principalSubdivision || '';
        const city = bdcData.city || bdcData.locality || '';
        const locality = bdcData.locality || '';

        if (subdivision.toLowerCase().includes('mizoram') || isWithinMizoramBox) {
          if (locality && city && locality.toLowerCase() !== city.toLowerCase()) {
            return `${locality}, ${city.replace(/\s+District/gi, '')}`;
          } else if (city) {
            return `${city.replace(/\s+District/gi, '')}, Mizoram`;
          } else if (nearest.distanceKm <= 35) {
            return nearest.name;
          }
        } else if (city && subdivision) {
          return `${city}, ${subdivision}`;
        }
      }
    } catch {
      // Proceed to Tier 2
    }

    // Tier 2: OpenStreetMap Nominatim with clean regex sanitization
    try {
      const osmController = new AbortController();
      const osmTimeout = setTimeout(() => osmController.abort(), 4500);
      const osmRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=15`,
        {
          signal: osmController.signal,
          headers: { 'Accept-Language': 'en' }
        }
      );
      clearTimeout(osmTimeout);

      if (osmRes.ok) {
        const osmData = await osmRes.json();
        const addr = osmData.address || {};
        const state = addr.state || '';
        const rawLocalArea = addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city_district || addr.hamlet;
        const rawMainCity = addr.city || addr.town || addr.county || addr.state_district;

        const cleanCity = (rawMainCity || '').replace(/\s+District/gi, '').replace(/\s+Subdivision/gi, '').trim();
        const cleanLocal = (rawLocalArea || '').replace(/\s+Veng/gi, ' Veng').trim();

        if (state.toLowerCase().includes('mizoram') || isWithinMizoramBox) {
          if (cleanLocal && cleanCity && cleanLocal.toLowerCase() !== cleanCity.toLowerCase()) {
            return `${cleanLocal}, ${cleanCity}`;
          } else if (cleanCity) {
            return `${cleanCity}, Mizoram`;
          }
        } else if (cleanCity && state) {
          return `${cleanCity}, ${state}`;
        }
      }
    } catch {
      // Proceed to Tier 3 fallback
    }

    // Tier 3: Mathematical nearest coordinate fallback
    if (isWithinMizoramBox || nearest.distanceKm <= 50) {
      return nearest.name;
    }

    return 'Mizoram, India';
  };

  // Trigger Live GPS with High Accuracy first
  const triggerLiveGPS = useCallback((interactive: boolean = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const saved = localStorage.getItem('kut_app_user_location') || 'Zobawk, Lunglei';
      setUserLocation(saved);
      if (interactive) setGpsErrorMsg('I phone browser-ah GPS Geolocation a function thei lo.');
      return;
    }

    setIsLocating(true);
    setGpsErrorMsg('');

    const handleSuccess = async (position: GeolocationPosition) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      try {
        const resolved = await resolveLocationName(lat, lng);
        setUserLocation(resolved);
        setIsGpsActive(true);
        setGpsErrorMsg('');
        localStorage.setItem('kut_app_user_location', resolved);
        window.dispatchEvent(new CustomEvent('kut_app_location_updated', { detail: { location: resolved, lat, lng } }));
        if (interactive) {
          setTimeout(() => setShowLocationModal(false), 800);
        }
      } catch {
        const fallback = getNearestMizoramLocation(lat, lng).name;
        setUserLocation(fallback);
        setIsGpsActive(true);
        localStorage.setItem('kut_app_user_location', fallback);
      } finally {
        setIsLocating(false);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      setIsLocating(false);
      let msg = 'GPS signal zawn a hlawhchham rih e.';
      if (error.code === error.PERMISSION_DENIED) {
        msg = 'Phone Location access a blocked. Browser/Phone Setting-ah "Allow Location" phalsak rawh le, emaw a hnuaia khua hi thlang mai rawh.';
      } else if (error.code === error.TIMEOUT) {
        msg = 'GPS signal hmuh a muang deuh. A hnuaia i awmna khua/veng hi direct-in thlang mai rawh le.';
      }
      setGpsErrorMsg(msg);
      
      const saved = localStorage.getItem('kut_app_user_location');
      if (!saved || saved.includes('Detecting') || saved.includes('Assam') || saved.includes('Nagaon')) {
        const defaultLoc = 'Zobawk, Lunglei';
        setUserLocation(defaultLoc);
        localStorage.setItem('kut_app_user_location', defaultLoc);
      }
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  }, []);

  // Quick select explicit location
  const handleSelectLocation = (locName: string) => {
    setUserLocation(locName);
    setIsGpsActive(true);
    localStorage.setItem('kut_app_user_location', locName);
    window.dispatchEvent(new CustomEvent('kut_app_location_updated', { detail: { location: locName } }));
    setShowLocationModal(false);
  };

  const handleCustomLocationSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLocationInput.trim()) return;
    const clean = customLocationInput.trim();
    handleSelectLocation(clean);
    setCustomLocationInput('');
  };

  // Open modal on chip click
  const handleLocationClick = () => {
    setShowLocationModal(true);
    setGpsErrorMsg('');
  };

  // Automatically detect GPS on initial app startup
  useEffect(() => {
    const saved = localStorage.getItem('kut_app_user_location');
    if (!saved) {
      triggerLiveGPS(false);
    }
  }, [triggerLiveGPS]);

  return (
    <header className="Header-wrapper bg-slate-950 text-white shadow-xl relative shrink-0 border-b border-slate-800 sticky top-0 z-30 transition-all">
      {/* Subtle glowing ambient lighting */}
      <div className="absolute -right-6 -top-6 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute left-1/4 -bottom-6 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="px-3 sm:px-6 py-2.5 sm:py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 relative z-10">
        {/* Top Section (Mobile) / Left Section (Desktop): Brand & Top Actions */}
        <div className="w-full sm:w-auto flex items-center justify-between gap-2 min-w-0">
          {/* Brand Logo & Title (Separated from inner interactive controls) */}
          <div className="flex items-center gap-2 sm:gap-3 text-left shrink-0">
            <button 
              type="button"
              onClick={() => onNavigate('screen-home')}
              className="flex items-center gap-2 sm:gap-3 group transition cursor-pointer shrink-0 focus:outline-none"
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

              {/* Brand Name & FINTECH Badge */}
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
              </div>
            </button>

            {/* Desktop Live Auto GPS Status Chip (Placed outside the logo button) */}
            <div 
              onClick={handleLocationClick}
              className="hidden sm:flex text-xs text-slate-300 font-medium items-center gap-1.5 hover:text-amber-300 transition cursor-pointer mt-0.5 ml-1 group bg-slate-900/60 px-2 py-1 rounded-lg border border-slate-800"
              title="Live Auto GPS (Click to re-detect / tap again to cycle location)"
            >
              {isLocating ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
              ) : (
                <span className="relative flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                </span>
              )}
              <span className="truncate max-w-[180px] md:max-w-[220px] font-bold text-slate-200 text-xs">
                {userLocation}
              </span>
              <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-emerald-950/80 border border-emerald-500/40 rounded text-[8.5px] font-black text-emerald-300 uppercase tracking-wider">
                <Crosshair className="w-2 h-2 text-emerald-400" /> Auto GPS
              </span>
              <span
                title="Re-detect GPS location"
                className="p-0.5 hover:text-amber-400"
              >
                <RotateCw className={`w-2.5 h-2.5 text-slate-500 opacity-70 group-hover:opacity-100 transition-all shrink-0 ${isLocating ? 'animate-spin text-amber-400' : ''}`} />
              </span>
            </div>
          </div>

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

            {/* QR Scanner Primary Action Button */}
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

        {/* Mobile Bottom Sub-Bar: Full-Width Balanced Grid with Live Auto GPS on Left, History & Reports on Right */}
        <div className="w-full flex sm:hidden items-center justify-between bg-slate-900/90 backdrop-blur-xs border border-slate-800/80 rounded-xl px-2.5 py-1.5 gap-2 shadow-inner">
          {/* Live Auto GPS on Left */}
          <div 
            onClick={handleLocationClick}
            className="flex items-center gap-1.5 min-w-0 text-slate-300 hover:text-amber-300 transition cursor-pointer group text-left"
            title="Auto-detected GPS Location (Click to re-detect / tap again to cycle)"
          >
            {isLocating ? (
              <Loader2 className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
            ) : (
              <span className="relative flex items-center justify-center shrink-0">
                <MapPin className="w-3 h-3 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-emerald-400 rounded-full animate-ping" />
              </span>
            )}
            <span className="truncate max-w-[130px] xs:max-w-[160px] font-bold text-slate-200 text-[11px]">
              {userLocation}
            </span>
            <span
              title="Auto-detect phone GPS"
              className="p-1 hover:text-amber-400"
            >
              <RotateCw className={`w-2.5 h-2.5 text-slate-500 opacity-70 group-hover:opacity-100 transition-all shrink-0 ${isLocating ? 'animate-spin text-amber-400' : ''}`} />
            </span>
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

      {/* LOCATION & GPS SETUP MODAL */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-950 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Location & Awmna Hmun</h3>
                  <p className="text-[10.5px] text-slate-400">Current: <b className="text-emerald-400">{userLocation}</b></p>
                </div>
              </div>
              <button 
                onClick={() => setShowLocationModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {/* Live GPS Auto-Detect Button */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                    Live Satellite GPS
                  </span>
                  <span className="text-[10px] text-indigo-300 font-medium">Automatic Detection</span>
                </div>
                <button
                  onClick={() => triggerLiveGPS(true)}
                  disabled={isLocating}
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition cursor-pointer disabled:opacity-50"
                >
                  {isLocating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>GPS Signal Zawn Mek A Ni...</span>
                    </>
                  ) : (
                    <>
                      <Navigation className="w-4 h-4 text-emerald-200" />
                      <span>Tuna Ka Awmna Hmun Detect Rawh (GPS)</span>
                    </>
                  )}
                </button>

                {gpsErrorMsg && (
                  <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-start gap-2 text-[11px] text-amber-200 leading-tight">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{gpsErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* Custom Location Input */}
              <form onSubmit={handleCustomLocationSave} className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">Awmna Khua / Veng Ziah Lanna:</label>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={customLocationInput}
                    onChange={(e) => setCustomLocationInput(e.target.value)}
                    placeholder="Entirnan: Zobawk, Lunglei emaw Mission Veng..."
                    className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 px-3 py-2 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </form>

              {/* Search Filter for Quick Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-300">Khua & District Thlan Mai Tur:</label>
                  <span className="text-[10px] text-slate-400">1-Tap Select</span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Khua zawng rawh (Lunglei, Aizawl, Champhai...)"
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-slate-600 pl-8.5 pr-3 py-1.5 rounded-xl text-[11px] text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {MIZORAM_GEO_DATABASE.filter(item => 
                    item.name.toLowerCase().includes(searchFilter.toLowerCase())
                  ).map((item) => {
                    const isCurrent = userLocation === item.name;
                    return (
                      <button
                        key={item.name}
                        onClick={() => handleSelectLocation(item.name)}
                        className={`text-left px-2.5 py-2 rounded-xl text-[11px] font-bold border transition flex items-center justify-between gap-1 cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800/80'
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                        {isCurrent && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close (Kharna)
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

