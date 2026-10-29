import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { 
  isPushSupported, 
  getNotificationPermission, 
  requestNotificationPermission, 
  PushPromptOptions 
} from '../utils/pushNotifications';
import { dismissGuestBanner, isGuestBannerDismissed } from '../utils/guestPersonalization';

interface WebPushPromptToastProps {
  options: PushPromptOptions;
  onDismiss?: () => void;
  language?: 'mizo' | 'english';
}

export const WebPushPromptToast: React.FC<WebPushPromptToastProps> = ({
  options,
  onDismiss,
  language = 'mizo',
}) => {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [granted, setGranted] = useState<boolean>(false);

  useEffect(() => {
    // Only show if push is supported and permission is 'default' (not yet answered) and not dismissed in current period
    if (!isPushSupported()) return;
    if (getNotificationPermission() !== 'default') return;
    if (isGuestBannerDismissed('push', 6)) return;

    // Small delay for smooth user experience
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1200);

    return () => clearTimeout(timer);
  }, [options.reason, options.campaignTitle, options.receiptId]);

  const handleAllow = async () => {
    setIsProcessing(true);
    try {
      const isGranted = await requestNotificationPermission(options);
      if (isGranted) {
        setGranted(true);
        setTimeout(() => {
          setIsVisible(false);
          if (onDismiss) onDismiss();
        }, 2200);
      } else {
        setIsVisible(false);
        if (onDismiss) onDismiss();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismiss = () => {
    dismissGuestBanner('push');
    setIsVisible(false);
    if (onDismiss) onDismiss();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-slideUp">
      <div className="rounded-2xl bg-slate-900/95 border border-emerald-500/50 p-4 text-white shadow-2xl backdrop-blur-md">
        {granted ? (
          <div className="flex items-center gap-3 text-emerald-400 py-1">
            <CheckCircle2 className="w-5 h-5 shrink-0 animate-bounce" />
            <p className="text-xs font-bold">
              {language === 'mizo'
                ? 'Web Push Notifications hawn a ni ta! Dynamic updates i dawng zel ang.'
                : 'Web Push Notifications enabled! You will receive dynamic updates.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-white">
                    {options.reason === 'transaction_create'
                      ? (language === 'mizo' ? 'Receipt & Donation Updates' : 'Receipt & Donation Updates')
                      : (language === 'mizo' ? 'Bawm & Goal Updates Dawng Duh Em?' : 'Get Live Campaign Updates?')}
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                    {options.reason === 'transaction_create'
                      ? (language === 'mizo' 
                          ? 'I pekna receipt verification leh Bawm hmasawnna i browser-ah notification dawng rawh le.' 
                          : 'Receive real-time verification and campaign updates directly in your browser.')
                      : (language === 'mizo'
                          ? `"${options.campaignTitle || 'He Bawm'}" goal thlen chin leh update thar browser atangin hre zung zung rawh.`
                          : `Stay updated on milestones and dynamic receipts directly in your browser.`)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAllow}
                disabled={isProcessing}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-xs text-white shadow-xs transition active:scale-95 cursor-pointer text-center"
              >
                {isProcessing
                  ? (language === 'mizo' ? 'Hawn mek...' : 'Enabling...')
                  : (language === 'mizo' ? '🔔 Notification Hawn Rawh (1-Tap)' : '🔔 Enable Notifications')}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                {language === 'mizo' ? 'Nakinah' : 'Later'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
