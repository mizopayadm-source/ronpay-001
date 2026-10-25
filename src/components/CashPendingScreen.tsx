import React, { useState, useMemo, useCallback } from 'react';
import { 
  Clock, 
  Check, 
  X, 
  ShieldCheck, 
  Receipt, 
  ArrowLeft, 
  AlertCircle, 
  Building2, 
  User, 
  Calendar, 
  FileText,
  Lock,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Transaction, CreatorProfile, Campaign } from '../types';
import { 
  getStoredTransactions, 
  saveTransaction, 
  recordUserPaidTxId, 
  recordAuditLog,
  getStoredCampaigns,
  isCampaignCreator,
  isActualCampaignOwner,
  isSuperAdminOrAdminProfile,
  safeApiFetch
} from '../utils/storage';
import { formatDateTimeDDMMYYYY } from '../utils/date';

export type ClearanceRole = 'creator' | 'treasurer' | 'accountant' | 'admin' | 'donor';

export interface ClearanceEvaluation {
  role: ClearanceRole;
  canClear: boolean;
  roleLabel: string;
}

interface CashPendingScreenProps {
  transaction: Transaction | null;
  onGoHome: () => void;
  creatorName?: string;
  creatorProfile?: CreatorProfile | null;
  campaigns?: Campaign[];
  onApprove?: (approvedTx: Transaction) => void;
  onReject?: (rejectedTx: Transaction) => void;
}

/**
 * Evaluates whether the currently authenticated user has clearance rights
 * to approve/reject cash entries for the target campaign.
 * Allowed roles: 'admin', 'treasurer', 'accountant', 'creator'.
 */
export function evaluateClearanceRole(
  profile?: CreatorProfile | null,
  campaign?: Campaign | null
): ClearanceEvaluation {
  if (!profile || !profile.phone || profile.role === 'GUEST') {
    return { role: 'donor', canClear: false, roleLabel: 'Donor / Public' };
  }

  // 1. Platform Admin / Super Admin
  if (profile.isAdmin || profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || isSuperAdminOrAdminProfile(profile)) {
    return { role: 'admin', canClear: true, roleLabel: 'Platform Administrator' };
  }

  const roleLower = (profile.role || '').toLowerCase();
  const designationLower = (profile.designation || '').toLowerCase();

  // 2. Treasurer on profile
  if (roleLower.includes('treasurer') || designationLower.includes('treasurer')) {
    return { role: 'treasurer', canClear: true, roleLabel: 'Treasurer' };
  }

  // 3. Accountant on profile
  if (roleLower.includes('accountant') || designationLower.includes('accountant')) {
    return { role: 'accountant', canClear: true, roleLabel: 'Accountant' };
  }

  // 4. Authorized Officers registered on this specific Campaign
  if (campaign && Array.isArray(campaign.authorizedOfficers) && profile.phone) {
    const userPhoneDigits = profile.phone.replace(/\D/g, '').slice(-10);
    const matchedOfficer = campaign.authorizedOfficers.find(o => {
      const oPhoneDigits = (o.phone || '').replace(/\D/g, '').slice(-10);
      return oPhoneDigits && userPhoneDigits && oPhoneDigits === userPhoneDigits;
    });

    if (matchedOfficer) {
      const officerRole = (matchedOfficer.role || '').toLowerCase();
      if (officerRole.includes('treasurer')) {
        return { role: 'treasurer', canClear: true, roleLabel: 'Campaign Treasurer' };
      }
      if (officerRole.includes('accountant')) {
        return { role: 'accountant', canClear: true, roleLabel: 'Campaign Accountant' };
      }
      if (officerRole.includes('creator') || officerRole.includes('admin') || officerRole.includes('leader')) {
        return { role: 'creator', canClear: true, roleLabel: 'Campaign Officer' };
      }
    }
  }

  // 5. Campaign Creator / Owner
  if (campaign && isCampaignCreator(campaign, profile)) {
    return { role: 'creator', canClear: true, roleLabel: 'Bawm Creator' };
  }
  if (roleLower === 'creator' && (!campaign || isActualCampaignOwner(campaign, profile))) {
    return { role: 'creator', canClear: true, roleLabel: 'Bawm Creator' };
  }

  return { role: 'donor', canClear: false, roleLabel: 'Donor' };
}

export const CashPendingScreen: React.FC<CashPendingScreenProps> = ({
  transaction,
  onGoHome,
  creatorProfile,
  campaigns,
  onApprove,
  onReject,
}) => {
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Authoritative resolution of effective transaction data
  const effectiveTx = useMemo<Transaction | null>(() => {
    if (transaction && (Number(transaction.amount) > 0 || Number(transaction.totalAmount) > 0 || transaction.donorName)) {
      return transaction;
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('RONPAY_LAST_CASH_TXN');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && (Number(parsed.amount) > 0 || parsed.donorName)) {
            return parsed as Transaction;
          }
        }
      } catch {}

      try {
        const storedTxs = getStoredTransactions();
        const latestCash = storedTxs
          .filter(t => t.paymentMethod === 'cash')
          .sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime())[0];
        if (latestCash) {
          return latestCash;
        }
      } catch {}
    }

    return transaction;
  }, [transaction]);

  // Resolve matching campaign
  const targetCampaign = useMemo<Campaign | null>(() => {
    if (!effectiveTx) return null;
    const allCampaigns = campaigns || getStoredCampaigns();
    return allCampaigns.find(c => c.id === effectiveTx.campaignId) || null;
  }, [effectiveTx, campaigns]);

  // Clean role-based clearance check against current campaign
  const clearance = useMemo<ClearanceEvaluation>(() => {
    return evaluateClearanceRole(creatorProfile, targetCampaign);
  }, [creatorProfile, targetCampaign]);

  const rawAmount = Number(effectiveTx?.amount ?? effectiveTx?.totalAmount ?? 0);
  const formattedAmount = rawAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const isAnonymous = Boolean(effectiveTx?.isAnonymous);
  const donorName = isAnonymous 
    ? 'Anonymous (Hming thup)' 
    : (effectiveTx?.donorName?.trim() ? effectiveTx.donorName : 'Valued Donor');

  const receiptToken = effectiveTx?.id || 'RPAY-CASH-PENDING';
  const campaignTitle = effectiveTx?.campaignTitle || targetCampaign?.title || 'RonPay Community Bawm';

  /**
   * Fresh, explicit handler for 'Approve Cash Receipt':
   * a) Update transaction status from 'PENDING' to 'SUCCESS'.
   * b) Commit the approved cash transaction to the Official Ledger and update Campaign Totals.
   * c) Save approved_by user metadata and timestamp cleanly.
   */
  const handleApproveCashReceipt = useCallback(async () => {
    if (!effectiveTx || isSubmitting || !clearance.canClear) return;
    setIsSubmitting(true);
    setActionFeedback(null);

    try {
      const nowIso = new Date().toISOString();
      const approverName = creatorProfile?.name || clearance.roleLabel;
      const approverPhone = creatorProfile?.phone || undefined;
      const approverRole = clearance.role;

      // a) Update transaction status from 'PENDING' to 'SUCCESS'
      // c) Save approved_by user metadata and timestamp cleanly
      const approvedTransaction: Transaction = {
        ...effectiveTx,
        status: 'SUCCESS', // Explicit SUCCESS status
        verifiedBy: approverName,
        verifiedAt: nowIso,
        collectorName: approverName,
        collectorPhone: approverPhone,
        remark: approvalNote.trim()
          ? `${effectiveTx.remark ? effectiveTx.remark + ' • ' : ''}[Approved by ${approverName} (${clearance.roleLabel}): ${approvalNote.trim()}]`
          : (effectiveTx.remark || `Approved by ${approverName} (${clearance.roleLabel})`),
        updatedAt: nowIso,
        isSynced: false,
      };

      // b) Commit approved transaction to Official Ledger & update Campaign Totals
      // 1. Commit to persistent primary storage
      saveTransaction(approvedTransaction);

      // 2. Track in user/creator Sulhnu history
      recordUserPaidTxId(approvedTransaction.id);

      // 3. Clear pending temporary entry
      try {
        localStorage.removeItem('RONPAY_LAST_CASH_TXN');
      } catch {}

      // 4. Official audit trail log
      recordAuditLog(
        'Cash Receipt Approved',
        `Cash transaction ₹${approvedTransaction.amount} (Token: ${approvedTransaction.id}) approved by ${approverName} [${approverRole.toUpperCase()}]. Committed to Official Ledger.`,
        'transaction',
        approvedTransaction.id,
        approverName
      );

      // 5. Notify local multi-window and cross-tab sync listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: getStoredTransactions() }));
        window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
        window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: getStoredCampaigns() }));
      }

      // 6. Direct server push for multi-device live sync
      safeApiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(approvedTransaction)
      }).catch(() => {});

      setActionFeedback({
        type: 'success',
        message: 'Cash payment approved successfully! Committed to Official Ledger.'
      });

      // 7. Invoke parent approval callback to update view
      if (onApprove) {
        onApprove(approvedTransaction);
      }
    } catch (err: any) {
      console.error('[CashPendingScreen] Approval failed:', err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to approve cash receipt: ' + (err?.message || 'Unknown error')
      });
      setIsSubmitting(false);
    }
  }, [effectiveTx, isSubmitting, clearance, creatorProfile, approvalNote, onApprove]);

  /**
   * Fresh, explicit handler for 'Reject Cash Receipt':
   */
  const handleRejectCashReceipt = useCallback(async () => {
    if (!effectiveTx || isSubmitting || !clearance.canClear) return;
    const reasonPrompt = window.prompt(
      'Khawngaihin hnawl chhan (Rejection Reason) ziak rawh:', 
      'Pawisa dawn fel a ni lo / Cash not received'
    );
    if (reasonPrompt === null) return; // cancelled by user

    setIsSubmitting(true);
    setActionFeedback(null);

    try {
      const nowIso = new Date().toISOString();
      const verifierName = creatorProfile?.name || clearance.roleLabel;

      const rejectedTransaction: Transaction = {
        ...effectiveTx,
        status: 'rejected',
        rejectionReason: reasonPrompt || 'Cash pawisa dawn fel a ni lo.',
        rejectedAt: nowIso,
        verifiedBy: verifierName,
        updatedAt: nowIso,
      };

      saveTransaction(rejectedTransaction);

      recordAuditLog(
        'Cash Receipt Rejected',
        `Cash receipt ${rejectedTransaction.id} (₹${rejectedTransaction.amount}) rejected by ${verifierName}. Reason: ${reasonPrompt}`,
        'transaction',
        rejectedTransaction.id,
        verifierName
      );

      try {
        localStorage.removeItem('RONPAY_LAST_CASH_TXN');
      } catch {}

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: getStoredTransactions() }));
      }

      if (onReject) {
        onReject(rejectedTransaction);
      }
    } catch (err: any) {
      console.error('[CashPendingScreen] Rejection failed:', err);
      setActionFeedback({
        type: 'error',
        message: 'Failed to reject cash receipt: ' + (err?.message || 'Unknown error')
      });
      setIsSubmitting(false);
    }
  }, [effectiveTx, isSubmitting, clearance, creatorProfile, onReject]);

  return (
    <div className="space-y-4 text-center pt-5 pb-6 animate-fadeIn max-w-md mx-auto px-2">
      {/* Top Status Icon */}
      <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-amber-300 shadow-sm animate-pulse">
        <Clock className="w-8 h-8" />
      </div>

      {/* Screen Title & Subtitle */}
      <div className="space-y-1.5 px-2">
        <h2 className="text-lg font-black text-slate-900 leading-tight">
          Cash Entry Submitted
        </h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          {clearance.canClear ? (
            <>
              Cash record a in-submit fel e. Treasurer, Accountant emaw Creator i nihna angin a hnuaiah hian i verify in i pawm (Approve) thei e.
            </>
          ) : (
            <>
              He Cash payment hi Treasurer / Accountant in an endik a, an pawm (Approve) hunah chauh Official Ledger leh Campaign Totals-ah a lut ang.
            </>
          )}
        </p>
      </div>

      {/* Action Feedback Banner if any */}
      {actionFeedback && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 text-left ${
          actionFeedback.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
            : 'bg-rose-50 text-rose-800 border border-rose-300'
        }`}>
          {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Official Receipt Card */}
      <div className="bg-amber-50/90 border border-amber-200/90 p-4 rounded-2xl text-left space-y-3 text-xs shadow-xs">
        {/* Status Row with prominent PENDING TREASURER APPROVAL badge */}
        <div className="flex justify-between items-center border-b border-amber-200 pb-2.5">
          <span className="text-slate-500 font-semibold text-[11px]">Clearance Status</span>
          <span className="font-extrabold text-amber-900 bg-amber-200/90 px-2.5 py-1 rounded-md text-[10px] tracking-wide border border-amber-300 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-800" /> PENDING TREASURER APPROVAL
          </span>
        </div>

        {/* Campaign Name */}
        <div className="flex justify-between items-start gap-2">
          <span className="text-slate-500 font-medium flex items-center gap-1 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Bawm:
          </span>
          <span className="font-bold text-slate-800 text-right truncate max-w-[210px]">
            {campaignTitle}
          </span>
        </div>

        {/* Donor Name */}
        <div className="flex justify-between items-center">
          <span className="text-slate-500 font-medium flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" /> Petu Hming:
          </span>
          <span className="font-bold text-slate-900">
            {donorName}
          </span>
        </div>

        {/* Section / Bial if available */}
        {effectiveTx?.donorVeng && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Bial / Section:</span>
            <span className="font-semibold text-slate-700">
              {effectiveTx.donorVeng}
            </span>
          </div>
        )}

        {/* SubCategory if available */}
        {effectiveTx?.subCategory && (
          <div className="flex justify-between items-center">
            <span className="text-slate-500 font-medium">Thawhlawm Head:</span>
            <span className="font-semibold text-slate-700">
              {effectiveTx.subCategory}
            </span>
          </div>
        )}

        {/* Cash Amount Highlight */}
        <div className="flex justify-between items-center bg-white/90 p-3 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-slate-700 font-bold">Cash Amount:</span>
          <span className="font-black text-emerald-700 text-lg">
            ₹{formattedAmount}
          </span>
        </div>

        {/* Gateway Fee */}
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500 font-medium">Platform Fee:</span>
          <span className="font-bold text-emerald-700">₹0.00 (Cash Free)</span>
        </div>

        {/* Submission Timestamp */}
        {effectiveTx?.timestamp && (
          <div className="flex justify-between items-center text-[11px] text-slate-500">
            <span className="font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Pek Hun:
            </span>
            <span className="font-semibold text-slate-700">
              {formatDateTimeDDMMYYYY(effectiveTx.timestamp)}
            </span>
          </div>
        )}

        {/* Receipt Token */}
        <div className="flex justify-between items-center border-t border-amber-200 pt-2 text-[10px] text-slate-500 font-mono">
          <span>Receipt Token:</span>
          <span className="font-semibold text-slate-700">{receiptToken}</span>
        </div>
      </div>

      {/* 
        ROLE-BASED CONDITIONAL RENDERING:
        ONLY render clearance action buttons if role is 'creator', 'treasurer', 'accountant', or 'admin'.
        For all other users / donors, render the clean read-only view above without any clearance buttons.
      */}
      {clearance.canClear ? (
        <div className="bg-emerald-50/90 border border-emerald-300 p-4 rounded-2xl text-left space-y-3 shadow-xs animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="text-xs font-black text-emerald-950">
                Treasurer / Admin Clearance
              </span>
            </div>
            <span className="bg-emerald-200/90 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {clearance.roleLabel}
            </span>
          </div>

          <p className="text-[11px] text-emerald-900 leading-snug">
            {creatorProfile?.name ? (
              <>Cleared by: <strong className="font-bold text-emerald-950">{creatorProfile.name}</strong> ({clearance.roleLabel})</>
            ) : (
              <>Treasurer / Accountant emaw Creator i nihna angin a hnuaiah hian he cash receipt hi i pawm (Approve) thei e.</>
            )}
          </p>

          {/* Optional clearance voucher / receipt note */}
          <div>
            <label className="block text-[10px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
              Approval Remark / Voucher Ref (Optional)
            </label>
            <input
              type="text"
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              placeholder="e.g. Cash received at office / Voucher #12"
              className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Approval & Rejection Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleApproveCashReceipt}
              disabled={isSubmitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black py-2.5 px-3 rounded-xl transition text-xs shadow-xs cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Committing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" /> Approve Cash Receipt
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleRejectCashReceipt}
              disabled={isSubmitting}
              className="px-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 font-bold py-2.5 rounded-xl border border-rose-200 transition text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        </div>
      ) : (
        /* Read-only advisory card for donors & public users */
        <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-left space-y-1.5 shadow-2xs">
          <div className="flex items-center gap-2 text-slate-700">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-800">Donor Information Notice</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            I cash pekna lehkha hi record a ni tawh a. Treasurer / Accountant clearance a zawh fel veleh official reports leh bawm account-ah a lang ang.
          </p>
        </div>
      )}

      {/* Navigation button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGoHome}
          className="w-full bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-black py-3.5 rounded-xl transition text-xs shadow-md cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
      </div>
    </div>
  );
};
