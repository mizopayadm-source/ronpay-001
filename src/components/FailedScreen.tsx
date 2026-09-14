import React, { useState, useMemo } from 'react';
import { 
  XCircle, 
  ArrowLeft, 
  RefreshCw, 
  ShieldCheck, 
  Copy, 
  Check, 
  Compass, 
  AlertCircle,
  HelpCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Transaction } from '../types';
import { formatDateTimeDDMMYYYY } from '../utils/date';
import { getStoredCampaigns } from '../utils/storage';
import { 
  getCampaignCauseTitle, 
  getEffectiveCategory, 
  resolveTxCampaignLocation, 
  formatCategoryBawmLabel 
} from '../utils/translations';

interface FailedScreenProps {
  transaction: Transaction | null;
  reason?: string;
  onRetry: () => void;
  onGoHome: () => void;
  onExploreMore?: () => void;
}

export const FailedScreen: React.FC<FailedScreenProps> = ({
  transaction,
  reason,
  onRetry,
  onGoHome,
  onExploreMore,
}) => {
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [showHelp, setShowHelp] = useState<boolean>(false);

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
    return transaction.campaignTitle || 'RonPay Community Cause';
  }, [transaction, effectiveCategory]);

  const handleCopyId = () => {
    const idToCopy = transaction?.id || '';
    if (!idToCopy) return;
    navigator.clipboard.writeText(idToCopy).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    });
  };

  const formattedAmount = transaction?.amount ? transaction.amount.toFixed(2) : '0.00';
  const formattedFee = transaction?.platformFee !== undefined ? transaction.platformFee.toFixed(2) : '0.00';
  const formattedTotal = transaction?.totalAmount ? transaction.totalAmount.toFixed(2) : formattedAmount;

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-4 text-center pb-24 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Top Failure Badge Icon */}
      <div className="relative pt-2">
        <div className="w-20 h-20 mx-auto rounded-full bg-linear-to-tr from-rose-600 to-red-500 flex items-center justify-center shadow-xl shadow-rose-600/25 ring-8 ring-rose-100/70 dark:ring-rose-950/40 animate-pulse">
          <XCircle className="w-10 h-10 text-white" strokeWidth={2.5} />
        </div>
      </div>

      {/* Main Status Title & Subtitle */}
      <div className="space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-100 text-rose-800 rounded-full text-[11px] font-black border border-rose-200 shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Payment Failed / Cancelled</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
          Pawisa Pek A Hlawhtling Lo
        </h2>
        <p className="text-xs text-slate-500 px-4 font-medium max-w-sm mx-auto leading-relaxed">
          PhonePe gateway aṭangin payment hi tih tlang a ni lo e. Khawngaihin a hnuaiah i ti nawn leh thei e.
        </p>
      </div>

      {/* Reassurance Banner */}
      <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3 text-left flex items-start gap-2.5 mx-1 shadow-2xs">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <span className="font-bold text-emerald-900 block">Bank Account A Him E (Zero Deduction)</span>
          <span className="text-[11px] text-emerald-700 leading-normal">
            Payment hi cancel emaw hlawhchham a nih avangin i bank account aṭangin pawisa a in cut lo e.
          </span>
        </div>
      </div>

      {/* Detailed Payment Attempt Breakdown Card */}
      <div className="bg-gradient-to-b from-rose-50/70 via-white to-slate-50 border-2 border-rose-200/80 p-4 sm:p-5 rounded-3xl mx-1 text-left space-y-3 text-xs shadow-md shadow-rose-600/5 relative overflow-hidden">
        
        {/* Top Campaign Banner */}
        <div className="flex items-start justify-between gap-2 border-b border-rose-100 pb-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider">
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
          <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shrink-0 shadow-2xs">
            FAILED
          </span>
        </div>

        {/* Breakdown Items */}
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-600">
            <span className="font-medium">Donor Name:</span>
            <span className="font-black text-slate-900">
              {transaction?.isAnonymous ? 'Anonymous (Hming thup)' : (transaction?.donorName || 'Valued User')}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span className="font-medium">Payment Gateway:</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 text-[11px]">
              PhonePe PG V2
            </span>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-200/70">
            <span className="text-slate-600 font-medium">Attempted Amount:</span>
            <span className="font-black text-slate-900 text-sm sm:text-base">
              ₹{formattedAmount}
            </span>
          </div>

          <div className="flex justify-between items-center text-slate-500 text-[11px]">
            <span className="font-medium">Platform Fee:</span>
            <span className="font-bold text-slate-700">
              ₹{formattedFee}
            </span>
          </div>

          <div className="flex justify-between items-center border-t-2 border-dashed border-rose-200 pt-2 font-black text-slate-900 bg-rose-50/70 p-2.5 rounded-xl">
            <span className="text-xs uppercase tracking-wider text-rose-950">Total Amount:</span>
            <span className="text-base text-rose-800 font-black">
              ₹{formattedTotal}
            </span>
          </div>
        </div>

        {/* Reason notice */}
        <div className="pt-2 border-t border-slate-200/80 text-[11px] text-rose-700 bg-rose-50/60 p-2.5 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-bold block text-rose-900">Failure Reason:</span>
            <span>{reason || 'User cancelled payment on PhonePe or the transaction timed out.'}</span>
          </div>
        </div>

        {/* Footer Meta Details */}
        <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-500 font-mono space-y-1">
          <div className="flex justify-between items-center">
            <span>TXN ID:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">{transaction?.id || 'RPAY_TXN_FAILED'}</span>
              <button
                type="button"
                onClick={handleCopyId}
                className="p-1 text-slate-500 hover:text-slate-700 cursor-pointer"
                title="Copy TXN ID"
              >
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span>TIME:</span>
            <span>{transaction?.timestamp ? formatDateTimeDDMMYYYY(transaction.timestamp) : new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Help / Guidance Accordion */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mx-1 text-left text-xs">
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="w-full flex items-center justify-between font-bold text-slate-700 cursor-pointer text-xs"
        >
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            <span>Engvangin nge a fail? Pawisa a in cut palh em?</span>
          </div>
          <span className="text-[10px] text-indigo-600 underline">
            {showHelp ? 'Thup rawh' : 'En rawh'}
          </span>
        </button>

        {showHelp && (
          <div className="mt-2.5 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600 space-y-2 leading-relaxed animate-in fade-in duration-200">
            <p>
              • <b>Payment Cancelled:</b> PhonePe tab-ah khan cancel i hmet emaw, UPI PIN dah hmain i kalsan a nih chuan a cancel thin.
            </p>
            <p>
              • <b>Bank Issue:</b> I bank server temporary-in a down emaw, UPI server a buai a nih chuan a fail thei bawk.
            </p>
            <p>
              • <b>Pawisa a in cut palh a nih chuan:</b> PhonePe hian 24-48 hours chhungin i bank account-ah a rawn auto-refund leh nghal vek thin.
            </p>
          </div>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="pt-2 px-1 space-y-2.5">
        {/* Retry Button */}
        <button
          type="button"
          id="retry-payment-btn"
          onClick={onRetry}
          className="w-full bg-linear-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3.5 rounded-2xl transition text-xs shadow-lg shadow-indigo-600/25 cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Ti Nawn Leh Rawh (Retry Payment)</span>
        </button>

        {/* Go Home Button */}
        <button
          type="button"
          id="failed-back-home-btn"
          onClick={onGoHome}
          className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold py-3 rounded-2xl transition text-xs shadow-2xs cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RonPay Home-ah Let Rawh</span>
        </button>

        {/* Explore Other Causes */}
        {onExploreMore && (
          <button
            type="button"
            onClick={onExploreMore}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition text-xs cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            <span>Campaign Dang En Rawh</span>
          </button>
        )}
      </div>
    </div>
  );
};
