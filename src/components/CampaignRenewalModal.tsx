import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  Calendar, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  RotateCw,
  Sparkles,
  Info
} from 'lucide-react';
import { Campaign, CampaignRenewalRequest, CreatorProfile } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';

interface CampaignRenewalModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  creatorProfile?: CreatorProfile | null;
  onSubmitRenewal: (campaign: Campaign, renewalData: CampaignRenewalRequest) => void;
}

export const CampaignRenewalModal: React.FC<CampaignRenewalModalProps> = ({
  isOpen,
  onClose,
  campaign,
  creatorProfile,
  onSubmitRenewal,
}) => {
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [customDate, setCustomDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().substring(0, 16);
  });
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('Sum thawh khawm hun pawhsei a ngai e.');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successSubmitted, setSuccessSubmitted] = useState<boolean>(false);

  if (!isOpen || !campaign) return null;

  const handleSelectDays = (days: number) => {
    setSelectedDays(days);
    setIsCustomDate(false);
    const d = new Date();
    d.setDate(d.getDate() + days);
    setCustomDate(d.toISOString().substring(0, 16));
  };

  const calculateTargetDate = (): string => {
    if (isCustomDate && customDate) {
      return new Date(customDate).toISOString();
    }
    const d = new Date();
    d.setDate(d.getDate() + selectedDays);
    return d.toISOString();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const targetDateIso = calculateTargetDate();
    const renewalData: CampaignRenewalRequest = {
      requestedAt: new Date().toISOString(),
      requestedBy: creatorProfile?.name || campaign.creatorName || 'Campaign Creator',
      requestedPhone: creatorProfile?.phone || campaign.createdBy || '',
      requestedDays: isCustomDate ? undefined : selectedDays,
      requestedValidityDate: targetDateIso,
      reason: reason.trim() || 'Sum thawh khawm chhunzawm a ngai.',
      status: 'pending'
    };

    setTimeout(() => {
      onSubmitRenewal(campaign, renewalData);
      setIsSubmitting(false);
      setSuccessSubmitted(true);
      setTimeout(() => {
        setSuccessSubmitted(false);
        onClose();
      }, 1500);
    }, 400);
  };

  const reasonPresets = [
    'Sum thawh khawm hun pawhsei a ngai e.',
    'Chhiatni / Ralna khawn la chhunzawm zel a ni.',
    'Kohhran / Pawl hmalakna target la tlin loh avangin.',
    'Donor thahnem zawkin an la chhunluh duh avangin.'
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 relative space-y-4 my-auto shrink-0 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1 rounded-full hover:bg-slate-100"
          title="Kharna"
        >
          <X className="w-5 h-5" />
        </button>

        {successSubmitted ? (
          <div className="py-8 text-center space-y-3 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
              <CheckCircle2 className="w-10 h-10 animate-scaleUp" />
            </div>
            <h3 className="text-base font-black text-slate-900">
              Renewal Dilna Thawn Fel A Ni E!
            </h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
              Admin-in he dilna hi an lo enfiah a nga, an pawm (approve) veleh QR Code hi a nung leh nghal ang.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header Banner */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <RotateCw className="w-5 h-5 animate-spin-slow" />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60 inline-block">
                  QR Code Renew / Extend Dilna
                </span>
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate mt-0.5">
                  Validity Pawhsei Dil Rawh
                </h3>
              </div>
            </div>

            {/* Campaign Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-slate-900 truncate">{campaign.title}</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                  {campaign.status === 'expired' ? 'Expired' : 'Inactive'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                <span>{campaign.orgName || 'RonPay Community'}</span>
                <span>•</span>
                <span>Hun tawp: <strong className="text-slate-700">{campaign.validityDate ? formatDateDDMMYYYY(campaign.validityDate) : 'Not set'}</strong></span>
              </div>
            </div>

            {/* Duration Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-800">
                Thar thawh / Pawhsei duh zat thlang rawh *
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { days: 7, label: '+7 Ni' },
                  { days: 15, label: '+15 Ni' },
                  { days: 30, label: '+1 Thla' },
                  { days: 90, label: '+3 Thla' }
                ].map(opt => (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => handleSelectDays(opt.days)}
                    className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer border text-center ${
                      !isCustomDate && selectedDays === opt.days
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Option Toggle */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsCustomDate(!isCustomDate)}
                  className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{isCustomDate ? 'Standard Ni zatah let rawh' : 'Phek remchang zawk / Custom Tarik thlang duh tan'}</span>
                </button>
                {isCustomDate && (
                  <div className="mt-2 space-y-1 animate-fadeIn">
                    <input
                      type="datetime-local"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:bg-white focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                )}
              </div>

              {/* Target validity preview */}
              <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center gap-2 text-xs text-indigo-900 font-bold">
                <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  Dil hnuah validity chu: <strong>{formatDateTimeDDMMYYYY(calculateTargetDate())}</strong> thleng a ni ang.
                </span>
              </div>
            </div>

            {/* Reason / Dil Chhan */}
            <div className="space-y-1.5">
              <label className="block text-xs font-black text-slate-800">
                Pawhsei / Renew dil chhan (Reason) *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Entirnan: Chhiatni thawhlawm hun pawhsei a ngai e..."
                className="w-full p-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />

              {/* Preset quick reasons */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] scrollbar-none">
                {reasonPresets.map((pr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReason(pr)}
                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium whitespace-nowrap shrink-0 cursor-pointer border border-slate-200/60"
                  >
                    {pr}
                  </button>
                ))}
              </div>
            </div>

            {/* Notice */}
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Creator-in dilna a thawn hian Admin Approval Dashboard-ah a lang nghal a nga, Admin-in an approve veleh QR hi active a ni ang.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Sut Leh (Cancel)
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Thawn Mek...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Dilna Thawn Rawh (Submit)</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
