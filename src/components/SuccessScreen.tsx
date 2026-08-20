import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, ArrowLeft, Download, Share2, Receipt, Sparkles } from 'lucide-react';
import { Transaction } from '../types';

interface SuccessScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  transaction,
  onGoHome,
}) => {
  useEffect(() => {
    // Trigger confetti animation
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // Ignore if confetti fails
    }
  }, []);

  return (
    <div className="space-y-4 text-center py-6 animate-fadeIn pb-8">
      {/* Success Badge */}
      <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl border border-emerald-200 shadow-md transform transition-transform hover:scale-105">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-1">
        <h2 className="text-lg font-black text-slate-900">Payment Successful!</h2>
        <p className="text-xs text-slate-500 px-4 font-medium">
          RonPay system kaltlangin online payment hlawhtling taka tihfel a ni ta.
        </p>
      </div>

      {/* Details Box */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl mx-1 text-left space-y-2 text-xs shadow-xs">
        <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
          <span className="text-slate-500 font-medium">Campaign:</span>
          <span className="font-bold text-slate-900 text-right truncate max-w-[180px]">
            {transaction?.campaignTitle || 'RonPay Donation'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Donor Name:</span>
          <span className="font-bold text-slate-900">
            {transaction?.isAnonymous ? 'Anonymous (Hming thup)' : transaction?.donorName}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Amount Paid:</span>
          <span className="font-black text-emerald-700 text-sm">
            ₹{transaction?.amount.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Platform Fee (1%):</span>
          <span className="font-bold text-indigo-700">
            ₹{transaction?.platformFee.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center border-t border-emerald-200 pt-2 font-black text-slate-900">
          <span>Total Settled:</span>
          <span className="text-sm">₹{transaction?.totalAmount.toFixed(2)}</span>
        </div>

        <div className="flex justify-between items-center pt-1 text-[10px] text-slate-400 font-mono">
          <span>TXN ID:</span>
          <span>{transaction?.id || 'RPAY20260817XXXX'}</span>
        </div>
      </div>

      <div className="pt-2 px-1 space-y-2">
        <button
          onClick={onGoHome}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3.5 rounded-xl transition text-xs shadow-md cursor-pointer active:scale-[0.99]"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};
