import React, { useMemo } from 'react';
import { Clock, Check, ArrowLeft, AlertCircle, Banknote, ShieldCheck } from 'lucide-react';
import { Transaction, CreatorProfile, Campaign } from '../types';
import { getStoredTransactions } from '../utils/storage';

interface CashPendingScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
  creatorName?: string;
  creatorProfile?: CreatorProfile | null;
  campaigns?: Campaign[];
  onApprove?: (approvedTx: any) => void;
  onReject?: (rejectedTx: any) => void;
}

export const CashPendingScreen: React.FC<CashPendingScreenProps> = ({
  transaction,
  onGoHome,
  creatorName,
  creatorProfile,
  campaigns,
  onApprove,
  onReject,
}) => {
  // Resolve effective transaction data from props, localStorage, URL params, or stored cash transactions
  const effectiveTx = useMemo<Partial<Transaction> | null>(() => {
    // 1. If passed via prop and has valid amount
    if (transaction && (transaction.amount > 0 || transaction.totalAmount > 0 || transaction.donorName)) {
      return transaction;
    }

    if (typeof window !== 'undefined') {
      // 2. Check localStorage last cash entry
      try {
        const saved = localStorage.getItem('RONPAY_LAST_CASH_TXN');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && (parsed.amount > 0 || parsed.totalAmount > 0 || parsed.donorName)) {
            return parsed;
          }
        }
      } catch {}

      // 3. Check URL parameters
      try {
        const url = new URL(window.location.href);
        const amtStr = url.searchParams.get('amt') || url.searchParams.get('amount');
        const donorStr = url.searchParams.get('donor') || url.searchParams.get('donorName');
        const receiptStr = url.searchParams.get('receipt') || url.searchParams.get('receiptId') || url.searchParams.get('txnId') || url.searchParams.get('tx');
        const cidStr = url.searchParams.get('cid') || url.searchParams.get('campaignId') || url.searchParams.get('campaign');
        const ctitleStr = url.searchParams.get('ctitle') || url.searchParams.get('campaignTitle') || url.searchParams.get('title');
        const isAnon = url.searchParams.get('anon') === '1' || url.searchParams.get('anon') === 'true';

        if (amtStr || receiptStr || donorStr) {
          const parsedAmt = amtStr ? parseFloat(amtStr) : 0;
          return {
            id: receiptStr || 'RPAYCASH2026',
            campaignId: cidStr || 'cmp-custom',
            campaignTitle: ctitleStr ? decodeURIComponent(ctitleStr) : 'RonPay Community Bawm',
            category: 'others',
            donorName: donorStr ? decodeURIComponent(donorStr) : 'Valued Donor',
            amount: !isNaN(parsedAmt) ? parsedAmt : 0,
            totalAmount: !isNaN(parsedAmt) ? parsedAmt : 0,
            platformFee: 0,
            paymentMethod: 'cash',
            status: 'pending_verification',
            isAnonymous: isAnon,
            timestamp: new Date().toISOString(),
            txHash: 'CASH' + Date.now()
          };
        }
      } catch {}

      // 4. Check stored transactions for most recent cash transaction
      try {
        const storedTxs = getStoredTransactions();
        const cashTxs = storedTxs
          .filter(t => t.paymentMethod === 'cash')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (cashTxs.length > 0) {
          return cashTxs[0];
        }
      } catch {}
    }

    return transaction;
  }, [transaction]);

  const rawAmount = effectiveTx?.amount ?? effectiveTx?.totalAmount ?? 0;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : (parseFloat(String(rawAmount)) || 0);

  const isAnonymous = Boolean(effectiveTx?.isAnonymous);
  const donorName = isAnonymous 
    ? 'Anonymous (Hming thup)' 
    : (effectiveTx?.donorName && effectiveTx.donorName.trim() !== '' ? effectiveTx.donorName : 'Valued Donor');

  const receiptToken = effectiveTx?.id || 'RPAYCASH2026';
  const campaignTitle = effectiveTx?.campaignTitle || (effectiveTx?.campaignId ? campaigns?.find(c => c.id === effectiveTx?.campaignId)?.title : undefined);

  return (
    <div className="space-y-4 text-center pt-5 pb-2 animate-fadeIn max-w-md mx-auto">
      {/* Clock icon */}
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-200 shadow-md animate-bounce">
        <Clock className="w-9 h-9" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-black text-slate-900">Cash Entry Submitted!</h2>
        <p className="text-xs text-slate-500 px-4 font-medium leading-relaxed">
          I cash pek luh hi Creator/Admin hian verification a la kalpui dawn a ni.
        </p>
      </div>

      <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl mx-1 text-left space-y-2.5 text-xs shadow-xs">
        <div className="flex justify-between items-center border-b border-amber-200 pb-2">
          <span className="text-slate-500 font-medium">Status:</span>
          <span className="font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] border border-amber-300 flex items-center gap-1">
            <Clock className="w-3 h-3" /> PENDING VERIFICATION
          </span>
        </div>

        {campaignTitle && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Bawm:</span>
            <span className="font-bold text-slate-800 text-right truncate max-w-[210px]">
              {campaignTitle}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Petu Hming:</span>
          <span className="font-bold text-slate-900">
            {donorName}
          </span>
        </div>

        <div className="flex justify-between items-center bg-white/70 p-2.5 rounded-xl border border-amber-200/80">
          <span className="text-slate-700 font-bold">Cash Amount:</span>
          <span className="font-black text-emerald-700 text-base">
            ₹{numAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Gateway Fee:</span>
          <span className="font-black text-emerald-700">₹0.00 (Free)</span>
        </div>

        {effectiveTx?.timestamp && (
          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span className="font-medium">Pek Hun:</span>
            <span className="font-semibold text-slate-700">
              {new Date(effectiveTx.timestamp).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center border-t border-amber-200 pt-2 text-[10px] text-slate-400 font-mono">
          <span>Receipt Token:</span>
          <span className="font-semibold text-slate-600">{receiptToken}</span>
        </div>
      </div>

      <div className="pt-2 px-1">
        <button
          onClick={onGoHome}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl transition text-xs shadow-md cursor-pointer active:scale-[0.99]"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

