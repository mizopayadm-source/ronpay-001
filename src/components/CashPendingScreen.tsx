import React, { useState, useMemo } from 'react';
import { Clock, Check, ArrowLeft, AlertCircle, Banknote, ShieldCheck, CheckCircle2, XCircle, UserCheck, Lock, Fingerprint } from 'lucide-react';
import { Transaction, Campaign, CreatorProfile } from '../types';
import { approveCashTransaction, rejectCashTransaction, canApproveCashPayment, getTransactionCampaign } from '../utils/storage';
import { BiometricAuthModal } from './BiometricAuthModal';

interface CashPendingScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
  onApprove?: (updatedTx: Transaction) => void;
  onReject?: (rejectedTx: Transaction) => void;
  creatorName?: string;
  creatorProfile?: CreatorProfile | null;
  campaigns?: Campaign[];
}

export const CashPendingScreen: React.FC<CashPendingScreenProps> = ({
  transaction,
  onGoHome,
  onApprove,
  onReject,
  creatorName = 'Bawm Creator',
  creatorProfile,
  campaigns = [],
}) => {
  const [currentTx, setCurrentTx] = useState<Transaction | null>(transaction);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('Cash pawisa dawn a ni lo');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Biometric Guard
  const [isBiometricOpen, setIsBiometricOpen] = useState<boolean>(false);
  const [pendingBiometricAction, setPendingBiometricAction] = useState<'approve' | 'reject' | null>(null);

  const targetCampaign = useMemo(() => {
    if (!currentTx) return undefined;
    return getTransactionCampaign(currentTx, campaigns);
  }, [currentTx, campaigns]);

  const authCheck = useMemo(() => {
    if (!currentTx) return { allowed: false, reason: 'Transaction hmuh a ni lo' };
    return canApproveCashPayment(currentTx, campaigns, creatorProfile);
  }, [currentTx, campaigns, creatorProfile]);

  const targetCreatorDisplayName = targetCampaign?.creatorName || targetCampaign?.createdBy || (targetCampaign?.orgName ? `${targetCampaign.orgName} Creator` : 'Bawm Siamtu');

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
  const isOnline = currentTx.paymentMethod === 'online' || !!currentTx.utrRef;

  const handleStartApprove = () => {
    if (!authCheck.allowed) {
      setActionMessage(`⚠️ ${authCheck.reason || 'He payment hi approve phalna i nei lo.'}`);
      return;
    }
    setPendingBiometricAction('approve');
    setIsBiometricOpen(true);
  };

  const handleStartReject = () => {
    if (!authCheck.allowed) {
      setActionMessage(`⚠️ ${authCheck.reason || 'He payment hi hnawl phalna i nei lo.'}`);
      return;
    }
    setPendingBiometricAction('reject');
    setIsBiometricOpen(true);
  };

  const handleBiometricSuccess = () => {
    setIsBiometricOpen(false);
    const verifier = creatorProfile?.name || creatorName;

    if (pendingBiometricAction === 'approve') {
      const updated = approveCashTransaction(currentTx.id, verifier, creatorProfile, campaigns);
      if (updated) {
        setCurrentTx(updated);
        setActionMessage(`${isOnline ? 'UPI' : 'Cash'} pekna hi hlawhtling takin pawm (Approved) a ni ta e!`);
        if (onApprove) {
          setTimeout(() => {
            onApprove(updated);
          }, 1000);
        }
      }
    } else if (pendingBiometricAction === 'reject') {
      const updated = rejectCashTransaction(currentTx.id, verifier, rejectionReason, creatorProfile, campaigns);
      if (updated) {
        setCurrentTx(updated);
        setIsRejecting(false);
        setActionMessage(`${isOnline ? 'UPI' : 'Cash'} pekna hi hnawl (Rejected) a ni.`);
        if (onReject) {
          onReject(updated);
        }
      }
    }
    setPendingBiometricAction(null);
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
          {isApproved 
            ? `${isOnline ? 'UPI Online Payment' : 'Cash'} Verified & Approved!` 
            : isRejected 
            ? `${isOnline ? 'UPI Payment' : 'Cash'} Rejected` 
            : `${isOnline ? 'UPI Payment Verification Awaiting' : 'Cash Entry Submitted!'}`}
        </h2>
        <p className="text-xs text-slate-500 px-4 font-medium leading-relaxed">
          {isApproved
            ? `He pekna hi ${currentTx.verifiedBy || 'Creator'}-in a dawng fel tih nemngheh a ni tawh e.`
            : isRejected
            ? `He pekna hi hnawl a ni. Chhan: ${currentTx.rejectionReason || 'Pawisa a lut lo'}`
            : isOnline
            ? `I UPI payment (UTR: ${currentTx.utrRef || currentTx.id}) hi Bawm Siamtu / Admin hian an bank statement-ah a lut ngei em tih an lo enfiah (verify) mek a ni. An pawm hnuah chauh official receipt a chhuak ang.`
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
              <CheckCircle2 className="w-3 h-3 text-emerald-700" /> {isOnline ? 'UPI APPROVED' : 'CASH APPROVED'}
            </span>
          ) : isRejected ? (
            <span className="font-extrabold text-rose-900 bg-rose-200/90 px-2 py-0.5 rounded text-[10px] border border-rose-300 flex items-center gap-1">
              <XCircle className="w-3 h-3 text-rose-700" /> {isOnline ? 'UPI REJECTED' : 'CASH REJECTED'}
            </span>
          ) : (
            <span className="font-extrabold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded text-[10px] border border-amber-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-700" /> PENDING VERIFICATION
            </span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium">Payment Mode:</span>
          <span className="font-bold text-slate-800">
            {isOnline ? 'Direct UPI (Online Transfer)' : 'Cash Slip'}
          </span>
        </div>

        {currentTx.utrRef && (
          <div className="flex justify-between items-center bg-white/80 p-2 rounded-lg border border-amber-200">
            <span className="text-slate-600 font-bold text-[11px]">Bank UTR / Ref:</span>
            <span className="font-mono font-black text-indigo-900 text-xs tracking-wide">{currentTx.utrRef}</span>
          </div>
        )}

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
          <span className="text-slate-500 font-medium">{isOnline ? 'UPI Amount:' : 'Cash Amount:'}</span>
          <span className="font-black text-slate-900 text-base">
            ₹{(Number(currentTx.amount) || 0).toLocaleString('en-IN')}
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

      {/* CREATOR / ADMIN APPROVAL CONTROLS OR VISITOR STATUS */}
      {isPending && (
        authCheck.allowed ? (
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/40 p-4 rounded-2xl mx-1 text-left space-y-3 shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-300 tracking-wide uppercase">
                  {creatorProfile?.isAdmin ? 'Admin / Super Admin Verification' : `${targetCreatorDisplayName} (Bawm Siamtu Verification)`}
                </h4>
                <p className="text-[11px] text-slate-300 leading-tight">
                  {isOnline 
                    ? `He UPI pekna (UTR: ${currentTx.utrRef || currentTx.id}) hi i enkawl bawm a mi a ni a. I bank account-ah a luh tawh chuan pawm (Approve) rawh le.`
                    : 'He cash pekna hi i enkawl bawm a mi a ni a. Pawisa i dawn fel tawh chuan pawm (Approve) rawh le.'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleStartApprove}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl transition text-xs shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Fingerprint className="w-4 h-4 text-slate-950" />
                {isOnline ? 'Bank Account-ah A Lut Fel (Biometric Approve)' : 'Pawisa Ka Dawng Fel (Biometric Approve)'}
              </button>

              {!isRejecting ? (
                <button
                  type="button"
                  onClick={() => setIsRejecting(true)}
                  className="w-full bg-slate-800/80 hover:bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold py-2 rounded-xl transition text-[11px] cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  {isOnline ? 'Bank-ah A Lut Lo / Hnawl (Reject)' : 'Pawisa Dawn A Ni Lo / Hnawl (Reject)'}
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
                    placeholder={isOnline ? "Chhan (e.g. Bank statement-ah a lang lo / UTR lem)" : "Chhan ziak rawh (e.g. Cash a lo thleng lo)"}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleStartReject}
                      className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-2 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      Hnawlna Nemnghet Rawh (Biometric)
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
        ) : (
          <div className="bg-slate-900 border-2 border-indigo-500/30 p-4 rounded-2xl mx-1 text-left space-y-2.5 shadow-md animate-fadeIn">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-amber-300">
                  Creator & Admin Verification Only
                </h4>
                <p className="text-[10.5px] text-slate-400 leading-tight">
                  {isOnline 
                    ? 'UPI payment hi Bawm Siamtu (Creator) leh Admin chauhin an bank statement an check hnuah an approve thei.'
                    : 'Cash payment receipt hi he bawm siamtu (Creator) leh Admin chauhin an approve thei.'}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              I thehluh {isOnline ? 'UPI payment' : 'cash'} ₹<b>{(Number(currentTx.amount) || 0).toLocaleString('en-IN')}</b>{isOnline && currentTx.utrRef ? ` (UTR: ${currentTx.utrRef})` : ''} hi Bawm Siamtu (<b>{targetCreatorDisplayName}</b>) emaw Admin-in an lo enfiah a, pawisa a luh ngei tih an verify veleh official receipt i dawng nghal dawn a ni.
            </p>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>Receipt Verification Token:</span>
              <span className="font-mono font-bold text-amber-300">{currentTx.id}</span>
            </div>
          </div>
        )
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

      {/* Biometric Verification Guard */}
      <BiometricAuthModal
        isOpen={isBiometricOpen}
        target="admin_action"
        actionType={pendingBiometricAction || 'approve'}
        title={pendingBiometricAction === 'reject' ? `${isOnline ? 'UPI' : 'Cash'} Rejection Authorization` : `${isOnline ? 'UPI' : 'Cash'} Approval Clearance`}
        subtitle={`${isOnline ? 'UPI Online payment' : 'Cash payment'} ₹${Number(currentTx.amount || 0).toLocaleString('en-IN')} (${currentTx.id}${currentTx.utrRef ? `, UTR: ${currentTx.utrRef}` : ''}) hi ${pendingBiometricAction === 'reject' ? 'hnawl (reject)' : 'pawm (approve)'} tur hian Biometric verify rawh le.`}
        userName={creatorProfile?.name || creatorName}
        userPhone={creatorProfile?.phone}
        expectedPin={creatorProfile?.pin || creatorProfile?.password}
        onClose={() => {
          setIsBiometricOpen(false);
          setPendingBiometricAction(null);
        }}
        onSuccess={handleBiometricSuccess}
      />
    </div>
  );
};

