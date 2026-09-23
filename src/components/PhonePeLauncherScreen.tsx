import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, ArrowLeft, RefreshCw } from 'lucide-react';
import { getPhonePeMercuryUrl } from '../utils/phonepeDirect';

interface PhonePeLauncherScreenProps {
  amount?: number;
  campaignTitle?: string;
  campaignId?: string;
  donorName?: string;
  donorPhone?: string;
  onBackToApp?: () => void;
}

export const PhonePeLauncherScreen: React.FC<PhonePeLauncherScreenProps> = ({
  amount = 100,
  campaignTitle = 'RonPay Bawm Contribution',
  campaignId,
  donorName = 'Valued Donor',
  donorPhone = '9862000000',
  onBackToApp,
}) => {
  const [mercuryUrl, setMercuryUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('PhonePe PG UAT Portal-ah session siam mek a ni...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const initiateAndRedirect = async () => {
      try {
        setLoading(true);
        setStatusMessage('PhonePe PG UAT portal (mercury-uat.phonepe.com) connect mek a ni...');
        
        const url = await getPhonePeMercuryUrl({
          amountInRupees: amount,
          campaignTitle,
          campaignId,
          donorName,
          donorPhone,
          origin: window.location.origin
        });

        if (isCancelled) return;

        setMercuryUrl(url);
        setStatusMessage('Redirecting to mercury-uat.phonepe.com...');
        
        // Immediate redirection
        setTimeout(() => {
          if (!isCancelled && url) {
            window.location.href = url;
          }
        }, 150);
      } catch (err: any) {
        if (isCancelled) return;
        console.error('PhonePe launcher error:', err);
        setError(err?.message || 'PhonePe gateway connect theih a ni lo.');
        setStatusMessage('PhonePe UAT session hawng tura hmeh a ngai.');
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    initiateAndRedirect();

    return () => {
      isCancelled = true;
    };
  }, [amount, campaignTitle, campaignId, donorName, donorPhone]);

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-orange-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-orange-600/30">
            R
          </div>
          <div className="text-xl font-black tracking-tight text-white">
            Ron<span className="text-orange-500">Pay</span>
          </div>
          <span className="text-slate-600">×</span>
          <div className="w-10 h-10 rounded-2xl bg-[#5f259f] flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-purple-900/40">
            पे
          </div>
          <div className="text-xl font-bold tracking-tight text-purple-400">
            Phone<span className="text-white">Pe</span>
          </div>
        </div>

        {/* Loading Spinner / Icon */}
        <div className="my-4 relative">
          <div className="w-20 h-20 rounded-full border-4 border-purple-900/50 border-t-purple-500 animate-spin flex items-center justify-center" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-bold text-purple-300">पे</span>
          </div>
        </div>

        {/* Status text */}
        <h2 className="text-lg font-bold text-white mt-2 mb-1">
          Opening PhonePe Payment Gateway
        </h2>
        <p className="text-xs text-slate-400 mb-4 px-2">
          {statusMessage}
        </p>

        {/* Payment Details Badge */}
        <div className="w-full bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Payable Amount:</span>
            <span className="font-mono font-bold text-base text-emerald-400">₹{amount.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Merchant:</span>
            <span className="font-semibold text-slate-200">TSPMIZOPAYUAT</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Gateway Target:</span>
            <span className="font-mono text-purple-400 font-medium">mercury-uat.phonepe.com</span>
          </div>
        </div>

        {/* Direct Action Buttons */}
        <div className="w-full space-y-2.5">
          {mercuryUrl ? (
            <a
              href={mercuryUrl}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition transform active:scale-98"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Direct Link: Hawng Rawh (PhonePe Portal)</span>
            </a>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => window.location.reload()}
              className="w-full py-3.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Khawngaihin nghak lawk rawh...' : 'Retry PhonePe Connection'}</span>
            </button>
          )}

          {onBackToApp && (
            <button
              type="button"
              onClick={onBackToApp}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>RonPay Home-ah kir leh rawh</span>
            </button>
          )}
        </div>

        {/* Security Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Official 256-Bit Encrypted PhonePe Sandbox</span>
        </div>
      </div>
    </div>
  );
};
