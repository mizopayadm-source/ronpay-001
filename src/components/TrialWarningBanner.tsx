import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  ArrowUpRight, 
  MessageSquare, 
  PhoneCall, 
  Mail, 
  CheckCircle2, 
  X, 
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Calendar
} from 'lucide-react';
import { CreatorProfile, SystemPricingConfig } from '../types';
import { getCreatorExpiryStatus } from '../utils/date';

interface TrialWarningBannerProps {
  creatorProfile: CreatorProfile;
  pricingConfig?: SystemPricingConfig;
  onOpenUpgradeModal: () => void;
}

export const TrialWarningBanner: React.FC<TrialWarningBannerProps> = ({
  creatorProfile,
  pricingConfig,
  onOpenUpgradeModal,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [isContactOptionsOpen, setIsContactOptionsOpen] = useState<boolean>(false);

  const expiryInfo = getCreatorExpiryStatus(
    creatorProfile, 
    pricingConfig?.globalTrialDays ?? 30
  );

  // If permanent VIP free, display a discreet VIP badge
  if (expiryInfo.isPermanentFree) {
    return (
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-3 rounded-2xl border border-purple-800/60 shadow-xs flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-400/40">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-extrabold text-[11px] text-purple-200 block">
              VIP Creator Status Active
            </span>
            <span className="text-[9.5px] text-purple-300/80">
              100% Free Lifetime Service & Unlimited QR Generations granted by Admin.
            </span>
          </div>
        </div>
        <span className="text-[9px] bg-purple-600/40 text-purple-200 font-mono font-bold px-2 py-0.5 rounded-full border border-purple-400/30 shrink-0">
          PERMANENT FREE
        </span>
      </div>
    );
  }

  // If not expiring soon and not expired (healthy state), render a neat info bar
  if (!expiryInfo.isExpiringSoon && !expiryInfo.isExpired) {
    return (
      <div className="bg-slate-900/90 text-slate-200 px-3.5 py-2.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-3 h-3" />
          </div>
          <div className="truncate">
            <span className="text-[11px] font-bold text-white">
              {expiryInfo.planTypeLabel}:
            </span>
            <span className="text-[10px] text-slate-400 ml-1.5">
              Valid until <b className="text-slate-200">{expiryInfo.formattedExpiryDate}</b> ({expiryInfo.daysRemaining} days left)
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenUpgradeModal}
          className="text-[10px] text-indigo-300 hover:text-white font-bold flex items-center gap-1 shrink-0 transition hover:underline cursor-pointer"
        >
          <span>Upgrade</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Pre-filled WhatsApp & Email message
  const adminPhone = "+919862300000";
  const adminEmail = "mizopay.adm@gmail.com";
  const queryMessage = `Chibai RonPay Admin,
Ka Creator Trial / Subscription Plan renew ka duh e.
- Hming: ${creatorProfile.name || 'Creator'}
- Org / Kohhran: ${creatorProfile.orgName || 'N/A'}
- Phone: ${creatorProfile.phone || 'N/A'}
- Current Plan: ${expiryInfo.planTypeLabel}
- Expiry Date: ${expiryInfo.formattedExpiryDate}

Khawngaihin renew dan tur leh discount min lo hrilh thei em?`;

  const whatsappUrl = `https://wa.me/919862300000?text=${encodeURIComponent(queryMessage)}`;
  const mailtoUrl = `mailto:${adminEmail}?subject=${encodeURIComponent(`Plan Renewal Request - ${creatorProfile.name}`)}&body=${encodeURIComponent(queryMessage)}`;

  // IF DISMISSED by user, show a compact floating warning bar so it's never forgotten
  if (isDismissed && expiryInfo.daysRemaining > 0) {
    return (
      <div className="bg-amber-500/15 border border-amber-400/40 p-2.5 rounded-2xl flex items-center justify-between text-xs text-amber-900 animate-fadeIn">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 animate-bounce" />
          <span className="text-[11px] font-bold truncate">
            Warning: Trial / Plan expiring in <b className="text-amber-700 font-black">{expiryInfo.daysRemaining} days</b> ({expiryInfo.formattedExpiryDate})
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-2.5 py-1 rounded-lg transition shadow-xs cursor-pointer"
          >
            Renew Plan
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(false)}
            className="text-[10px] text-slate-500 hover:text-slate-800 font-bold px-1.5 py-1 rounded cursor-pointer"
            title="Expand Full Details"
          >
            Details
          </button>
        </div>
      </div>
    );
  }

  // EXPIRING SOON (<= 7 DAYS) OR EXPIRED ALERT CARD
  const isUrgent = expiryInfo.daysRemaining <= 2 || expiryInfo.isExpired;

  return (
    <div
      className={`rounded-2xl border p-4 shadow-md transition relative overflow-hidden animate-fadeIn ${
        expiryInfo.isExpired
          ? 'bg-gradient-to-br from-rose-950 via-slate-900 to-red-950 border-rose-600/80 text-white shadow-rose-950/40'
          : isUrgent
          ? 'bg-gradient-to-br from-rose-900 via-slate-900 to-amber-950 border-rose-500/80 text-white shadow-rose-900/30'
          : 'bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 border-amber-500/80 text-white shadow-amber-950/30'
      }`}
    >
      {/* Background glowing ambient light */}
      <div className="absolute top-0 right-0 -mr-12 -mt-12 w-36 h-36 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />

      {/* Top Header Badge & Countdown */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              expiryInfo.isExpired
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/50'
                : isUrgent
                ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40'
                : 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
            }`}
          >
            {expiryInfo.isExpired ? (
              <ShieldAlert className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  expiryInfo.isExpired
                    ? 'bg-rose-500 text-white'
                    : isUrgent
                    ? 'bg-rose-500/80 text-white'
                    : 'bg-amber-400 text-slate-950 font-black'
                }`}
              >
                {expiryInfo.isExpired
                  ? 'Plan / Trial Expired'
                  : `Expiring in ${expiryInfo.daysRemaining === 0 ? 'Hours' : `${expiryInfo.daysRemaining} Day${expiryInfo.daysRemaining > 1 ? 's' : ''}`}`}
              </span>
              <span className="text-[10px] text-slate-300 font-medium">
                • {expiryInfo.planTypeLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Dismiss Button (only allowed if not expired) */}
        {!expiryInfo.isExpired && (
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
            title="Minimize warning"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Warning Text Body in Mizo & English */}
      <div className="py-3 space-y-1.5 relative z-10">
        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
          {expiryInfo.isExpired ? (
            <>🚫 I Trial / Subscription Plan hun a tawp ta e!</>
          ) : (
            <>
              ⚠️ Hun tiam a tawp dawn hnai e: Ni{' '}
              <span className="text-amber-300 underline font-black">
                {expiryInfo.daysRemaining} chhungin
              </span>{' '}
              a tawp ang!
            </>
          )}
        </h4>

        <p className="text-[11px] text-slate-300 leading-relaxed">
          {expiryInfo.isExpired ? (
            <>
              I account trial / plan chu <b className="text-rose-300">{expiryInfo.formattedExpiryDate}</b> khan a tawp tawh a ni. QR Code siam chhunzawm nan leh donation tluang taka dawng zel turin renew la emaw RonPay Admin be pawp rawh.
            </>
          ) : (
            <>
              I <b className="text-amber-300">{expiryInfo.planTypeLabel}</b> hi{' '}
              <b className="text-white">{expiryInfo.formattedExpiryDate}</b> ({expiryInfo.daysRemaining} days remaining)-ah hian a tawp dawn e. I QR campaign te a chawl lova tluang taka a kal zel nan tunah renew rawh le.
            </>
          )}
        </p>

        <div className="flex items-center gap-2 pt-0.5 text-[10px] text-slate-400 font-mono">
          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
          <span>Deadline Expiry Date: <b className="text-slate-200">{expiryInfo.formattedExpiryDate}</b></span>
        </div>
      </div>

      {/* Action Buttons Cluster */}
      <div className="pt-2 border-t border-white/10 space-y-2 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Action 1: Renew Plan / Upgrade */}
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className="w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            <span>Renew / Upgrade Plan Now</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>

          {/* Action 2: WhatsApp RonPay Admin */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-98 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>WhatsApp Admin (Renewal)</span>
          </a>
        </div>

        {/* Extra Contact Options Toggle (Call / Email / WhatsApp) */}
        <div className="pt-1 flex justify-between items-center text-[10.5px]">
          <button
            type="button"
            onClick={() => setIsContactOptionsOpen(!isContactOptionsOpen)}
            className="text-slate-400 hover:text-white font-semibold flex items-center gap-1 transition cursor-pointer"
          >
            <span>More Contact Options (Call / Email Desk)</span>
            {isContactOptionsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <span className="text-[9.5px] text-slate-400">
            Admin: {adminPhone}
          </span>
        </div>

        {isContactOptionsOpen && (
          <div className="grid grid-cols-2 gap-2 pt-1 animate-fadeIn">
            <a
              href={`tel:${adminPhone}`}
              className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold transition"
            >
              <PhoneCall className="w-3.5 h-3.5 text-indigo-400" />
              <span>Call Helpline ({adminPhone})</span>
            </a>

            <a
              href={mailtoUrl}
              className="bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[11px] font-bold transition truncate"
            >
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              <span>Email ({adminEmail})</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
