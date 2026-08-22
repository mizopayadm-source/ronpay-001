import React, { useEffect, useState } from 'react';
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
  Compass
} from 'lucide-react';
import { Transaction } from '../types';

interface SuccessScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
  onExploreMore?: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  transaction,
  onGoHome,
  onExploreMore,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);

  // Synthesize a joyful celebratory chime using Web Audio API
  const playCelebrationChime = () => {
    if (isSoundMuted) return;
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
    triggerCelebration();
  }, []);

  const handleShareReceipt = async () => {
    const text = `🎉 *RonPay Payment Receipt*\n\n` +
      `🏛️ *Bawm:* ${transaction?.campaignTitle || 'RonPay Community Bawm'}\n` +
      `👤 *Donor:* ${transaction?.isAnonymous ? 'Anonymous' : (transaction?.donorName || 'Consumer User')}\n` +
      `💰 *Amount:* ₹${transaction?.amount.toFixed(2) || '0.00'}\n` +
      `💳 *Platform Fee:* ₹${transaction?.platformFee.toFixed(2) || '0.00'}\n` +
      `✅ *Total Settled:* ₹${transaction?.totalAmount.toFixed(2) || '0.00'}\n` +
      `🔖 *TXN ID:* ${transaction?.id || 'RPAY2026'}\n` +
      `🕒 *Time:* ${new Date(transaction?.timestamp || Date.now()).toLocaleString()}\n\n` +
      `Verified by RonPay Smart Payment Infrastructure.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RonPay Payment Slip',
          text: text,
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

  const handleDownloadReceipt = () => {
    const text = `=========================================\n` +
      `             RONPAY PAYMENT SLIP         \n` +
      `      Digital Donation & Thawhkhawm      \n` +
      `=========================================\n\n` +
      `RECEIPT NO: ${transaction?.id || 'RPAY-TXN'}\n` +
      `DATE/TIME : ${new Date(transaction?.timestamp || Date.now()).toLocaleString()}\n` +
      `STATUS    : PAYMENT SUCCESSFUL (VERIFIED)\n` +
      `-----------------------------------------\n` +
      `CAMPAIGN  : ${transaction?.campaignTitle || 'RonPay Campaign'}\n` +
      `DONOR     : ${transaction?.isAnonymous ? 'Anonymous (Hming Thup)' : (transaction?.donorName || 'User')}\n` +
      `MEMBER ID : ${transaction?.memberId || 'N/A'}\n` +
      `SUB-ID    : ${transaction?.subId || 'N/A'}\n` +
      `METHOD    : ${transaction?.paymentMethod === 'cash' ? 'Cash Handover' : 'UPI Online'}\n` +
      `-----------------------------------------\n` +
      `AMOUNT PAID      : Rs. ${transaction?.amount.toFixed(2)}\n` +
      `PLATFORM FEE     : Rs. ${transaction?.platformFee.toFixed(2)}\n` +
      `TOTAL SETTLED    : Rs. ${transaction?.totalAmount.toFixed(2)}\n` +
      `TXN HASH         : ${transaction?.txHash || 'TXN-OK'}\n` +
      `=========================================\n` +
      `Thank you for your generous contribution!\n` +
      `RonPay Mizoram Community Platform\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RonPay_Receipt_${transaction?.id || 'Payment'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 text-center py-4 animate-fadeIn pb-8 max-w-lg mx-auto relative px-1">
      
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
              {transaction?.category ? `${transaction.category.toUpperCase()} BAWM` : 'RONPAY DONATION'}
            </span>
            <h3 className="font-black text-sm text-slate-900 truncate">
              {transaction?.campaignTitle || 'RonPay Community Cause'}
            </h3>
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
