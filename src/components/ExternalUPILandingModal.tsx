import React from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  ShieldCheck, 
  MapPin, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Campaign } from '../types';
import { createUPIPaymentString } from '../utils/qr';
import { formatDateDDMMYYYY, isCampaignExpired } from '../utils/date';

interface ExternalUPILandingModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onProceedRonPay: (campaign: Campaign) => void;
}

export const ExternalUPILandingModal: React.FC<ExternalUPILandingModalProps> = ({
  isOpen,
  campaign,
  onClose,
  onProceedRonPay,
}) => {
  if (!isOpen || !campaign) return null;

  const isExpired = isCampaignExpired(campaign.validityDate, campaign.status);
  const isRalna = campaign.category === 'ralna';
  const isRikrum = campaign.category === 'rikrum';
  const isKhawlsak = campaign.category === 'khawlsak';

  const upiPayUrl = createUPIPaymentString(
    campaign.upiId || 'ronpay@axl',
    campaign.title,
    undefined,
    `RonPay ${campaign.category.toUpperCase()} - ${campaign.title}`
  );

  const handleOpenUPI = () => {
    if (isExpired) {
      alert('⚠️ He campaign/QR hi a expire tawh avangin payment tih theih a ni rih lo.');
      return;
    }
    window.location.href = upiPayUrl;
  };

  const handleDownloadRonPay = () => {
    alert('📥 RonPay Mobile App Download Link:\n\nhttps://ronpay.in/download/app\n\nGoogle Play Store & App Store link.');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-3.5 backdrop-blur-xs animate-fadeIn text-slate-800">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-indigo-200 relative space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header Badge */}
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
            isRalna ? 'bg-slate-900 text-white border-slate-700' :
            isRikrum ? 'bg-rose-100 text-rose-800 border-rose-300' :
            isKhawlsak ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
            'bg-blue-100 text-blue-800 border-blue-300'
          }`}>
            {campaign.category.toUpperCase()} BAWM UPI SCAN
          </span>
          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified
          </span>
        </div>

        {/* Short Details Section */}
        <div className="space-y-2 border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900 leading-snug">
            {campaign.title}
          </h3>

          <p className="text-xs text-slate-500 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            {campaign.location}
          </p>

          {isRalna && campaign.mitthiHming && (
            <div className="text-xs font-bold text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              Mitthi: <span className="text-slate-950 font-black">{campaign.mitthiHming}</span>
              {campaign.age ? ` (${campaign.age} yrs)` : ''}
              {campaign.vuiHun && (
                <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                  Vui hun: {formatDateDDMMYYYY(campaign.vuiHun)}
                </p>
              )}
            </div>
          )}

          {isRikrum && (campaign.emergencyTitle || campaign.cause) && (
            <div className="text-xs font-bold text-rose-900 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
              🚨 {campaign.emergencyTitle || campaign.cause}
            </div>
          )}

          {isKhawlsak && campaign.cause && (
            <p className="text-xs text-slate-700 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 font-medium leading-relaxed">
              {campaign.cause}
            </p>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>UPI ID: <b className="text-slate-800 font-mono">{campaign.upiId}</b></span>
            <span>Validity: <b className="text-indigo-700">{formatDateDDMMYYYY(campaign.validityDate)}</b></span>
          </div>
        </div>

        {/* Expired Warning if applicable */}
        {isExpired ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center space-y-1">
            <AlertCircle className="w-5 h-5 text-rose-600 mx-auto" />
            <p className="text-xs font-black text-rose-900">Pek Hun a Tawp Tawh (Expired)</p>
            <p className="text-[10.5px] text-rose-700">
              He campaign/QR hi a tawp tawh avangin sum pek theih a ni tawh rih lo.
            </p>
          </div>
        ) : (
          /* Payment Actions */
          <div className="space-y-2 pt-1">
            <button
              onClick={handleOpenUPI}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-black py-3 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer active:scale-98"
            >
              <Smartphone className="w-4 h-4 text-amber-300" />
              <span>Direct UPI Apps (GPay / PhonePe / Paytm)</span>
            </button>

            <button
              onClick={() => onProceedRonPay(campaign)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer active:scale-98"
            >
              <span>Pay with RonPay (Online / Cash + Instant Receipt)</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        )}

        {/* Optional Download link for detailed features */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Detail hmuh duh tan:</span>
          <button
            onClick={handleDownloadRonPay}
            className="text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 cursor-pointer underline"
          >
            <Download className="w-3 h-3" /> RonPay App Download
          </button>
        </div>
      </div>
    </div>
  );
};
