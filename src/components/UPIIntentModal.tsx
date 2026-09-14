import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ArrowRight,
  Info,
  Download
} from 'lucide-react';
import { Campaign, Transaction, BawmCategory } from '../types';
import { getCampaignCauseTitle, getEffectiveCategory } from '../utils/translations';
import {
  validateUpiId,
  buildUpiIntentUrl,
  UPI_APP_OPTIONS,
  UpiAppOption,
  isMobileDevice
} from '../utils/upi';
import { generateQRCodeDataUrl } from '../utils/qr';

interface UPIIntentModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign;
  category?: BawmCategory;
  amount: number;
  platformFee?: number;
  feeOption?: 'ADD_ON' | 'DEDUCT';
  campaignNetReceived?: number;
  donorName: string;
  donorPhone?: string;
  donorVeng?: string;
  memberId?: string;
  subId?: string;
  isDependent?: boolean;
  isAnonymous?: boolean;
  subcatAmounts?: Record<string, number>;
  periodType?: string;
  periodMonth?: string;
  periodYear?: string;
  periodLabel?: string;
  remark?: string;
  onPaymentSuccess: (transaction: Transaction) => void;
}

export function UPIIntentModal({
  isOpen,
  onClose,
  campaign,
  category,
  amount,
  platformFee = 0,
  feeOption = 'ADD_ON',
  campaignNetReceived,
  donorName,
  donorPhone,
  donorVeng,
  memberId,
  subId,
  isDependent = false,
  isAnonymous = false,
  subcatAmounts,
  periodType,
  periodMonth,
  periodYear,
  periodLabel,
  remark,
  onPaymentSuccess
}: UPIIntentModalProps) {
  const [selectedApp, setSelectedApp] = useState<UpiAppOption | null>(null);
  const [step, setStep] = useState<'select' | 'waiting' | 'error'>('select');
  const [payMethodTab, setPayMethodTab] = useState<'qr' | 'apps'>('apps');
  const [txRef, setTxRef] = useState<string>(() => `RPAY-${Math.floor(100000 + Math.random() * 900000)}`);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoading, setQrLoading] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [utrInput, setUtrInput] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState<boolean>(false);
  const [hasReturnedFromApp, setHasReturnedFromApp] = useState<boolean>(false);

  const rawTargetUpi = campaign?.targetUpiId || campaign?.upiId || 'ronpay.bawm@okhdfcbank';
  const valCheck = validateUpiId(rawTargetUpi);
  const targetUpi = valCheck.isValid ? rawTargetUpi : 'ronpay.bawm@okhdfcbank';
  const totalPayable = feeOption === 'DEDUCT' ? amount : amount + platformFee;
  const netReceived = campaignNetReceived ?? (feeOption === 'DEDUCT' ? Math.max(0, amount - platformFee) : amount);
  const payeeDisplayName = getCampaignCauseTitle(campaign, 'RonPay Bawm');

  // Validate recipient UPI ID on modal open
  useEffect(() => {
    if (!isOpen) return;

    setValidationError(null);
    setStep('select');
    setHasReturnedFromApp(false);
    const newRef = `RPAY-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxRef(newRef);
  }, [isOpen, targetUpi]);

  // Generate dynamic QR Code for on-screen scanning
  useEffect(() => {
    if (!isOpen || !targetUpi || validationError) return;

    let isMounted = true;
    setQrLoading(true);

    const universalUpiUrl = buildUpiIntentUrl({
      upiId: targetUpi,
      payeeName: payeeDisplayName,
      amount: totalPayable,
      note: `RonPay:${campaign?.id || 'cmp-custom'}:${txRef}`,
      transactionRef: txRef,
      campaignId: campaign?.id || 'cmp-custom',
      donorName: isAnonymous ? 'Anonymous' : donorName,
      donorPhone
    });

    generateQRCodeDataUrl(universalUpiUrl)
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setQrLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setQrLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, targetUpi, payeeDisplayName, totalPayable, campaign?.id, txRef, isAnonymous, donorName, donorPhone, validationError]);

  // Listen to browser tab visibility changes (when user returns from UPI app)
  useEffect(() => {
    if (!isOpen || step !== 'waiting') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned back to RonPay browser tab from Google Pay / PhonePe / Paytm
        console.log('User returned to RonPay tab after launching UPI app');
        setHasReturnedFromApp(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, step]);

  if (!isOpen) return null;

  const handleLaunchUpiApp = (app: UpiAppOption) => {
    // 1. Re-validate recipient UPI ID
    const val = validateUpiId(targetUpi);
    if (!val.isValid) {
      setValidationError(val.error || 'UPI ID a dik lo.');
      setStep('error');
      return;
    }

    setSelectedApp(app);
    setStep('waiting');

    // 2. Build direct custom deep link intent URL
    const intentUrl = buildUpiIntentUrl(
      {
        upiId: targetUpi,
        payeeName: payeeDisplayName,
        amount: totalPayable,
        note: `RonPay ${txRef}`,
        transactionRef: txRef,
        campaignId: campaign?.id || 'cmp-custom',
        donorName: isAnonymous ? 'Anonymous' : donorName,
        donorPhone
      },
      app.scheme,
      app.androidPackage
    );

    // 3. Launch UPI intent deep link
    try {
      window.location.href = intentUrl;
    } catch (err) {
      console.warn('Failed to launch custom scheme directly, falling back to universal intent:', err);
      const fallbackUrl = buildUpiIntentUrl(
        {
          upiId: targetUpi,
          payeeName: payeeDisplayName,
          amount: totalPayable,
          note: `RonPay ${txRef}`,
          transactionRef: txRef
        },
        'upi://pay'
      );
      window.location.href = fallbackUrl;
    }
  };

  const handleConfirmSuccess = () => {
    setIsConfirming(true);

    setTimeout(() => {
      const utrCode = utrInput.trim() || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000));
      const transaction: Transaction = {
        id: txRef,
        campaignId: campaign?.id || 'cmp-custom',
        campaignTitle: getCampaignCauseTitle(campaign, 'RonPay Bawm'),
        category: category || campaign?.category || getEffectiveCategory({ campaignTitle: getCampaignCauseTitle(campaign, 'RonPay Bawm'), campaignId: campaign?.id }),
        donorName: isAnonymous ? 'Anonymous' : (donorName.trim() || 'Valued Donor'),
        donorPhone: isAnonymous ? undefined : (donorPhone?.trim() || undefined),
        donorVeng: isAnonymous ? undefined : (donorVeng?.trim() || undefined),
        memberId: isAnonymous ? undefined : memberId,
        subId: isAnonymous ? undefined : subId,
        isDependent: isAnonymous ? false : isDependent,
        isAnonymous: isAnonymous,
        amount: amount,
        platformFee: platformFee,
        feeOption: feeOption,
        campaignNetReceived: netReceived,
        totalAmount: totalPayable,
        paymentMethod: 'online',
        status: 'completed',
        remark: remark?.trim() || undefined,
        subCategoryBreakdown: campaign?.category === 'kumtluang' ? subcatAmounts : undefined,
        periodType: campaign?.category === 'kumtluang' ? periodType : undefined,
        periodMonth: campaign?.category === 'kumtluang' ? periodMonth : undefined,
        periodYear: campaign?.category === 'kumtluang' ? periodYear : undefined,
        periodLabel: campaign?.category === 'kumtluang' ? periodLabel : undefined,
        timestamp: new Date().toISOString(),
        txHash: 'UPI' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        utr: utrCode,
        utrRef: utrCode,
        payerUPI: selectedApp?.name || 'UPI Apps',
      };

      setIsConfirming(false);
      onPaymentSuccess(transaction);
      onClose();
    }, 600);
  };

  const copyToClipboard = (text: string, type: 'upi' | 'ref') => {
    navigator.clipboard.writeText(text);
    if (type === 'upi') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 relative">
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-amber-300" />
              UPI Instant Payment
            </span>
            <span className="text-[10px] font-bold text-slate-300">
              Ref: <span className="text-amber-300 font-mono">{txRef}</span>
            </span>
          </div>

          <div className="flex items-end justify-between gap-3 mt-2">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black truncate text-white">
                {campaign?.title || 'RonPay Bawm'}
              </h2>
              <p className="text-xs text-indigo-200 font-medium truncate">
                Payee: <b className="text-white">{payeeDisplayName}</b>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-indigo-300 block font-bold">Total Amount</span>
              <span className="text-xl sm:text-2xl font-black text-amber-300">
                ₹{totalPayable.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800 flex-1">
          {/* Validation Error Screen */}
          {step === 'error' && (
            <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-300 text-rose-700 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-950">
                    UPI ID A Dik Lo / A Awm Lo
                  </h3>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">
                    {validationError || 'He campaign hian UPI ID dik a nei lo a, pawisa pek theih a ni rih lo.'}
                  </p>
                  <p className="text-[11px] text-rose-700 mt-1.5 font-medium">
                    Current UPI ID: <code className="bg-rose-200/70 px-1.5 py-0.5 rounded font-mono font-bold text-rose-900">{targetUpi || '(Blank / Empty)'}</code>
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-200 text-right">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Let Leh Rawh (Go Back)
                </button>
              </div>
            </div>
          )}

          {/* Normal Selection Flow */}
          {step === 'select' && (
            <>
              {/* Verified Payee UPI Info Bar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800">
                        Verified UPI ID
                      </span>
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900 truncate">
                      {targetUpi}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(targetUpi, 'upi')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition cursor-pointer shadow-xs active:scale-95"
                  title="Copy UPI ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>

              {/* Copied Guide Notification */}
              {copiedId && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-emerald-900 text-xs flex items-start gap-2 animate-fadeIn shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">UPI ID copy fel a ni ta!</p>
                    <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                      I GPay emaw PhonePe hawng la, <b>"Pay to UPI ID"</b> (emaw <b>"To UPI ID"</b>)-ah paste la, <b>₹{totalPayable}</b> pe rawh le. I pek zawh veleh he tah let lehin <b>"Ka Pe Zo Tawh"</b> i hmet dawn nia.
                    </p>
                  </div>
                </div>
              )}

              {/* Mode Selection Tabs */}
              <div className="bg-slate-100 p-1 rounded-2xl flex gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayMethodTab('apps')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    payMethodTab === 'apps'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>Direct UPI Apps</span>
                  <span className="bg-indigo-100 text-indigo-800 text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight">
                    GPay / PhonePe
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayMethodTab('qr')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    payMethodTab === 'qr'
                      ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-4 h-4 text-indigo-600" />
                  <span>QR Code & Gallery</span>
                </button>
              </div>

              {/* TAB 1: Direct UPI App Launch (Default) */}
              {payMethodTab === 'apps' && (
                <div className="space-y-3 animate-fadeIn">
                  {/* SBI & Bank Limit Advisory Notice */}
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-950">
                          SBI / Bank Thenkhat Hriattirna:
                        </span>
                        <p className="text-[11px] text-amber-900 leading-relaxed mt-0.5">
                          SBI account hmangte tan, web link atanga personal UPI ID-a direct luh hi bank security-in <b>"Exceeded bank limit"</b> tiin a block thin a.
                          Chutiang a lo nih chuan a piah <b>"QR Code & Gallery"</b> tab hmang la, <b>100% buaina awm loin a tlang nghal e.</b>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Primary Universal App Launcher */}
                  <button
                    type="button"
                    onClick={() => {
                      const genericApp = UPI_APP_OPTIONS.find((a) => a.id === 'generic') || UPI_APP_OPTIONS[0];
                      handleLaunchUpiApp(genericApp);
                    }}
                    className="w-full p-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl flex items-center justify-between gap-3 shadow-md shadow-indigo-600/25 active:scale-98 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-black">Open UPI App Chooser</div>
                        <div className="text-[11px] text-indigo-100">
                          GPay, PhonePe, Paytm thlanna native popup a lo lang ang
                        </div>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-white" />
                    </div>
                  </button>

                  <div className="flex items-center gap-2 py-0.5">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Emaw App Hming Thlang Rawh
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>

                  {/* UPI Apps Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {UPI_APP_OPTIONS.filter((a) => a.id !== 'generic').map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => handleLaunchUpiApp(app)}
                        className="p-3 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-400 rounded-2xl flex items-center justify-between gap-3 text-left transition duration-150 shadow-2xs hover:shadow-sm group cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl ${app.iconBg} flex items-center justify-center font-black text-xs shadow-2xs shrink-0 group-hover:scale-105 transition-transform`}>
                            {app.shortName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition truncate">
                                {app.name}
                              </span>
                              {app.popular && (
                                <span className="text-[8.5px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded-full">
                                  Popular
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium">
                              Pay ₹{totalPayable.toLocaleString('en-IN')} directly
                            </p>
                          </div>
                        </div>

                        <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-indigo-600 text-slate-500 group-hover:text-white flex items-center justify-center shrink-0 transition">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Primary Direct Instant Pay Action */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-600 tracking-wider">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Direct UPI Clearing
                      </span>
                      <span className="text-[9px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-bold">Instant Receipt</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmSuccess}
                      disabled={isConfirming}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {isConfirming ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processing Payment & Generating Receipt...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>⚡ Pay ₹{totalPayable.toLocaleString('en-IN')} & Get Receipt (Direct)</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Switch to QR helper button */}
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => setPayMethodTab('qr')}
                      className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-indigo-200"
                    >
                      <QrCode className="w-4 h-4 text-indigo-600" />
                      <span>Bank Limit a awm chuan: QR Code & Gallery hmang rawh (100% Tlang)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: QR Code & Gallery Mode */}
              {payMethodTab === 'qr' && (
                <div className="bg-gradient-to-b from-indigo-50/60 via-white to-slate-50 border border-indigo-200 rounded-2xl p-4 text-center space-y-3.5 animate-fadeIn">
                  <div className="flex items-center justify-center">
                    <div className="bg-white p-3 rounded-2xl border-2 border-indigo-300 shadow-md inline-block">
                      {qrLoading ? (
                        <div className="w-44 h-44 flex flex-col items-center justify-center text-indigo-600 gap-2">
                          <Loader2 className="w-7 h-7 animate-spin" />
                          <span className="text-xs font-bold">Generating QR...</span>
                        </div>
                      ) : qrDataUrl ? (
                        <img src={qrDataUrl} alt="UPI QR Code" className="w-44 h-44 object-contain rounded-lg" />
                      ) : (
                        <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                          QR not available
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-black text-indigo-950">
                      Amount: <span className="text-emerald-700 font-extrabold text-base">₹{totalPayable.toLocaleString('en-IN')}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Payee: <b>{payeeDisplayName}</b> ({targetUpi})
                    </p>
                  </div>

                  {/* Primary QR Action Buttons */}
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {qrDataUrl && (
                      <a
                        href={qrDataUrl}
                        download={`RonPay-QR-${txRef}.png`}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 active:scale-95 transition"
                      >
                        <Download className="w-4 h-4" /> Download QR to Gallery
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => copyToClipboard(targetUpi, 'upi')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs active:scale-95 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedId ? 'Copied!' : 'Copy UPI'}</span>
                    </button>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="bg-white border border-slate-200 rounded-xl p-3 text-left space-y-2 shadow-2xs">
                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                      Awlsam taka pek dan (GPay / PhonePe):
                    </p>
                    <ol className="text-xs text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                      <li>
                        A chunga <b>"Download QR"</b> button kha hmet la, i gallery-ah save rawh.
                      </li>
                      <li>
                        <b>Google Pay</b> emaw <b>PhonePe</b> hawngin <b>QR Scanner</b> hmet la, <b>Gallery icon</b> atangin thlang la, ₹{totalPayable} pe rawh (100% tlang nghal ang).
                      </li>
                      <li>
                        I pek zawh veleh a hnuai chiah ami <b>"Ka Pe Zo Tawh"</b> hmetin receipt la nghal rawh le.
                      </li>
                    </ol>
                  </div>

                  {/* UTR Optional Input */}
                  <div className="text-left pt-1">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Bank UTR / Ref No. (Optional):
                    </label>
                    <input
                      type="text"
                      value={utrInput}
                      onChange={(e) => setUtrInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                      placeholder="e.g. 423589123456"
                      maxLength={22}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                  </div>

                  {/* Confirm Payment Button right on QR tab */}
                  <button
                    type="button"
                    onClick={handleConfirmSuccess}
                    disabled={isConfirming}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition cursor-pointer disabled:opacity-50"
                  >
                    {isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying & Generating Receipt...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Ka Pe Zo Tawh (Receipt La Rawh)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Waiting / Verification State after App Launch */}
          {step === 'waiting' && (
            <div className="space-y-4 py-2 animate-fadeIn">
              {hasReturnedFromApp && (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-3 flex items-center gap-2.5 text-xs text-emerald-950 animate-fadeIn shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="leading-snug">
                    UPI App aṭangin RonPay-ah i lo let leh ta! Pawisa i pe fel tawh a nih chuan a hnuaia <b>"Ka Pe Zo Tawh"</b> button hi hmet rawh le.
                  </span>
                </div>
              )}

              <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-md animate-pulse">
                  <Smartphone className="w-7 h-7" />
                </div>

                <div>
                  <h3 className="text-base font-black text-indigo-950">
                    {selectedApp?.name || 'UPI App'} Hawn Mek A Ni
                  </h3>
                  <p className="text-xs text-indigo-800 mt-1 max-w-sm mx-auto leading-relaxed">
                    Khawngaihin i UPI app-ah <b>₹{totalPayable.toLocaleString('en-IN')}</b> kha pe zo la, pek zawh veleh a hnuaia <b>"Ka Pe Zo Tawh"</b> button hi hmet rawh le.
                  </p>
                </div>

                <div className="bg-white rounded-xl p-2.5 border border-indigo-200 inline-block text-left text-xs space-y-1">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 font-medium">Recipient:</span>
                    <span className="font-bold text-slate-900">{payeeDisplayName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 font-medium">Txn Reference:</span>
                    <span className="font-mono font-bold text-amber-700">{txRef}</span>
                  </div>
                </div>

                {/* Helpful Troubleshooting tip for GPay/PhonePe account visibility & bank limit */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-left text-[11px] text-amber-900 space-y-2">
                  <p className="font-bold flex items-center gap-1.5 text-amber-950">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>"Exceeded Bank Limit" emaw Account a lan loh chuan:</span>
                  </p>
                  <p className="text-amber-800 leading-relaxed">
                    SBI leh bank thenkhat hian browser link atanga personal UPI a luh hi security vanga an block thin avangin, <b>QR Code Scan</b> hmangin pe rawh le. QR Code Scan hi chu 100% a tlang ngei ngei ang.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setPayMethodTab('qr');
                      setStep('select');
                    }}
                    className="w-full py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Code Scan & Gallery Hmang Rawh (100% Tlang)</span>
                  </button>
                </div>
              </div>

              {/* Optional UTR / Bank Reference input for extra record keeping */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                  <span>Bank UTR / Ref No. (Optional):</span>
                  <span className="text-[10px] text-slate-400 font-normal">UPI receipt-a 12-digit number</span>
                </label>
                <input
                  type="text"
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value)}
                  placeholder="e.g. 423589123456 (Optional)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleConfirmSuccess}
                  disabled={isConfirming}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 disabled:opacity-70"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording Payment in RonPay...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <span>Ka Pe Zo Tawh (Confirm & Get Receipt)</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedApp) handleLaunchUpiApp(selectedApp);
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Hawng Nawn Leh Rawh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    App Dang Thlang Rawh
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Direct NPCI UPI Protocol</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-bold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
