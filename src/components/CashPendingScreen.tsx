import React from 'react';
import { Clock, Check, ArrowLeft, AlertCircle, Banknote } from 'lucide-react';
import { Transaction } from '../types';

interface CashPendingScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
}

export const CashPendingScreen: React.FC<CashPendingScreenProps> = ({
  transaction,
  onGoHome,
}) => {
  return (
    <div className="space-y-4 text-center py-6 animate-fadeIn pb-8">
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

      <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl mx-1 text-left space-y-2 text-xs shadow-xs">
        <div className="flex justify-between items-center border-b border-amber-200 pb-2">
          <span className="text-slate-500 font-medium">Status:</span>
          <span className="font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] border border-amber-300">
            PENDING VERIFICATION
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Petu Hming:</span>
          <span className="font-bold text-slate-900">
            {transaction?.isAnonymous ? 'Anonymous (Hming thup)' : transaction?.donorName}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Cash Amount:</span>
          <span className="font-black text-slate-900 text-sm">
            ₹{transaction?.amount.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Gateway Fee:</span>
          <span className="font-black text-emerald-700">₹0.00 (Free)</span>
        </div>

        <div className="flex justify-between items-center border-t border-amber-200 pt-2 text-[10px] text-slate-400 font-mono">
          <span>Receipt Token:</span>
          <span>{transaction?.id || 'RPAYCASH2026'}</span>
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
