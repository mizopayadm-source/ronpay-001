import React from 'react';
import { Clock, Check, ArrowLeft, CheckCircle2, ShieldCheck, Banknote, Receipt, History } from 'lucide-react';
import { Campaign, CreatorProfile, Transaction } from '../types';
import { isCampaignCreator } from '../utils/storage';

interface CashPendingScreenProps {
  transaction: Transaction | null;
  campaigns?: Campaign[];
  creatorProfile?: CreatorProfile;
  onGoHome: () => void;
  onApproveCash?: (transaction: Transaction) => void;
  onOpenSulhnu?: () => void;
}

export const CashPendingScreen: React.FC<CashPendingScreenProps> = ({
  transaction,
  campaigns = [],
  creatorProfile,
  onGoHome,
  onApproveCash,
  onOpenSulhnu,
}) => {
  const isApproved = transaction?.status === 'completed';

  // Check if active profile is creator or admin of this campaign
  const campaign = transaction?.campaignId
    ? campaigns.find(c => c.id === transaction.campaignId)
    : undefined;

  const isOwner = Boolean(
    creatorProfile &&
    (creatorProfile.isAdmin || (campaign && isCampaignCreator(campaign, creatorProfile)))
  );

  return (
    <div className="space-y-4 text-center pt-5 pb-2 animate-fadeIn max-w-md mx-auto">
      {/* Status Icon */}
      {isApproved ? (
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-emerald-200 shadow-md">
          <Check className="w-9 h-9 stroke-[3]" />
        </div>
      ) : (
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-200 shadow-md animate-bounce">
          <Clock className="w-9 h-9" />
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-lg font-black text-slate-900">
          {isApproved ? 'Cash Entry Verified & Approved!' : 'Cash Entry Submitted!'}
        </h2>
        <p className="text-xs text-slate-500 px-4 font-medium leading-relaxed">
          {isApproved 
            ? 'He cash pek luh hi pawisa dawngtu / Creator-in a lo hmuhpui (verified) fel tawh e.'
            : 'I cash pek luh hi Creator/Admin hian verification a lo kalpui ang a, a lo hmuhpui (verify) veleh Verified a ni ang.'}
        </p>
      </div>

      {/* Transaction Details Box */}
      <div className={`${isApproved ? 'bg-emerald-50/90 border-emerald-200' : 'bg-amber-50/90 border-amber-200'} border p-4 rounded-2xl mx-1 text-left space-y-2 text-xs shadow-xs`}>
        <div className={`flex justify-between items-center border-b ${isApproved ? 'border-emerald-200' : 'border-amber-200'} pb-2`}>
          <span className="text-slate-500 font-medium">Status:</span>
          {isApproved ? (
            <span className="font-extrabold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded text-[10px] border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
              VERIFIED / APPROVED
            </span>
          ) : (
            <span className="font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] border border-amber-300">
              PENDING CASH VERIFICATION
            </span>
          )}
        </div>

        {campaign && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Bawm / Campaign:</span>
            <span className="font-bold text-slate-900 truncate max-w-[200px]">
              {campaign.title}
            </span>
          </div>
        )}

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

        {transaction?.verifiedBy && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Verified By:</span>
            <span className="font-bold text-emerald-800">
              {transaction.verifiedBy}
            </span>
          </div>
        )}

        <div className={`flex justify-between items-center border-t ${isApproved ? 'border-emerald-200' : 'border-amber-200'} pt-2 text-[10px] text-slate-400 font-mono`}>
          <span>Receipt Token:</span>
          <span>{transaction?.id || 'RPAYCASH2026'}</span>
        </div>
      </div>

      {/* Creator / Admin Quick Approval Box if not yet approved */}
      {!isApproved && isOwner && onApproveCash && transaction && (
        <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl mx-1 text-left space-y-2.5 shadow-xs">
          <div className="flex items-center gap-2 text-emerald-950 font-black text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>Creator / Admin Action (Dawngtu Tan)</span>
          </div>
          <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
            Nangmah hi he Bawm neitu / Admin i nih avangin, he Cash Entry hi i hmuhpui (Approve) nghal thei e:
          </p>
          <button
            type="button"
            onClick={() => onApproveCash(transaction)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 px-3 rounded-xl transition text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Hmuhpui & Approve Rawh (₹{transaction.amount.toFixed(2)})</span>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-2 px-1 space-y-2">
        {onOpenSulhnu && (
          <button
            type="button"
            onClick={onOpenSulhnu}
            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-800 font-extrabold py-3 rounded-xl border border-indigo-200 transition text-xs shadow-2xs cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
          >
            <History className="w-4 h-4 text-indigo-600" />
            <span>Pekna Sulhnu / History En Rawh</span>
          </button>
        )}

        <button
          type="button"
          onClick={onGoHome}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl transition text-xs shadow-md cursor-pointer active:scale-[0.99]"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};
