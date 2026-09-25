import React, { useEffect, useState, useRef } from 'react';
import { RonPayLogo } from './RonPayLogo';
import { Sparkles, ShieldCheck, Zap, ArrowRight } from 'lucide-react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 500,
}) => {
  const [progress, setProgress] = useState(25);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [loadingText, setLoadingText] = useState('RonPay in-ready mek a ni...');

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const dismissSplash = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onFinishRef.current) {
        onFinishRef.current();
      }
    }, 100);
  };

  useEffect(() => {
    const duration = Math.min(600, Math.max(300, minDurationMs));

    // Step-wise progress simulation without getting canceled by parent re-renders
    const t1 = setTimeout(() => {
      setProgress(55);
      setLoadingText('Offline Database & Bawm sync mek...');
    }, 150);

    const t2 = setTimeout(() => {
      setProgress(85);
      setLoadingText('Security & Fast QR Engine ready...');
    }, 280);

    const t3 = setTimeout(() => {
      setProgress(100);
      setLoadingText('In-load fel e!');
    }, Math.max(250, duration - 120));

    const t4 = setTimeout(() => {
      setIsFadingOut(true);
    }, duration);

    const t5 = setTimeout(() => {
      if (onFinishRef.current) {
        onFinishRef.current();
      }
    }, duration + 150);

    // Failsafe safety timer: Guaranteed dismissal after at most 900ms under all network conditions
    const failsafe = setTimeout(() => {
      setIsFadingOut(true);
      if (onFinishRef.current) {
        onFinishRef.current();
      }
    }, 900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(failsafe);
    };
  }, [minDurationMs]);

  return (
    <div
      onClick={dismissSplash}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-gradient-to-b from-[#070f1e] via-[#0a1628] to-[#040914] text-white p-6 transition-opacity duration-300 cursor-pointer select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ minHeight: '100dvh' }}
      title="Click or tap to enter RonPay"
    >
      {/* Background ambient decorative glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />

      {/* Top spacing / subtle status */}
      <div className="w-full flex justify-between items-center max-w-sm pt-2 text-[10.5px] font-semibold text-slate-400/80">
        <span className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Secure Platform</span>
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissSplash();
          }}
          className="flex items-center gap-1 text-amber-400 font-bold bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full border border-amber-400/30 transition text-[10px]"
        >
          <span>Lut Rawh</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Center Hero: RonPay Logo with pulse glow & branding */}
      <div className="relative flex flex-col items-center justify-center my-auto">
        <div className="relative">
          {/* Animated pulsing outer ring */}
          <div className="absolute -inset-3 rounded-[30%] bg-gradient-to-tr from-orange-500/20 via-indigo-500/15 to-transparent blur-md animate-pulse" />
          
          <RonPayLogo size={96} showText={false} />
        </div>

        {/* Brand Name Typography */}
        <div className="mt-4 text-center">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-sans drop-shadow-lg">
            Ron<span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400">Pay</span>
          </h1>
          <p className="text-xs font-semibold text-slate-400 tracking-wide mt-0.5 flex items-center justify-center gap-1.5">
            <span>Mizoram Community & Church QR Portal</span>
          </p>
        </div>

        {/* Shimmering Progress Bar */}
        <div className="w-56 mt-8">
          <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden p-0.5 border border-slate-700/50 relative">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(249,115,22,0.6)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] font-medium text-slate-400 text-center mt-2.5 tracking-tight transition-all duration-200">
            {loadingText}
          </p>
        </div>
      </div>

      {/* Footer Branding & Badges */}
      <div className="w-full max-w-sm flex flex-col items-center gap-2 pb-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-semibold text-slate-300 shadow-inner">
          <Sparkles className="w-3 h-3 text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
          <span>Fast QR • Instant UPI Tracking • Offline Ready</span>
        </div>
        <span className="text-[9.5px] text-slate-500 font-medium">
          Mizoram • Tap screen to open app
        </span>
      </div>
    </div>
  );
};
