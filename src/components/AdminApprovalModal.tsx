import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  CreditCard,
  Sparkles,
  Ban,
  UserCheck,
  Fingerprint,
  XCircle
} from 'lucide-react';
import { Campaign, CreatorProfile } from '../types';
import { getUserRole, canAccessCreatorVerification, ROLE_METAS } from '../utils/rbac';
import { BiometricAuthModal } from './BiometricAuthModal';

interface AdminApprovalModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  currentProfile?: CreatorProfile;
  onClose: () => void;
  onApprove: (campaign: Campaign) => void;
  onReject?: (campaign: Campaign) => void;
}

export const AdminApprovalModal: React.FC<AdminApprovalModalProps> = ({
  isOpen,
  campaign,
  currentProfile,
  onClose,
  onApprove,
  onReject,
}) => {
  const [isBiometricOpen, setIsBiometricOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  if (!isOpen || !campaign) return null;

  const userRole = getUserRole(currentProfile);
  const isAuthorized = canAccessCreatorVerification(currentProfile);
  const roleMeta = ROLE_METAS[userRole];

  const handleStartApprove = () => {
    setPendingAction('approve');
    setIsBiometricOpen(true);
  };

  const handleStartReject = () => {
    setPendingAction('reject');
    setIsBiometricOpen(true);
  };

  const handleBiometricSuccess = () => {
    setIsBiometricOpen(false);
    if (pendingAction === 'approve') {
      onApprove({
        ...campaign,
        isApproved: true,
        status: 'active',
        approvedBy: currentProfile?.name || 'Authorized Staff',
        approvedAt: new Date().toISOString()
      });
    } else if (pendingAction === 'reject' && onReject) {
      onReject(campaign);
    }
    setPendingAction(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
        <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 relative space-y-4 my-auto shrink-0 max-h-[90vh] overflow-y-auto">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Warning Badge & Reviewer Clearance */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                  Staff Review Queue
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${roleMeta.badgeColor}`}>
                  {roleMeta.badge}
                </span>
              </div>
              <h3 className="text-sm font-black text-slate-900 mt-0.5">
                Campaign Verification & Approval
              </h3>
            </div>
          </div>

          {/* Security Guard Notice */}
          <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/70 border border-indigo-200/80 rounded-xl text-[11px] text-indigo-900">
            <Fingerprint className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Biometric Security Guard enabled for all critical approval actions.</span>
          </div>

          {/* Campaign Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <span className="font-extrabold text-slate-900 text-xs">{campaign.title}</span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                {campaign.category}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              {campaign.location || 'Mizoram'}
            </p>

            <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200 font-mono">
              UPI: <span className="font-bold text-indigo-700">{campaign.upiId}</span>
            </p>

            <p className="text-[11px] text-slate-600">
              He Bawm Campaign hi Creator in a thehlut a ni a, <b>Super Admin, Admin, emaw Compliance Moderator</b> in a pawm (Approve) hma chuan mipui tan hman theih a la ni lo.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            {isAuthorized ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleStartApprove}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{roleMeta.shortTitle}: Pawm & Active Rawh (Biometric)</span>
                </button>

                {onReject && (
                  <button
                    type="button"
                    onClick={handleStartReject}
                    className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Hnawl Rawh (Reject Campaign)</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-bold text-center">
                Clearance insufficient to approve. Moderator or Admin role required.
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
            >
              Kalsan rih rawh (Cancel)
            </button>
          </div>
        </div>
      </div>

      {/* Biometric Verification Guard */}
      <BiometricAuthModal
        isOpen={isBiometricOpen}
        target="admin_action"
        actionType={pendingAction || 'approve'}
        title={pendingAction === 'reject' ? 'Admin Action: Campaign Rejection' : 'Admin Action: Campaign Approval'}
        subtitle={`Campaign "${campaign.title}" hi ${pendingAction === 'reject' ? 'hnawl (reject)' : 'pawm (approve)'} fel tur hian Biometric Authentication a ngai e.`}
        userName={currentProfile?.name}
        userPhone={currentProfile?.phone}
        expectedPin={currentProfile?.pin || currentProfile?.password}
        onClose={() => {
          setIsBiometricOpen(false);
          setPendingAction(null);
        }}
        onSuccess={handleBiometricSuccess}
      />
    </>
  );
};
