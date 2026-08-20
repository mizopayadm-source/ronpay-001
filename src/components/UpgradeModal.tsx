import React, { useState } from 'react';
import { X, ShieldCheck, ArrowUpRight, Lock, CheckCircle2, FileText, Sparkles, AlertTriangle, Clock, MessageSquare, PhoneCall } from 'lucide-react';
import { BawmCategory, CreatorProfile, SystemPricingConfig } from '../types';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { getCreatorExpiryStatus } from '../utils/date';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile;
  pricingConfig?: SystemPricingConfig;
  onUpgradeApproved: (newCategory: BawmCategory) => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  pricingConfig = DEFAULT_PRICING_CONFIG,
  onUpgradeApproved,
}) => {
  const [selectedCat, setSelectedCat] = useState<BawmCategory | null>(null);
  const [authProofDoc, setAuthProofDoc] = useState<string>('');

  if (!isOpen) return null;

  const expiryInfo = getCreatorExpiryStatus(creatorProfile, pricingConfig?.globalTrialDays ?? 30);

  const allCategories: { key: BawmCategory; name: string }[] = [
    { key: 'ralna', name: 'Ralna Bawm' },
    { key: 'khawlsak', name: 'Khawlsak Bawm' },
    { key: 'rikrum', name: 'Rikrum Bawm' },
    { key: 'kumtluang', name: 'Kumtluang Bawm' },
  ];

  const currentCatRule = selectedCat ? (pricingConfig?.categories[selectedCat] || DEFAULT_PRICING_CONFIG.categories[selectedCat]) : null;

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAuthProofDoc(e.target.files[0].name);
    }
  };

  const handleUpgradeSubmit = () => {
    if (!selectedCat) {
      alert('Khawngaihin Bawm category thlang rawh!');
      return;
    }

    if (creatorProfile.approvedCategories.includes(selectedCat)) {
      alert('He category hi i nei sa tawh e.');
      return;
    }

    onUpgradeApproved(selectedCat);
    alert(`🎉 Successfully upgraded! Added ${BAWM_CONFIG[selectedCat].name} to your Creator privileges.`);
    onClose();
  };

  const adminPhone = "+919862300000";
  const whatsappUrl = `https://wa.me/919862300000?text=${encodeURIComponent(
    `Chibai RonPay Admin,\nKa Creator Plan/Trial (${creatorProfile.name} - ${creatorProfile.phone}) hi renew emaw category upgrade ka duh e.`
  )}`;

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3 shadow-2xl border border-indigo-200 text-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
              Creator Plan & Bawm Upgrade
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Plan & Expiry Status Banner */}
        <div className={`p-2.5 rounded-2xl border text-xs space-y-1 ${
          expiryInfo.isExpired 
            ? 'bg-rose-50 border-rose-200 text-rose-900' 
            : expiryInfo.isExpiringSoon 
            ? 'bg-amber-50 border-amber-200 text-amber-900' 
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          <div className="flex items-center justify-between font-bold text-[11px]">
            <span className="flex items-center gap-1">
              {expiryInfo.isExpired ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{expiryInfo.planTypeLabel}</span>
            </span>
            <span className={`text-[9.5px] px-2 py-0.5 rounded-full font-black ${
              expiryInfo.isExpired 
                ? 'bg-rose-200 text-rose-900' 
                : expiryInfo.isExpiringSoon 
                ? 'bg-amber-200 text-amber-900' 
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              {expiryInfo.isPermanentFree 
                ? 'Lifetime Free' 
                : expiryInfo.isExpired 
                ? 'Expired' 
                : `${expiryInfo.daysRemaining}d Left`}
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            Valid until: <b className="text-slate-700">{expiryInfo.formattedExpiryDate}</b>
            {expiryInfo.isExpiringSoon && ' — Renew soon to avoid interruption.'}
          </p>
        </div>

        <p className="text-[10.5px] text-slate-500 font-medium">
          Bawm belh/upgrade duh ber thlang rawh:
        </p>

        <div className="space-y-2">
          {allCategories.map(cat => {
            const isApproved = creatorProfile.approvedCategories.includes(cat.key);
            const isChecked = selectedCat === cat.key;
            const rule = pricingConfig?.categories[cat.key] || DEFAULT_PRICING_CONFIG.categories[cat.key];

            return (
              <label
                key={cat.key}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition ${
                  isApproved
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                    : isChecked
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-black'
                    : 'bg-slate-50 border-slate-200 text-slate-800 cursor-pointer hover:bg-slate-100 font-bold'
                }`}
              >
                <input
                  type="radio"
                  name="upgrade_cat"
                  value={cat.key}
                  disabled={isApproved}
                  checked={isChecked}
                  onChange={() => setSelectedCat(cat.key)}
                  className="accent-indigo-600"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] flex justify-between items-center">
                    <span>{cat.name}</span>
                    {rule.isFreeTrialActive ? (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded">
                        Free Trial
                      </span>
                    ) : (
                      <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                        {rule.platformFeePercent}% Fee
                      </span>
                    )}
                  </div>
                </div>
                {isApproved && <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />}
              </label>
            );
          })}
        </div>

        {/* Dynamic Category Plan Summary when selected */}
        {selectedCat && currentCatRule && (
          <div className="p-3 rounded-2xl bg-slate-900 text-white space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-amber-300 font-extrabold text-[10.5px]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Plan & Rate Details:
              </span>
              <span>{currentCatRule.trialPeriodDays} Days Trial</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[10.5px] pt-1">
              <div className="bg-slate-800 p-2 rounded-xl">
                <span className="text-slate-400 text-[9px] block">QR Siam Man:</span>
                <span className="font-black text-white">
                  {currentCatRule.isFreeTrialActive || creatorProfile.isFreeServiceGranted ? (
                    <span className="text-emerald-400">₹0 (Free Service)</span>
                  ) : currentCatRule.qrCreationCharge === 0 ? (
                    'Free'
                  ) : (
                    `₹${currentCatRule.qrCreationCharge}`
                  )}
                </span>
              </div>
              <div className="bg-slate-800 p-2 rounded-xl">
                <span className="text-slate-400 text-[9px] block">Platform Fee:</span>
                <span className="font-black text-white">
                  {currentCatRule.isFreeTrialActive || creatorProfile.isFreeServiceGranted
                    ? '0% (Trial)'
                    : `${currentCatRule.platformFeePercent}%`}
                </span>
              </div>
            </div>

            {currentCatRule.subscriptionRates && (
              <div className="pt-1 text-[9.5px] text-slate-300 flex justify-between">
                <span>Monthly: ₹{currentCatRule.subscriptionRates.monthly}/mo</span>
                <span>Yearly: ₹{currentCatRule.subscriptionRates.yearly}/yr</span>
              </div>
            )}
          </div>
        )}

        {/* Auth Document Upload */}
        <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 space-y-1.5 text-xs">
          <label className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider block">
            Pawl / NGO Hriatpuina Doc Upload *
          </label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleDocChange}
            className="block w-full text-[9.5px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:font-bold file:bg-indigo-600 file:text-white cursor-pointer"
          />
          {authProofDoc && (
            <p className="text-[9.5px] text-emerald-700 font-bold">
              ✓ Attached: {authProofDoc}
            </p>
          )}
          <p className="text-[9.5px] text-slate-500 italic">
            Bawm thar hawng tur hian Pawl/NGO recommendation letter upload tel a tha e.
          </p>
        </div>

        <div className="pt-1 space-y-2">
          <button
            onClick={handleUpgradeSubmit}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
          >
            Upgrade & Submit Doc
          </button>

          {/* Quick Contact Admin Button */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Direct WhatsApp Admin For Renewal</span>
          </a>
        </div>
      </div>
    </div>
  );
};
