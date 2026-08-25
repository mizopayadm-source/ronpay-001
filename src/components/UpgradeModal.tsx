import React, { useState } from 'react';
import { 
  X, 
  ArrowUpRight, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  MessageSquare, 
  PlusCircle, 
  MinusCircle, 
  FileText, 
  Check, 
  Ban, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { BawmCategory, CategoryRequest, CreatorProfile, SystemPricingConfig } from '../types';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { getCreatorExpiryStatus } from '../utils/date';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile;
  pricingConfig?: SystemPricingConfig;
  onUpgradeApproved?: (newCategory: BawmCategory) => void;
  onRequestUpgrade?: (type: 'add' | 'remove', category: BawmCategory, docName?: string, reason?: string) => void;
  onCancelUpgradeRequest?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  pricingConfig = DEFAULT_PRICING_CONFIG,
  onUpgradeApproved,
  onRequestUpgrade,
  onCancelUpgradeRequest,
}) => {
  // Request Mode: 'add' vs 'remove'
  const [requestType, setRequestType] = useState<'add' | 'remove'>('add');
  const [selectedCat, setSelectedCat] = useState<BawmCategory | null>(null);
  const [authProofDoc, setAuthProofDoc] = useState<string>('');
  const [requestReason, setRequestReason] = useState<string>('');

  if (!isOpen) return null;

  const expiryInfo = getCreatorExpiryStatus(creatorProfile, pricingConfig?.globalTrialDays ?? 30);

  const allCategories: { key: BawmCategory; name: string }[] = [
    { key: 'ralna', name: 'Ralna Bawm' },
    { key: 'khawlsak', name: 'Khawlsak Bawm' },
    { key: 'rikrum', name: 'Rikrum Bawm' },
    { key: 'kumtluang', name: 'Kumtluang Bawm' },
  ];

  const approvedCats = creatorProfile.approvedCategories || ['ralna'];
  const notApprovedCats = allCategories.filter(c => !approvedCats.includes(c.key));
  const availableToRemoveCats = allCategories.filter(c => approvedCats.includes(c.key));

  const currentCatRule = selectedCat ? (pricingConfig?.categories[selectedCat] || DEFAULT_PRICING_CONFIG.categories[selectedCat]) : null;

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAuthProofDoc(e.target.files[0].name);
    }
  };

  const handleSubmitRequest = () => {
    if (!selectedCat) {
      alert(`Khawngaihin Category i ${requestType === 'add' ? 'dah belh' : 'paih'} duh thlang rawh.`);
      return;
    }

    if (requestType === 'add') {
      if (approvedCats.includes(selectedCat)) {
        alert('He category hi i nei sa tawh a ni.');
        return;
      }
    } else {
      if (!approvedCats.includes(selectedCat)) {
        alert('He category hi i nei lo hrim hrim a ni.');
        return;
      }
      if (approvedCats.length <= 1) {
        if (!confirm('Category 1 chauh i nei tawh a, hei hi i paih chuan Bawm post siam theihna i nei rih lo ang. I dil chhunzawm duh em?')) {
          return;
        }
      }
    }

    if (onRequestUpgrade) {
      onRequestUpgrade(requestType, selectedCat, authProofDoc || undefined, requestReason.trim() || undefined);
    } else if (onUpgradeApproved && requestType === 'add') {
      onUpgradeApproved(selectedCat);
    }

    const actionText = requestType === 'add' ? 'Category Dah Belh (Add)' : 'Category Paih (Remove)';
    alert(`📋 ${actionText} Dilna Admin-ah Thlen Fel A Ni!\n\nCategory: ${BAWM_CONFIG[selectedCat].name}\nAdmin-in an check fel veleh i account-ah a in-update nghal ang.`);
    onClose();
  };

  const whatsappUrl = `https://wa.me/919862300000?text=${encodeURIComponent(
    `Chibai RonPay Admin,\nKa Creator Account (${creatorProfile.name} - ${creatorProfile.phone}) ah Category ${requestType === 'add' ? 'dah belh' : 'paih'} dilna ka nei a, khawngaihin min lo check sak ta che.`
  )}`;

  const pendingReq = creatorProfile.pendingUpgrade as CategoryRequest | undefined;
  const pendingType = pendingReq?.type || 'add';

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl border border-slate-200 text-slate-900 my-auto shrink-0 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
              Creator Categories & Upgrade Menu
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1 rounded-lg hover:bg-slate-100"
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
          </p>
        </div>

        {/* Current Active Categories Display */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
            I Category Neih Mek Te (Active Categories):
          </span>
          <div className="flex flex-wrap gap-1.5">
            {approvedCats.map(catKey => (
              <span 
                key={catKey}
                className="inline-flex items-center gap-1 text-[10px] bg-white border border-indigo-200 text-indigo-900 font-black px-2 py-1 rounded-lg shadow-2xs"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{BAWM_CONFIG[catKey]?.name || catKey}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Pending Request Alert Banner if present */}
        {pendingReq && (
          <div className={`p-3 rounded-2xl border-2 text-xs space-y-2 animate-fadeIn ${
            pendingType === 'remove' 
              ? 'bg-rose-50 border-rose-300 text-rose-950' 
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}>
            <div className="flex items-center justify-between font-black">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 animate-pulse text-amber-600" />
                <span>
                  {pendingType === 'remove' ? 'Category Paih Dilna A Lut Mek!' : 'Category Dah Belh Dilna A Lut Mek!'}
                </span>
              </span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                pendingType === 'remove' ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
              }`}>
                Pending Admin
              </span>
            </div>
            
            <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Bawm:</span>
                <strong className="text-slate-900">{BAWM_CONFIG[pendingReq.category]?.name || pendingReq.category}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Action:</span>
                <span className={`font-black ${pendingType === 'remove' ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {pendingType === 'remove' ? '➖ Paih (Remove)' : '➕ Dah Belh (Add)'}
                </span>
              </div>
              {pendingReq.reason && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reason:</span>
                  <span className="text-slate-700 font-medium italic">{pendingReq.reason}</span>
                </div>
              )}
              {pendingReq.authDocName && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Doc:</span>
                  <span className="text-slate-700 font-medium truncate max-w-[140px]">{pendingReq.authDocName}</span>
                </div>
              )}
            </div>

            {onCancelUpgradeRequest && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Category dilna hi cancel/thulh i duh takzet em?')) {
                      onCancelUpgradeRequest();
                    }
                  }}
                  className="w-full py-1.5 px-3 bg-white hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  <span>Dilna Thulh / Cancel Request</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab Selection: 1. Dah Belh (Add) vs 2. Paih (Remove) */}
        <div className="p-1 bg-slate-100 rounded-2xl flex items-center gap-1 border border-slate-200">
          <button
            type="button"
            onClick={() => {
              setRequestType('add');
              setSelectedCat(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
              requestType === 'add'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className={`w-3.5 h-3.5 ${requestType === 'add' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>Category Dah Belh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRequestType('remove');
              setSelectedCat(null);
            }}
            className={`flex-1 py-2 px-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
              requestType === 'remove'
                ? 'bg-white text-rose-950 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MinusCircle className={`w-3.5 h-3.5 ${requestType === 'remove' ? 'text-rose-600' : 'text-slate-400'}`} />
            <span>Category Paih</span>
          </button>
        </div>

        {/* 1. ADD CATEGORY FLOW */}
        {requestType === 'add' && (
          <div className="space-y-3 animate-fadeIn">
            <p className="text-[10.5px] text-slate-600 font-bold">
              Bawm dah belh duh ber thlang rawh:
            </p>

            {notApprovedCats.length === 0 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs text-center space-y-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto" />
                <p className="font-black">Category zawng zawng i nei kim vek e!</p>
                <p className="text-[10.5px] text-emerald-700">Ralna, Khawlsak, Rikrum, leh Kumtluang bawm zawng zawng i hawng vek tawh.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notApprovedCats.map(cat => {
                  const isChecked = selectedCat === cat.key;
                  const rule = pricingConfig?.categories[cat.key] || DEFAULT_PRICING_CONFIG.categories[cat.key];

                  return (
                    <label
                      key={cat.key}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                        isChecked
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-black shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 font-bold'
                      }`}
                    >
                      <input
                        type="radio"
                        name="upgrade_cat"
                        value={cat.key}
                        checked={isChecked}
                        onChange={() => setSelectedCat(cat.key)}
                        className="accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] flex justify-between items-center">
                          <span>{cat.name}</span>
                          {rule?.isFreeTrialActive ? (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded">
                              Free Trial
                            </span>
                          ) : (
                            <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                              {rule?.platformFeePercent}% Fee
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

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
              </div>
            )}

            {/* Document Upload for Add */}
            <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 space-y-1.5 text-xs">
              <label className="text-[10px] font-extrabold text-indigo-950 uppercase tracking-wider block">
                Pawl / NGO Hriatpuina Doc Upload (Optional)
              </label>
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleDocChange}
                className="block w-full text-[9.5px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:font-bold file:bg-indigo-600 file:text-white cursor-pointer"
              />
              {authProofDoc && (
                <p className="text-[9.5px] text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Attached: {authProofDoc}
                </p>
              )}
            </div>

            {/* Reason input for Add */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Category Dilna Chhan / Hawn Duhna (Reason/Purpose)
              </label>
              <input
                type="text"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="e.g. Branch Treasurer aiawhin khawlsak bawm kan hawng duh e"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>
          </div>
        )}

        {/* 2. REMOVE CATEGORY FLOW */}
        {requestType === 'remove' && (
          <div className="space-y-3 animate-fadeIn">
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 font-black">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Category Paih / Hlih Dilna</span>
              </div>
              <p className="text-[10px] text-rose-800 leading-relaxed">
                Category i paih chuan he category-ah hian Post / QR thar i siam thei tawh rih lo ang.
              </p>
            </div>

            <p className="text-[10.5px] text-slate-600 font-bold">
              I category neih mek atangin paih duh ber thlang rawh:
            </p>

            <div className="space-y-2">
              {availableToRemoveCats.map(cat => {
                const isChecked = selectedCat === cat.key;

                return (
                  <label
                    key={cat.key}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition cursor-pointer ${
                      isChecked
                        ? 'bg-rose-50 border-rose-400 text-rose-950 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <input
                      type="radio"
                      name="remove_cat"
                      value={cat.key}
                      checked={isChecked}
                      onChange={() => setSelectedCat(cat.key)}
                      className="accent-rose-600"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] flex justify-between items-center">
                        <span>{cat.name}</span>
                        <span className="text-[9px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                          Active Now
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Reason input for Remove */}
            <div>
              <label className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1">
                Category Paih Duhna Chhan (Reason) *
              </label>
              <input
                type="text"
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
                placeholder="e.g. Mawhphurhna ka chhunzawm tawh lo / Term a zo ta e"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:bg-white focus:border-rose-600"
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={handleSubmitRequest}
            disabled={!selectedCat}
            className={`w-full py-2.5 rounded-xl text-xs font-black shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 ${
              !selectedCat
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : requestType === 'add'
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {requestType === 'add' ? (
              <>
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Submit Category Add Request</span>
              </>
            ) : (
              <>
                <MinusCircle className="w-3.5 h-3.5" />
                <span>Submit Category Removal Request</span>
              </>
            )}
          </button>

          {/* Quick Contact Admin Button */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Direct WhatsApp Admin For Assistance</span>
          </a>
        </div>
      </div>
    </div>
  );
};
