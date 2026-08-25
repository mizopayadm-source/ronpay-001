import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Database, RefreshCw, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { Language } from '../utils/translations';
import { getLastSyncTime } from '../utils/storage';

interface OfflineStatusBannerProps {
  language: Language;
  campaignsCount: number;
  onRefreshCache?: () => void;
}

export const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  language,
  campaignsCount,
  onRefreshCache,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [showReconnectedToast, setShowReconnectedToast] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [lastSyncStr, setLastSyncStr] = useState<string>('');

  useEffect(() => {
    const updateSyncTime = () => {
      const time = getLastSyncTime();
      try {
        const d = new Date(time);
        setLastSyncStr(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch {
        setLastSyncStr('Recently');
      }
    };
    updateSyncTime();

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedToast(true);
      updateSyncTime();
      const timer = setTimeout(() => setShowReconnectedToast(false), 4500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false);
      updateSyncTime();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualCheck = async () => {
    setIsChecking(true);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        setIsOnline(true);
        setShowReconnectedToast(true);
        if (onRefreshCache) onRefreshCache();
        setTimeout(() => setShowReconnectedToast(false), 4000);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Reconnected Toast Banner
  if (showReconnectedToast) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl shadow-lg flex items-center justify-between text-xs font-semibold animate-fadeIn border border-emerald-500">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span>
            {language === 'mizo'
              ? 'Internet connection a inthlunzawm leh ta e! Data a in-sync vek e.'
              : 'Connection restored! Campaigns & transactions are fully synchronized.'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowReconnectedToast(false)}
          className="text-white/80 hover:text-white p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // If online and no reconnected toast, do not render banner
  if (isOnline) {
    return null;
  }

  // If dismissed, show a small compact indicator
  if (isDismissed) {
    return (
      <div className="bg-slate-900 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between shadow-sm animate-fadeIn">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>
            {language === 'mizo' ? 'Offline Mode Active' : 'Offline Mode Active'} ({campaignsCount} Cached)
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(false)}
          className="text-white hover:text-amber-200 underline text-[10px] ml-2 font-medium cursor-pointer"
        >
          {language === 'mizo' ? 'Hmuh chianna' : 'Details'}
        </button>
      </div>
    );
  }

  // Full Offline Notification Banner
  return (
    <div
      id="ronpay-offline-banner"
      className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 border border-amber-500/60 text-slate-100 p-3.5 rounded-2xl shadow-md transition relative overflow-hidden animate-fadeIn"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-400/40 flex items-center justify-center shrink-0 mt-0.5">
            <WifiOff className="w-4 h-4" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white tracking-wide flex items-center gap-1.5">
                <span>{language === 'mizo' ? 'Internet A Awm Lo (Offline Mode)' : 'Offline Mode Active'}</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  LOCAL CACHE
                </span>
              </h4>
            </div>

            <p className="text-[11px] text-slate-300 leading-relaxed">
              {language === 'mizo' ? (
                <>
                  Internet connection a chhiat lai pawhin Bawm <b className="text-amber-300">{campaignsCount}</b> leh QR Code te hi local storage-ah cache a ni a, awlsam takin i en leh zawng thei e.
                </>
              ) : (
                <>
                  You are offline. <b className="text-amber-300">{campaignsCount} campaigns</b> and verified QR codes are cached locally for uninterrupted browsing and verification.
                </>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3 text-indigo-400" />
                <span>Cached: <b className="text-slate-200">{campaignsCount} campaigns</b></span>
              </span>
              {lastSyncStr && (
                <span>• Last synced: <b className="text-slate-200">{lastSyncStr}</b></span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={isChecking}
            className="bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
            title="Check Connection"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            <span>{isChecking ? 'Checking...' : language === 'mizo' ? 'Endik rawh' : 'Retry'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            title="Minimize"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
