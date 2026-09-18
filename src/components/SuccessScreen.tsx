import React, { useEffect, useState, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  CheckCircle2, 
  ArrowLeft, 
  Download, 
  Share2, 
  Receipt, 
  Sparkles, 
  PartyPopper, 
  ShieldCheck, 
  Clock, 
  Copy, 
  Check, 
  HeartHandshake,
  Volume2,
  VolumeX,
  Compass,
  ExternalLink,
  QrCode,
  Bell,
  Printer
} from 'lucide-react';
import { Transaction } from '../types';
import { printHtmlSafely, downloadFileUniversal } from '../utils/export';
import { formatDateTimeDDMMYYYY } from '../utils/date';
import { generateReceiptWebLink, generateReceiptQRDataUrl } from '../utils/qr';
import { triggerReceiptNotification, requestFCMNotificationPermission, getFCMStatus } from '../services/fcmService';
import { getStoredCampaigns } from '../utils/storage';
import { 
  getCampaignCauseTitle, 
  getEffectiveCategory, 
  resolveTxCampaignLocation, 
  formatCategoryBawmLabel 
} from '../utils/translations';

interface SuccessScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
  onExploreMore?: () => void;
}

// Global in-memory and session tracking to strictly prevent repeated chimes / alerts
const playedCelebrationTxIds = new Set<string>();

const hasPlayedCelebration = (txId: string): boolean => {
  if (!txId) return false;
  if (playedCelebrationTxIds.has(txId)) return true;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`ronpay_success_chime_${txId}`) === 'true') {
      playedCelebrationTxIds.add(txId);
      return true;
    }
  } catch {}
  return false;
};

const markCelebrationPlayed = (txId: string) => {
  if (!txId) return;
  playedCelebrationTxIds.add(txId);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`ronpay_success_chime_${txId}`, 'true');
    }
  } catch {}
};

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  transaction,
  onGoHome,
  onExploreMore,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [receiptQrUrl, setReceiptQrUrl] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [fcmEnabled, setFcmEnabled] = useState<boolean>(false);

  // Intercept mobile hardware back button on receipt screen so it returns to home cleanly without looping
  useEffect(() => {
    const handlePopState = () => {
      onGoHome();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onGoHome]);

  useEffect(() => {
    if (transaction) {
      // 1. Generate Receipt QR Data URL
      generateReceiptQRDataUrl(transaction.id).then(url => setReceiptQrUrl(url)).catch(() => {});
      
      // 2. Trigger instant FCM receipt notification (playSound: false to avoid double-chime)
      triggerReceiptNotification(transaction, undefined, { playSound: false });

      // 3. Check FCM status
      const status = getFCMStatus();
      setFcmEnabled(status.permission === 'granted');
    }
  }, [transaction?.id]);

  const webReceiptLink = transaction ? generateReceiptWebLink(transaction.id) : '';

  const effectiveCategory = useMemo(() => {
    return getEffectiveCategory(transaction);
  }, [transaction]);

  const categoryLabel = useMemo(() => {
    return formatCategoryBawmLabel(effectiveCategory);
  }, [effectiveCategory]);

  const bawmLocation = useMemo(() => {
    return resolveTxCampaignLocation(transaction);
  }, [transaction]);

  const displayCampaignTitle = useMemo(() => {
    if (!transaction) return 'RonPay Community Cause';
    if (transaction.campaignId === 'cmp-1788527889945' || transaction.campaignTitle === 'Pocket Money') {
      return 'Pocket Money';
    }
    if (transaction.campaignId === 'cmp-1788526889943' || transaction.campaignTitle === 'Lalrinpuii Ralna') {
      return 'Lalrinpuii Ralna';
    }
    if (transaction.campaignTitle === 'BCM Ebenezer') {
      return effectiveCategory === 'ralna' ? 'Lalrinpuii Ralna' : 'Pocket Money';
    }
    const allCamps = getStoredCampaigns();
    const matched = allCamps.find(c => c.id === transaction.campaignId);
    if (matched) {
      const causeTitle = getCampaignCauseTitle(matched);
      if (causeTitle && causeTitle !== 'RonPay Community Bawm') {
        return causeTitle;
      }
    }
    if (transaction.category === 'ralna' && (transaction.campaignTitle === 'BCM Ebenezer' || !transaction.campaignTitle)) {
      return 'Lalrinpuii Ralna';
    }
    if (transaction.category === 'khawlsak' && transaction.campaignTitle === 'BCM Ebenezer') {
      return 'Pocket Money';
    }
    return transaction.campaignTitle || 'RonPay Community Cause';
  }, [transaction, effectiveCategory]);

  // Synthesize a joyful celebratory chime using Web Audio API
  const playCelebrationChime = () => {
    if (isSoundMuted) return;
    const txId = transaction?.id || 'tx_default';
    if (hasPlayedCelebration(txId)) {
      return;
    }
    markCelebrationPlayed(txId);
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 chord
      const startTime = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime + idx * 0.1);

        gain.gain.setValueAtTime(0.01, startTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.3, startTime + idx * 0.1 + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.1 + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime + idx * 0.1);
        osc.stop(startTime + idx * 0.1 + 0.65);
      });
    } catch (e) {
      // Audio autoplay policy fallback
    }
  };

  // Launch multi-stage celebratory fireworks & confetti
  const triggerCelebration = () => {
    try {
      playCelebrationChime();

      // Burst 1: Center explosive fountain
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#10B981', '#6366F1', '#F59E0B', '#EC4899', '#8B5CF6', '#3B82F6'],
        ticks: 200,
        gravity: 0.9,
        scalar: 1.1,
      });

      // Burst 2: Left cannon stream
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 65,
          origin: { x: 0.05, y: 0.7 },
          colors: ['#F59E0B', '#10B981', '#6366F1', '#38BDF8'],
        });
      }, 220);

      // Burst 3: Right cannon stream
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 65,
          origin: { x: 0.95, y: 0.7 },
          colors: ['#EC4899', '#8B5CF6', '#F59E0B', '#10B981'],
        });
      }, 380);

      // Burst 4: Gold star sparkle shower
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 120,
          origin: { y: 0.4 },
          shapes: ['circle'],
          colors: ['#FDE047', '#F59E0B', '#FEF08A'],
          scalar: 1.2,
        });
      }, 550);
    } catch (e) {
      // Ignore if canvas is not accessible
    }
  };

  useEffect(() => {
    const txId = transaction?.id || 'tx_default';
    if (!hasPlayedCelebration(txId)) {
      triggerCelebration();
    }
  }, [transaction?.id]);

  const handleShareReceipt = async () => {
    const receiptLink = webReceiptLink || `${window.location.origin}/?receipt=${transaction?.id || ''}`;
    const text = `🎉 *RonPay Official Digital Receipt*\n\n` +
      `🏛️ *Bawm:* ${displayCampaignTitle}\n` +
      `👤 *Donor:* ${transaction?.isAnonymous ? 'Anonymous' : (transaction?.donorName || 'Consumer User')}\n` +
      `💰 *Amount:* ₹${transaction?.amount.toFixed(2) || '0.00'}\n` +
      `💳 *Platform Fee:* ₹${transaction?.platformFee.toFixed(2) || '0.00'}\n` +
      `✅ *Total Settled:* ₹${transaction?.totalAmount.toFixed(2) || '0.00'}\n` +
      `🔖 *TXN ID:* ${transaction?.id || 'RPAY2026'}\n` +
      `🕒 *Time:* ${new Date(transaction?.timestamp || Date.now()).toLocaleString()}\n\n` +
      `🌐 *View Verified Digital Receipt Online:*\n${receiptLink}\n\n` +
      `Verified by RonPay Smart Payment Infrastructure.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RonPay Payment Slip',
          text: text,
          url: receiptLink
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyReceiptLink = () => {
    if (!webReceiptLink) return;
    navigator.clipboard.writeText(webReceiptLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleEnableFCM = async () => {
    const res = await requestFCMNotificationPermission();
    if (res.granted) {
      setFcmEnabled(true);
      if (transaction) triggerReceiptNotification(transaction);
    }
  };

  const handleDownloadReceipt = () => {
    if (!transaction) return;
    const subcatsHtml = transaction.subCategoryBreakdown && Object.keys(transaction.subCategoryBreakdown).length > 0
      ? `<div style="margin: 15px 0; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #475569;">ITEMIZED BREAKDOWN:</div>
          ${Object.entries(transaction.subCategoryBreakdown).map(([k, v]) => `
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
              <span>${k}</span>
              <b>₹${v}</b>
            </div>
          `).join('')}
        </div>`
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>RonPay Official Receipt - ${transaction.id}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 30px 20px; color: #1e1b4b; text-align: center; background: #f8fafc; }
            .receipt-card { max-width: 400px; margin: 0 auto; border: 2px solid #4338ca; border-radius: 20px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: left; background: #ffffff; }
            .badge { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; display: inline-block; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
            .label { color: #64748b; }
            .val { font-weight: bold; color: #0f172a; }
            .amount-box { background: #f1f5f9; padding: 15px; border-radius: 12px; text-align: center; margin: 15px 0; border: 1px dashed #cbd5e1; }
            .amount-val { font-size: 26px; font-weight: 900; color: #047857; }
            .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="margin: 0; color: #1e1b4b; font-size: 20px;">RONPAY OFFICIAL RECEIPT</h2>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Mizoram Community & Bawm Payment</div>
              <div style="margin-top: 8px;"><span class="badge">PAID & VERIFIED</span></div>
            </div>

            <div class="amount-box">
              <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Pek Zat (Amount)</div>
              <div class="amount-val">₹${transaction.amount.toLocaleString('en-IN')}</div>
            </div>

            <div class="row">
              <span class="label">Receipt No / TX ID:</span>
              <span class="val" style="font-family: monospace;">${transaction.id}</span>
            </div>
            <div class="row">
              <span class="label">Date & Time:</span>
              <span class="val">${formatDateTimeDDMMYYYY(transaction.timestamp)}</span>
            </div>
            ${transaction.periodLabel ? `
              <div class="row">
                <span class="label">Pek Hun / Period:</span>
                <span class="val" style="color: #4338ca;">${transaction.periodLabel}</span>
              </div>
            ` : ''}
            <div class="row">
              <span class="label">Category / Bawm:</span>
              <span class="val" style="text-transform: uppercase; color: #4338ca; font-weight: 800;">${categoryLabel}</span>
            </div>
            <div class="row">
              <span class="label">Bawm / Pawisa thawh chhan:</span>
              <span class="val" style="font-weight: bold; color: #1e1b4b;">${displayCampaignTitle}</span>
            </div>
            <div class="row">
              <span class="label">Petu Hming:</span>
              <span class="val">${transaction.isAnonymous ? 'Anonymous' : (transaction.donorName || 'User')}</span>
            </div>
            <div class="row">
              <span class="label">Payment Mode:</span>
              <span class="val" style="text-transform: uppercase;">${transaction.paymentMethod === 'cash' ? '💵 CASH DEPOSIT' : '⚡ ONLINE UPI'}</span>
            </div>
            ${transaction.remark ? `
            <div class="row">
              <span class="label">Remark:</span>
              <span class="val" style="font-style: italic;">${transaction.remark}</span>
            </div>
            ` : ''}

            ${subcatsHtml}

            <div class="row" style="font-size: 10px; margin-top: 10px;">
              <span class="label">Hash:</span>
              <span class="val" style="font-family: monospace; font-size: 9px;">${transaction.txHash || 'RPAY-HASH-OK'}</span>
            </div>

            <div class="footer">
              Hei hi RonPay System generated receipt a ni a, signature a ngai lo.<br/>
              <b>RonPay Mizoram Community Platform</b>
            </div>
          </div>
        </body>
      </html>
    `;
    printHtmlSafely(html, `RonPay Receipt - ${transaction.id}`);
  };

  return (
    <div className="space-y-4 text-center pt-4 pb-2 animate-fadeIn max-w-lg mx-auto relative px-1">
      
      {/* Decorative Celebration CSS Aura & Particles */}
      <div className="relative py-2 flex flex-col items-center justify-center">
        {/* Pulsing Concentric Ripple Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-28 h-28 bg-emerald-400/20 rounded-full animate-ping opacity-60"></div>
          <div className="w-20 h-20 bg-emerald-300/30 rounded-full animate-pulse"></div>
        </div>

        {/* Celebratory Icon with Shield & Glow */}
        <div className="relative z-10 w-20 h-20 bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 text-white rounded-3xl flex items-center justify-center mx-auto text-4xl shadow-xl shadow-emerald-500/30 border-2 border-emerald-300/60 transform hover:scale-105 transition-transform duration-300">
          <CheckCircle2 className="w-11 h-11 drop-shadow-md animate-bounce" />
          
          {/* Top-Right Sparkling Badge */}
          <span className="absolute -top-2 -right-2 bg-amber-400 text-slate-950 p-1.5 rounded-full shadow-md border-2 border-white animate-pulse">
            <Sparkles className="w-3.5 h-3.5 fill-amber-950" />
          </span>
        </div>

        {/* Sound toggle button */}
        <button
          type="button"
          onClick={() => {
            setIsSoundMuted(!isSoundMuted);
            if (isSoundMuted) playCelebrationChime();
          }}
          className="absolute top-0 right-2 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer text-xs flex items-center gap-1 shadow-2xs"
          title={isSoundMuted ? "Sound on" : "Sound off"}
        >
          {isSoundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-600" />}
        </button>
      </div>

      {/* Main Success Title & Subtitle */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-black border border-emerald-200 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Verified & Instant Settlement</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Payment Successful! 🎉
        </h2>
        <p className="text-xs text-slate-500 px-4 font-medium max-w-sm mx-auto leading-relaxed">
          I thawhkhawm / pekna chu hlawhtling taka tihfel a ni a, bawm neitute hnenah a lut fel ta e.
        </p>
      </div>

      {/* Replay Confetti interactive button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={triggerCelebration}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-extrabold border border-amber-300/80 shadow-2xs transition active:scale-95 cursor-pointer"
        >
          <PartyPopper className="w-3.5 h-3.5 text-amber-600" />
          <span>Replay Celebration 🎉</span>
        </button>
      </div>

      {/* Detailed Receipt Card */}
      <div className="bg-gradient-to-b from-emerald-50/90 via-white to-slate-50 border-2 border-emerald-200/90 p-4 sm:p-5 rounded-3xl mx-1 text-left space-y-3 text-xs shadow-md shadow-emerald-600/5 relative overflow-hidden">
        
        {/* Top Campaign Banner */}
        <div className="flex items-start justify-between gap-2 border-b border-emerald-100 pb-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">
              {categoryLabel}
            </span>
            <h3 className="font-black text-sm text-slate-900 truncate">
              {displayCampaignTitle}
            </h3>
            {bawmLocation && (
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                📍 {bawmLocation}
              </p>
            )}
          </div>
          <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 shadow-2xs">
            COMPLETED
          </span>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-medium">Donor Name:</span>
            <span className="font-black text-slate-900">
              {transaction?.isAnonymous ? 'Anonymous (Hming thup)' : (transaction?.donorName || 'Community Member')}
            </span>
          </div>

          {(transaction?.memberId || transaction?.subId) && (
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Member ID / Sub-ID:</span>
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 text-[11px]">
                {transaction?.subId || transaction?.memberId}
              </span>
            </div>
          )}

          {transaction?.subCategory && (
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Fund / Category:</span>
              <span className="font-bold text-indigo-900 bg-indigo-50/80 px-2 py-0.5 rounded-md text-[11px]">
                {transaction.subCategory}
              </span>
            </div>
          )}

          {transaction?.donorPhone && !transaction.isAnonymous && (
            <div className="flex justify-between items-center text-slate-600">
              <span className="font-medium">Donor Phone:</span>
              <span className="font-mono text-slate-800 font-bold">
                {transaction.donorPhone}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1 border-t border-slate-200/70">
            <span className="text-slate-600 font-medium">Principal Amount:</span>
            <span className="font-black text-emerald-700 text-sm sm:text-base">
              ₹{transaction?.amount.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500 text-[11px]">
            <span className="font-medium">Platform Fee:</span>
            <span className="font-bold text-slate-700">
              ₹{transaction?.platformFee.toFixed(2) || '0.00'}
            </span>
          </div>

          <div className="flex justify-between items-center border-t-2 border-dashed border-emerald-300 pt-2 font-black text-slate-900 bg-emerald-100/50 p-2 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-emerald-950">Total Amount Settled:</span>
            <span className="text-base text-emerald-800 font-black">
              ₹{transaction?.totalAmount.toFixed(2) || '0.00'}
            </span>
          </div>
        </div>

        {/* Footer Meta Details */}
        <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 font-mono space-y-1">
          <div className="flex justify-between items-center">
            <span>TXN ID:</span>
            <span className="font-bold text-slate-700">{transaction?.id || 'RPAY-2026-OK'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>TIME:</span>
            <span>{new Date(transaction?.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
          {transaction?.txHash && (
            <div className="flex justify-between items-center truncate">
              <span>HASH:</span>
              <span className="truncate max-w-[170px] text-slate-600">{transaction.txHash}</span>
            </div>
          )}
        </div>
      </div>

      {/* Web-Accessible Digital Receipt Portal Card */}
      <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white p-4 rounded-3xl mx-1 shadow-md border border-indigo-700/60 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0">
              <ExternalLink className="w-4 h-4 text-indigo-300" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white">Web-Accessible Digital Receipt</h4>
              <p className="text-[10px] text-indigo-200">Device dang emaw browser engah pawh hawn theih</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowQrModal(!showQrModal)}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-[10px] font-bold text-indigo-200 flex items-center gap-1 cursor-pointer transition"
          >
            <QrCode className="w-3.5 h-3.5 text-amber-300" />
            {showQrModal ? 'Hide QR' : 'Receipt QR'}
          </button>
        </div>

        {/* QR Code expansion */}
        {showQrModal && receiptQrUrl && (
          <div className="p-3 bg-white text-slate-900 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 border border-indigo-200">
            <img src={receiptQrUrl} alt="Receipt QR" className="w-40 h-40 rounded-xl shadow-xs" />
            <p className="text-[10px] text-slate-500 font-medium">
              Phone camera emaw scanner dangin scan la, live digital receipt a inhawng nghal ang.
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 pl-3">
          <span className="text-[10px] font-mono text-slate-300 truncate flex-1 select-all">
            {webReceiptLink || `${window.location.origin}/?receipt=${transaction?.id || ''}`}
          </span>
          <button
            type="button"
            onClick={handleCopyReceiptLink}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black shrink-0 transition flex items-center gap-1 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            {copiedLink ? 'Copied' : 'Copy Link'}
          </button>
        </div>

        {/* FCM Push Notification Info / Toggle */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10.5px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Real-Time Receipt Push (FCM):</span>
          </div>
          {fcmEnabled ? (
            <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2 py-0.5 rounded-full">
              ✓ Active / Delivered
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableFCM}
              className="text-[9.5px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
            >
              Enable Browser Push
            </button>
          )}
        </div>
      </div>

      {/* Share & Download Action Buttons Strip */}
      <div className="grid grid-cols-2 gap-2.5 px-1">
        <button
          type="button"
          onClick={handleShareReceipt}
          className="flex items-center justify-center gap-1.5 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-2xl text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-indigo-600" />}
          <span>{copied ? 'Copied Receipt!' : 'Share Receipt Slip'}</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadReceipt}
          className="flex items-center justify-center gap-1.5 py-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 rounded-2xl text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Download E-Receipt</span>
        </button>
      </div>

      {/* Primary Navigation Buttons */}
      <div className="pt-1 px-1 space-y-2">
        <button
          type="button"
          id="back-to-home-btn"
          onClick={onGoHome}
          className="w-full bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3.5 rounded-2xl transition text-xs shadow-lg shadow-indigo-600/25 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home Screen</span>
        </button>

        {onExploreMore && (
          <button
            type="button"
            onClick={onExploreMore}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-2.5 rounded-xl transition text-xs cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            <span>Explore Other Community Causes</span>
          </button>
        )}
      </div>

    </div>
  );
};
