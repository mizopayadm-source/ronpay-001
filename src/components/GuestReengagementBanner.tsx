import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Receipt, 
  UserPlus, 
  Smartphone, 
  Bell, 
  X, 
  ChevronRight, 
  Check, 
  Share2, 
  ArrowRight,
  Download,
  Info
} from 'lucide-react';
import { CreatorProfile, Campaign } from '../types';
import { 
  getGuestActivity, 
  dismissGuestBanner, 
  isGuestBannerDismissed, 
  GuestActivity 
} from '../utils/guestPersonalization';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  isPushSupported, 
  getNotificationPermission, 
  requestNotificationPermission 
} from '../utils/pushNotifications';

interface GuestReengagementBannerProps {
  creatorProfile: CreatorProfile;
  campaigns?: Campaign[];
  onOpenReceipts: () => void;
  onOpenRegister: () => void;
  onSelectCampaign?: (campaign: Campaign) => void;
  language?: 'mizo' | 'english';
}

export const GuestReengagementBanner: React.FC<GuestReengagementBannerProps> = ({
  creatorProfile,
  campaigns = [],
  onOpenReceipts,
  onOpenRegister,
  onSelectCampaign,
  language = 'mizo',
}) => {
  const [activity, setActivity] = useState<GuestActivity>(() => getGuestActivity());
  const [isDismissed, setIsDismissed] = useState<boolean>(() => isGuestBannerDismissed('reengagement', 8));
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() => getNotificationPermission());
  const [isEnablingPush, setIsEnablingPush] = useState<boolean>(false);

  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Listen for guest activity updates
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) setActivity(e.detail);
    };
    window.addEventListener('ronpay_guest_activity_updated', handleUpdate);
    return () => window.removeEventListener('ronpay_guest_activity_updated', handleUpdate);
  }, []);

  // Check if current user is guest
  const isGuest = useMemo(() => {
    if (!creatorProfile) return true;
    const cleanRole = (creatorProfile.role || '').toUpperCase();
    const cleanPhone = (creatorProfile.phone || '').trim();
    return cleanRole === 'GUEST' || !cleanPhone || cleanPhone === '9999999999' || !creatorProfile.isApproved;
  }, [creatorProfile]);

  // Repeat visitor: visitCount >= 2 OR has cached history
  const isRepeat = useMemo(() => {
    if (!isGuest) return false;
    const hasHistory = (activity.visitedCampaigns && activity.visitedCampaigns.length > 0) ||
                       (activity.recentReceiptIds && activity.recentReceiptIds.length > 0) ||
                       Boolean(activity.lastDonorPhone);
    return activity.visitCount >= 2 || hasHistory;
  }, [isGuest, activity]);

  const receiptCount = activity.recentReceiptIds?.length || 0;
  const recentCampaign = activity.visitedCampaigns?.[0];
  const matchedRecentCampaign = useMemo(() => {
    if (!recentCampaign) return null;
    return campaigns.find(c => c.id === recentCampaign.id) || null;
  }, [recentCampaign, campaigns]);

  const handleDismiss = () => {
    dismissGuestBanner('reengagement');
    setIsDismissed(true);
  };

  const handleEnablePush = async () => {
    setIsEnablingPush(true);
    try {
      const granted = await requestNotificationPermission({ reason: 'user_manual' });
      setPushPermission(granted ? 'granted' : 'denied');
    } finally {
      setIsEnablingPush(false);
    }
  };

  if (!isGuest || !isRepeat || isDismissed) {
    return null;
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/40 p-3.5 sm:p-4 text-white shadow-xl shadow-emerald-950/30 transition-all animate-fadeIn">
        {/* Ambient background glow */}
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-3">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-black text-xs sm:text-sm text-emerald-300">
                    {language === 'mizo' ? 'Chibai! I lo kir leh ta maw' : 'Welcome back!'}
                  </h4>
                  {activity.lastDonorPhone && (
                    <span className="text-[10px] font-mono bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-600/40">
                      {activity.lastDonorName ? `${activity.lastDonorName} • ` : ''}{activity.lastDonorPhone}
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-200 mt-0.5 leading-snug">
                  {language === 'mizo'
                    ? 'I dynamic receipts thar en la, emaw Creator Account siamin thuneihna pumhlum nei rawh le.'
                    : 'View your recent dynamic receipts or Register for full control.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0 cursor-pointer"
              title="Dismiss for now"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-800/40">
            {/* View Receipts Button */}
            <button
              type="button"
              onClick={onOpenReceipts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-xs hover:shadow-md transition active:scale-95 cursor-pointer"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{language === 'mizo' ? 'Pekna Sulhnu / Receipts' : 'View Receipts'}</span>
              {receiptCount > 0 && (
                <span className="ml-0.5 bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded-full text-[10px]">
                  {receiptCount}
                </span>
              )}
            </button>

            {/* Register for Full Control Button */}
            <button
              type="button"
              onClick={onOpenRegister}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-indigo-100 border border-indigo-400/40 text-xs font-black shadow-xs hover:shadow-md transition active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-200" />
              <span>{language === 'mizo' ? 'Register (Full Control)' : 'Register for Full Control'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Add to Home Screen Button (PWA) */}
            {!isInstalled && (isInstallable || isIOS) && (
              <button
                type="button"
                onClick={() => {
                  if (isInstallable) {
                    install();
                  } else if (isIOS) {
                    setShowIOSModal(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600/50 text-xs font-black shadow-xs transition active:scale-95 cursor-pointer ml-auto"
                title="Add RonPay to Home Screen"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'mizo' ? 'Screen-ah Dah Rawh' : 'Add to Home Screen'}</span>
                <Download className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Web Push Prompt Quick Button if default */}
            {isPushSupported() && pushPermission === 'default' && (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isEnablingPush}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold transition active:scale-95 cursor-pointer"
                title="Allow browser notifications"
              >
                <Bell className="w-3.5 h-3.5 text-amber-300" />
                <span>{isEnablingPush ? 'Enabling...' : (language === 'mizo' ? 'Push Notification Hawn' : 'Enable Push Alerts')}</span>
              </button>
            )}
          </div>

          {/* Recently Visited Campaign Quick Resume Chip */}
          {matchedRecentCampaign && onSelectCampaign && (
            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-300">
              <span className="text-slate-400 shrink-0">
                {language === 'mizo' ? 'Tlawh hnuhnun:' : 'Recent:'}
              </span>
              <button
                type="button"
                onClick={() => onSelectCampaign(matchedRecentCampaign)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-500/30 text-emerald-200 text-xs font-bold truncate transition cursor-pointer"
              >
                <span className="truncate max-w-[220px]">{matchedRecentCampaign.title}</span>
                <ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* iOS Safari Guided Install Sheet */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-700 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center font-black">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-black text-sm text-white">Add RonPay to Home Screen</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs text-slate-200">
              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-emerald-600/40 text-emerald-300 font-black flex items-center justify-center shrink-0">1</span>
                <p>Safari toolbar hnuaia <strong>Share</strong> button <Share2 className="w-3.5 h-3.5 inline mx-1 text-blue-400" /> kha hmet rawh.</p>
              </div>
              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-emerald-600/40 text-emerald-300 font-black flex items-center justify-center shrink-0">2</span>
                <p>A hnuai lamah scroll la, <strong>Add to Home Screen</strong> tih kha thlang rawh le.</p>
              </div>
              <div className="flex items-start gap-3 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
                <span className="w-6 h-6 rounded-full bg-emerald-600/40 text-emerald-300 font-black flex items-center justify-center shrink-0">3</span>
                <p>A chung dinglam <strong>Add</strong> hmet la, mobile app pangngai angin a in hawng nghal ang.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs text-white transition cursor-pointer"
            >
              Ka Hrethiam E (Close)
            </button>
          </div>
        </div>
      )}
    </>
  );
};
