import React, { useState } from 'react';
import { Clock, Check, ArrowLeft, AlertCircle, Banknote, ShieldCheck, CheckCircle2, XCircle, UserCheck } from 'lucide-react';
import { Transaction } from '../types';
import { approveCashTransaction, rejectCashTransaction } from '../utils/storage';

interface CashPendingScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
  onApprove?: (updatedTx: Transaction) => void;
  onReject?: (rejectedTx: Transaction) => void;
  creatorName?: string;
}

export const CashPendingScreen: React.FC<CashPendingScreenProps> = ({
  transaction,
  onGoHome,
  onApprove,
  onReject,
  creatorName = 'Bawm Creator',
}) => {
  const [currentTx, setCurrentTx] = useState<Transaction | null>(transaction);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('Cash pawisa dawn a ni lo');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  if (!currentTx) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-sm font-bold text-slate-500">Transaction hmuh a ni lo</p>
        <button onClick={onGoHome} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs">
          Back to Home
        </button>
      </div>
    );
  }

  const isPending = currentTx.status === 'pending_verification';
  const isApproved = currentTx.status === 'completed';
  const isRejected = currentTx.status === 'rejected';

  const handleApprove = () => {
    const updated = approveCashTransaction(currentTx.id, creatorName);
    if (updated) {
      setCurrentTx(updated);
      setActionMessage('Cash pekna hi hlawhtling takin pawm (Approved) a ni ta e!');
      if (onApprove) {
        setTimeout(() => {
          onApprove(updated);
        }, 1000);
      }
    }
  };

  const handleConfirmReject = () => {
    const updated = rejectCashTransaction(currentTx.id, creatorName, rejectionReason);
    if (updated) {
      setCurrentTx(updated);
      setIsRejecting(false);
      setActionMessage('Cash pekna hi hnawl (Rejected) a ni.');
      if (onReject) {
        onReject(updated);
      }
    }
  };

  return (
    <div className="space-y-4 text-center pt-4 pb-2 animate-fadeIn max-w-md mx-auto">
      {/* Icon Status */}
      {isApproved ? (
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl border-2 border-emerald-300 shadow-md animate-bounce">
          <CheckCircle2 className="w-9 h-9" />
        </div>
      ) : isRejected ? (
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl border-2 border-rose-300 shadow-md">
          <XCircle className="w-9 h-9" />
        </div>
      ) : (
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl border-2 border-amber-300 shadow-md animate-pulse">
          <Clock className="w-9 h-9" />
        </div>
      )}

      <div className="space-y-1">
        <h2 className="text-lg font-black text-slate-900">
          {isApproved ? 'Cash Verified & Approved!' : isRejected ? 'Cash Rejected' : 'Cash Entry Submitted!'}
        </h2>
        <p className="text-xs text-slate-500 px-4 font-medium leading-relaxed">
          {isApproved
            ? `He cash pekna hi ${currentTx.verifiedBy || 'Creator'}-in a dawng fel tih nemngheh a ni tawh e.`
            : isRejected
            ? `He cash pekna hi hnawl a ni. Chhan: ${currentTx.rejectionReason || 'Dawng lo'}`
            : 'I cash pek luh hi Bawm Siamtu / Admin hian verification a la kalpui dawn a ni.'}
        </p>
      </div>

      {actionMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-2.5 rounded-xl text-xs font-bold animate-fadeIn">
          {actionMessage}
        </div>
      )}

      {/* Transaction Details Box */}
      <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl mx-1 text-left space-y-2.5 text-xs shadow-xs">
        <div className="flex justify-between items-center border-b border-amber-200 pb-2">
          <span className="text-slate-500 font-medium">Status:</span>
          {isApproved ? (
            <span className="font-extrabold text-emerald-900 bg-emerald-200/90 px-2 py-0.5 rounded text-[10px] border border-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> CASH APPROVED
            </span>
          ) : isRejected ? (
            <span className="font-extrabold text-rose-900 bg-rose-200/90 px-2 py-0.5 rounded text-[10px] border border-rose-300 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-700" /> CASH REJECTED
            </span>
          ) : (
            <span className="font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] border border-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-700" /> PENDING VERIFICATION
            </span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Bawm / Campaign:</span>
          <span className="font-bold text-slate-900 text-right max-w-[200px] truncate">
            {currentTx.campaignTitle || currentTx.campaignId}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Petu Hming:</span>
          <span className="font-bold text-slate-900">
            {currentTx.isAnonymous ? 'Anonymous (Hming thup)' : currentTx.donorName}
          </span>
        </div>

        {currentTx.donorPhone && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Phone:</span>
            <span className="font-semibold text-slate-800">{currentTx.donorPhone}</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Cash Amount:</span>
          <span className="font-black text-slate-900 text-base">
            ₹{currentTx.amount.toLocaleString('en-IN')}
          </span>
        </div>

        {currentTx.verifiedBy && (
          <div className="flex justify-between items-center border-t border-amber-200 pt-2 text-[11px] text-emerald-800">
            <span className="font-semibold">Approved By:</span>
            <span className="font-black">{currentTx.verifiedBy}</span>
          </div>
        )}

        <div className="flex justify-between items-center border-t border-amber-200 pt-2 text-[10px] text-slate-500 font-mono">
          <span>Receipt Token:</span>
          <span className="font-bold">{currentTx.id}</span>
        </div>
      </div>

      {/* CREATOR / ADMIN APPROVAL CONTROLS */}
      {isPending && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/40 p-4 rounded-2xl mx-1 text-left space-y-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-300 tracking-wide uppercase">
                Bawm Siamtu / Admin Approval
              </h4>
              <p className="text-[11px] text-slate-300 leading-tight">
                Cash pawisa hi dawn a nih tawh chuan hetah hian pawm (Approve) rawh le.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleApprove}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition text-xs shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              Pawisa Ka Dawng Fel (Approve Cash)
            </button>

            {!isRejecting ? (
              <button
                type="button"
                onClick={() => setIsRejecting(true)}
                className="w-full bg-slate-800/80 hover:bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold py-2 rounded-xl transition text-[11px] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
                Pawisa Dawn A Ni Lo / Hnawl (Reject)
              </button>
            ) : (
              <div className="bg-rose-950/80 border border-rose-500/50 p-3 rounded-xl space-y-2 animate-fadeIn text-xs">
                <label className="text-[11px] text-rose-200 font-bold block">
                  Hnawlna Chhan (Rejection Reason):
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full bg-slate-900 border border-rose-400/60 rounded-lg p-2 text-white text-xs"
                  placeholder="Chhan ziak rawh (e.g. Cash a lo thleng lo)"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmReject}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2 rounded-lg text-xs cursor-pointer"
                  >
                    Hnawlna Nemnghet Rawh
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRejecting(false)}
                    className="px-3 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded-lg text-xs cursor-pointer"
                  >
                    Sut Leh
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="pt-2 px-1 flex flex-col sm:flex-row gap-2">
        <button
          onClick={onGoHome}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 rounded-xl transition text-xs shadow-md cursor-pointer active:scale-[0.99]"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

