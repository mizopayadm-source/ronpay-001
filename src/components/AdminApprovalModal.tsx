import React from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  CreditCard,
  Sparkles,
  Ban
} from 'lucide-react';
import { Campaign } from '../types';

interface AdminApprovalModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onApprove: (campaign: Campaign) => void;
  onReject?: (campaign: Campaign) => void;
}

export const AdminApprovalModal: React.FC<AdminApprovalModalProps> = ({
  isOpen,
  campaign,
  onClose,
  onApprove,
  onReject,
}) => {
  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn text-slate-800">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-amber-300 relative space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Warning Badge */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
              Admin Approval Required
            </span>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">
              QR Code La Active Lo (Pending)
            </h3>
          </div>
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
            {campaign.location}
          </p>

          <p className="text-[11px] text-slate-600 bg-white p-2 rounded-xl border border-slate-200 font-mono">
            UPI: <span className="font-bold text-indigo-700">{campaign.upiId}</span>
          </p>

          <p className="text-[11px] text-slate-600">
            He QR Code hi QR Creator in a siam a ni a, Admin in a <b>pawm (Approve)</b> hma chuan mi vantlang tan sum chhunluhna atan hman theih a la ni lo.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={() => onApprove(campaign)}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Admin: Pawm & Active Rawh (Approve QR)</span>
          </button>

          <button
            onClick={onClose}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
          >
            Kalsan rih rawh (Cancel)
          </button>
        </div>
      </div>
    </div>
  );
};
