import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Building2,
  AlertCircle,
  ChevronDown,
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Clock,
  Sparkles,
  ChevronRight,
  Smartphone,
  Lock,
  CheckCircle2,
  Globe,
  ExternalLink
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Campaign, Transaction } from '../types';
import { saveTransaction } from '../utils/storage';
import { getCampaignCauseTitle } from '../utils/translations';

interface PhonePeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign;
  amount: number;
  platformFee?: number;
  feeOption?: 'ADD_ON' | 'DEDUCT';
  donorName: string;
  donorPhone?: string;
  donorVeng?: string;
  memberId?: string;
  subId?: string;
  isDependent?: boolean;
  isAnonymous?: boolean;
  remark?: string;
  subcatAmounts?: Record<string, number>;
  periodType?: string;
  periodMonth?: string;
  periodYear?: string;
  periodLabel?: string;
  onPaymentSuccess: (transaction: Transaction) => void;
}

type CheckoutStage = 
  | 'initial_loading'      // White loading screen with PhonePe Logo
  | 'checkout'             // Standard TSPMIZOPAYUAT desktop/mobile options screen matching image
  | 'pre_simulate_loading' // Transition white loading screen
  | 'simulate_response'    // Official PhonePe Simulate Payment Response screen
  | 'final_processing'     // Final brief processing before receipt
  | 'failure_view';        // Simulated failure screen

export const PhonePeCheckoutModal: React.FC<PhonePeCheckoutModalProps> = ({
  isOpen,
  onClose,
  campaign,
  amount,
  platformFee = 0,
  feeOption = 'ADD_ON',
  donorName,
  donorPhone,
  donorVeng,
  memberId,
  subId,
  isDependent = false,
  isAnonymous = false,
  remark,
  subcatAmounts,
  periodType,
  periodMonth,
  periodYear,
  periodLabel,
  onPaymentSuccess
}) => {
  const [stage, setStage] = useState<CheckoutStage>('initial_loading');
  const [activeTab, setActiveTab] = useState<'upi' | 'cards' | 'netbanking'>('upi');
  const [upiSubMode, setUpiSubMode] = useState<'qr' | 'apps' | 'vpa'>('qr');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('PhonePe');
  const [customVpa, setCustomVpa] = useState<string>('');
  const [vpaError, setVpaError] = useState<string>('');

  // Card details state
  const [cardNumber, setCardNumber] = useState<string>('');
  const [cardExpiry, setCardExpiry] = useState<string>('');
  const [cardCvv, setCardCvv] = useState<string>('');
  const [cardHolder, setCardHolder] = useState<string>(donorName || 'Valued Donor');
  const [saveCard, setSaveCard] = useState<boolean>(true);

  // Net Banking state
  const [selectedBank, setSelectedBank] = useState<string>('SBI');

  const [isBreakupOpen, setIsBreakupOpen] = useState<boolean>(false);
  const [simulatedStatus, setSimulatedStatus] = useState<'SUCCESS' | 'FAILURE' | 'SUBMITTED'>('SUCCESS');
  const [timeLeft, setTimeLeft] = useState<number>(298); // 04:58 mins
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [currentFeeOption, setCurrentFeeOption] = useState<'ADD_ON' | 'DEDUCT'>(feeOption);
  const [merchantTxnId, setMerchantTxnId] = useState<string>('');
  const [pendingMethodName, setPendingMethodName] = useState<string>('UPI QR Scan');
  const [qrFormat, setQrFormat] = useState<'weblink' | 'upiapp'>('weblink');
  const [hasLaunchedUpiApp, setHasLaunchedUpiApp] = useState<boolean>(false);

  const merchantName = 'TSPMIZOPAYUAT';
  const merchantVpa = 'mab060000049448@aubank';

  const effectiveFee = platformFee > 0 ? platformFee : Math.max(1, Math.round(amount * 0.01));
  const totalPayable = currentFeeOption === 'ADD_ON' ? amount + effectiveFee : amount;
  const campaignShare = currentFeeOption === 'ADD_ON' ? amount : Math.max(0, amount - effectiveFee);
  const campaignTitle = getCampaignCauseTitle(campaign);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initialize session whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlTxn = urlParams?.get('txn') || urlParams?.get('txnId') || urlParams?.get('merchantTransactionId');
    const newTxnId = urlTxn || `RPAY_TXN_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    setMerchantTxnId(newTxnId);
    setStage('initial_loading');
    setActiveTab('upi');
    setUpiSubMode('qr');
    setIsBreakupOpen(false);
    setSimulatedStatus('SUCCESS');
    setTimeLeft(298);
    setCardNumber('');
    setCardExpiry('');
    setCardCvv('');
    setCardHolder(donorName || 'Valued Donor');
    setSelectedBank('SBI');
    setCustomVpa('');
    setVpaError('');
    setHasLaunchedUpiApp(false);

    // Pre-register transaction as PENDING in backend store
    fetch('/api/phonepe/initiate-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantTransactionId: newTxnId,
        amountInRupees: totalPayable,
        campaignId: campaign?.id,
        campaignTitle: campaignTitle,
        donorName: donorName || 'Valued Donor',
        donorPhone: donorPhone,
        category: campaign?.category || 'others',
        feeOption: currentFeeOption,
        simulateStatus: 'PENDING'
      })
    }).catch(() => {});

    // Initial loading screen with PhonePe Logo
    const timer = setTimeout(() => {
      setStage('checkout');
    }, 600);

    return () => clearTimeout(timer);
  }, [isOpen, amount, campaignTitle]);

  // Countdown timer matching PhonePe PG V2 (04:58 mins)
  useEffect(() => {
    if (!isOpen || stage !== 'checkout') return;
    const interval = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, stage]);

  // Real-time status polling & multi-window event synchronization
  useEffect(() => {
    if (!isOpen || stage !== 'checkout' || !merchantTxnId) return;

    // 1. Polling server status
    const pollInterval = setInterval(async () => {
      try {
        const resp = await fetch(`/api/phonepe/status/${encodeURIComponent(merchantTxnId)}`);
        if (resp.ok) {
          const data = await resp.json();
          if (
            data?.code === 'PAYMENT_SUCCESS' ||
            data?.code === 'SUCCESS' ||
            data?.data?.state === 'COMPLETED' ||
            data?.data?.status === 'SUCCESS' ||
            data?.data?.status === 'PAYMENT_SUCCESS'
          ) {
            clearInterval(pollInterval);
            finalizeSuccess(data?.data?.paymentInstrument?.utr || data?.data?.utr || ('UTR' + Date.now()));
          } else if (data?.code === 'PAYMENT_ERROR' || data?.data?.state === 'FAILED') {
            clearInterval(pollInterval);
            setStage('failure_view');
          }
        }
      } catch (e) {
        // network polling silent catch
      }
    }, 1000);

    // 2. BroadcastChannel for cross-tab and mobile scan-pay window synchronization
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('ronpay_payment_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'PHONEPE_PAYMENT_SUCCESS') {
            if (!event.data.txnId || event.data.txnId === merchantTxnId) {
              clearInterval(pollInterval);
              finalizeSuccess(event.data.utr || ('UTR' + Date.now()));
            }
          }
        };
      }
    } catch (e) {}

    // 3. Storage event listener for cross-window notifications
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'RONPAY_LAST_CONFIRMED_TXN' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.status === 'PAYMENT_SUCCESS' && (parsed?.transaction?.id === merchantTxnId || !merchantTxnId)) {
            clearInterval(pollInterval);
            finalizeSuccess(parsed?.transaction?.utr);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      clearInterval(pollInterval);
      try { bc?.close(); } catch (e) {}
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOpen, stage, merchantTxnId]);

  // 1. Authentic standard NPCI UPI Intent URI for Scan & Pay in UPI apps
  const upiPaymentUri = useMemo(() => {
    const encName = encodeURIComponent(merchantName);
    const encNote = encodeURIComponent(`RonPay:${campaign?.id || 'bawm'}:${merchantTxnId}`);
    return `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encName}&am=${totalPayable.toFixed(2)}&cu=INR&tn=${encNote}&tr=${encodeURIComponent(merchantTxnId)}`;
  }, [merchantVpa, merchantName, totalPayable, merchantTxnId, campaign?.id]);

  // 2. Dedicated PhonePe PG Sandbox Scan & Pay mobile web portal link
  // When scanned by phone camera, Google Lens, or mobile QR scanner, it opens the PhonePe PG Sandbox Scan & Pay portal
  const scanPayWebLink = useMemo(() => {
    if (typeof window === 'undefined' || !merchantTxnId) return '';
    const origin = window.location.origin;
    const campId = campaign?.id || 'cmp-custom';
    const encTitle = encodeURIComponent(campaignTitle || campaign?.title || 'RonPay Bawm');
    const encDonor = encodeURIComponent(isAnonymous ? 'Anonymous' : (donorName || 'Valued Donor'));
    const encLoc = encodeURIComponent(campaign?.location || donorVeng || 'Mizoram');
    const amt = totalPayable.toFixed(2);
    
    return `${origin}/api/phonepe/scan-pay?txnId=${encodeURIComponent(merchantTxnId)}&amt=${amt}&donor=${encDonor}&cause=${encTitle}&mid=TSPMIZOPAYUAT&campId=${encodeURIComponent(campId)}&loc=${encLoc}`;
  }, [campaign, campaignTitle, merchantTxnId, totalPayable, donorName, donorVeng, isAnonymous]);

  // Active QR value: 'weblink' provides a real clickable Web Link for Web Scanners, while 'upiapp' provides direct UPI protocol
  const activeQrCodeValue = qrFormat === 'weblink' ? (scanPayWebLink || upiPaymentUri) : upiPaymentUri;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyUpi = () => {
    try {
      navigator.clipboard.writeText(merchantVpa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch (e) {
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  // Mobile App Deep-linking for UPI apps
  const handlePayViaSelectedApp = () => {
    const encName = encodeURIComponent(merchantName);
    const encNote = encodeURIComponent(`RonPay:${campaign?.id || 'bawm'}:${merchantTxnId}`);
    const baseParams = `pa=${encodeURIComponent(merchantVpa)}&pn=${encName}&am=${totalPayable.toFixed(2)}&cu=INR&tn=${encNote}&tr=${encodeURIComponent(merchantTxnId)}`;

    let intentUri = `upi://pay?${baseParams}`;
    if (selectedUpiApp === 'PhonePe') intentUri = `phonepe://pay?${baseParams}`;
    else if (selectedUpiApp === 'Google Pay') intentUri = `gpay://upi/pay?${baseParams}`;
    else if (selectedUpiApp === 'Paytm UPI') intentUri = `paytmmp://pay?${baseParams}`;
    else if (selectedUpiApp === 'BHIM UPI') intentUri = `bhim://pay?${baseParams}`;
    else if (selectedUpiApp === 'CRED UPI') intentUri = `credpay://upi/pay?${baseParams}`;

    // On mobile devices, launch the installed UPI application
    if (typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = intentUri;
      setTimeout(() => {
        proceedToSimulation(`UPI App (${selectedUpiApp})`);
      }, 1500);
    } else {
      proceedToSimulation(`UPI App (${selectedUpiApp})`);
    }
  };

  // Demo card auto-fill helper
  const handleQuickFillDemoCard = () => {
    setCardNumber('4532 8888 1234 5678');
    setCardExpiry('12/28');
    setCardCvv('892');
    setCardHolder(donorName || 'Valued Donor');
  };

  // Trigger loading screen then Simulate Payment Response page
  const proceedToSimulation = (methodName: string) => {
    setPendingMethodName(methodName);
    setStage('pre_simulate_loading');
    setTimeout(() => {
      setStage('simulate_response');
    }, 500);
  };

  // Handle card submit
  const handlePayByCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber.trim() || cardNumber.replace(/\s/g, '').length < 12) {
      alert('Khawngaihin Card Number dik tak dah rawh.');
      return;
    }
    proceedToSimulation(`Card Payment (${cardNumber.slice(-4)})`);
  };

  // Handle NetBanking submit
  const handlePayByNetBanking = () => {
    proceedToSimulation(`Net Banking (${selectedBank})`);
  };

  // Handle custom UPI ID submit
  const handlePayByVpa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customVpa.trim() || !customVpa.includes('@')) {
      setVpaError('UPI ID dik tak dah rawh (e.g. mobile@upi / name@okhdfcbank)');
      return;
    }
    setVpaError('');
    proceedToSimulation(`UPI ID (${customVpa})`);
  };

  // Final confirmation of the simulated response
  const handleSubmitSimulatedResponse = () => {
    if (simulatedStatus === 'FAILURE') {
      setStage('failure_view');
      return;
    }

    if (simulatedStatus === 'SUBMITTED') {
      setStage('pre_simulate_loading');
      setTimeout(() => {
        finalizeSuccess();
      }, 1200);
      return;
    }

    finalizeSuccess();
  };

  const finalizeSuccess = (existingUtr?: string) => {
    setStage('final_processing');

    const utrCode = existingUtr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000));
    const completedTx: Transaction = {
      id: merchantTxnId,
      campaignId: campaign?.id || 'general-fund',
      campaignTitle: campaignTitle,
      donorName: donorName?.trim() || 'Valued Donor',
      donorPhone: donorPhone?.trim() || undefined,
      donorVeng: donorVeng?.trim() || undefined,
      memberId,
      subId,
      isDependent,
      isAnonymous,
      amount,
      platformFee: effectiveFee,
      feeOption: currentFeeOption,
      campaignNetReceived: campaignShare,
      totalAmount: totalPayable,
      paymentMethod: 'phonepe',
      status: 'completed',
      remark: remark?.trim() || undefined,
      subCategoryBreakdown: subcatAmounts,
      periodType,
      periodMonth,
      periodYear,
      periodLabel,
      timestamp: new Date().toISOString(),
      txHash: utrCode,
      utr: utrCode
    };

    // Save transaction locally and in storage
    try {
      saveTransaction(completedTx);
      localStorage.setItem(`RONPAY_PENDING_TX_${completedTx.id}`, JSON.stringify(completedTx));
      localStorage.setItem('RONPAY_LAST_CONFIRMED_TXN', JSON.stringify({
        status: 'PAYMENT_SUCCESS',
        transaction: completedTx,
        timestamp: Date.now()
      }));
    } catch (e) {}

    // Dispatch webhook & notify backend
    fetch('/api/phonepe/confirm-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantTransactionId: completedTx.id,
        status: 'PAYMENT_SUCCESS',
        amountInRupees: totalPayable,
        donorName: completedTx.donorName,
        campaignTitle: completedTx.campaignTitle,
        utr: utrCode
      })
    }).catch(() => {});

    setTimeout(() => {
      onClose();
      onPaymentSuccess(completedTx);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-4xl lg:max-w-5xl bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden min-h-0 max-h-[96vh] flex flex-col select-none">

        {/* Prominent Global Close Button (Always visible on all screens & stages) */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-50 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200/90 shadow-xs transition-all cursor-pointer flex items-center justify-center group active:scale-95"
          title="Kharna (Close Payment) • Esc"
          aria-label="Close"
        >
          <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-150" />
        </button>

        {/* ------------------------------------------------------------- */}
        {/* STAGE: White Loading Screen with PhonePe Logo                  */}
        {/* ------------------------------------------------------------- */}
        {(stage === 'initial_loading' || stage === 'pre_simulate_loading' || stage === 'final_processing') && (
          <div className="flex-1 bg-white text-slate-900 flex flex-col justify-between items-center px-6 py-16 sm:py-28 min-h-[500px]">
            <div className="w-full h-8 flex justify-end">
              <button 
                type="button" 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#5f259f] text-white flex items-center justify-center shadow-md mb-8">
                <span className="text-3xl font-black font-sans leading-none select-none tracking-tight">पे</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-normal text-slate-800 tracking-tight leading-snug">
                Please wait,<br />processing your request
              </h2>
              <div className="mt-8">
                <div className="w-6 h-6 border-2 border-[#5f259f] border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
            <div className="text-center px-4 pb-4">
              <p className="text-xs text-slate-400 font-normal leading-relaxed">
                Please don't hit the back button until the action is complete.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE: PhonePe Simulate Payment Response Screen               */}
        {/* ------------------------------------------------------------- */}
        {stage === 'simulate_response' && (
          <div className="flex-1 bg-white text-slate-900 flex flex-col justify-between px-6 py-10 max-w-md mx-auto w-full min-h-[500px]">
            <div className="flex justify-between items-center w-full">
              <button
                type="button"
                onClick={() => setStage('checkout')}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Options</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center text-center my-auto py-6">
              <div className="w-14 h-14 rounded-full bg-[#5f259f] text-white flex items-center justify-center shadow-sm mx-auto mb-4">
                <span className="text-2xl font-black font-sans leading-none select-none tracking-tight">पे</span>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Simulate Payment Response
              </h1>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Method: <strong className="text-purple-800 font-medium">{pendingMethodName}</strong> • Select a status:
              </p>

              <div className="space-y-3 w-full max-w-xs">
                <button
                  type="button"
                  onClick={() => setSimulatedStatus('SUCCESS')}
                  className={`w-full py-3 px-4 rounded-md text-sm font-bold text-white transition-all cursor-pointer text-center bg-[#22c55e] hover:bg-[#16a34a] shadow-xs ${
                    simulatedStatus === 'SUCCESS' ? 'border-2 border-slate-950 ring-2 ring-slate-950 scale-[1.02]' : 'border-2 border-transparent'
                  }`}
                >
                  Success
                </button>

                <button
                  type="button"
                  onClick={() => setSimulatedStatus('FAILURE')}
                  className={`w-full py-3 px-4 rounded-md text-sm font-bold text-white transition-all cursor-pointer text-center bg-[#ef4444] hover:bg-[#dc2626] shadow-xs flex items-center justify-center gap-1 ${
                    simulatedStatus === 'FAILURE' ? 'border-2 border-slate-950 ring-2 ring-slate-950 scale-[1.02]' : 'border-2 border-transparent'
                  }`}
                >
                  <span>Failure</span>
                  <span className="text-xs">▸</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimulatedStatus('SUBMITTED')}
                  className={`w-full py-2.5 px-4 rounded-md text-sm font-bold text-white transition-all cursor-pointer text-center bg-[#9ca3af] hover:bg-[#6b7280] shadow-xs ${
                    simulatedStatus === 'SUBMITTED' ? 'border-2 border-slate-950 ring-2 ring-slate-950 scale-[1.02]' : 'border-2 border-transparent'
                  }`}
                >
                  <div>Submitted</div>
                  <div className="text-[10px] text-slate-100 font-normal">Only for Corp NetBanking</div>
                </button>
              </div>

              <button
                type="button"
                onClick={handleSubmitSimulatedResponse}
                className="w-full max-w-xs mt-7 py-3 px-4 rounded-md bg-[#5f259f] hover:bg-[#521d8b] text-white font-bold text-base transition shadow-md cursor-pointer active:scale-[0.99] text-center"
              >
                Submit
              </button>
            </div>

            <div className="text-center text-[11px] text-slate-400">
              Amount: ₹{totalPayable.toFixed(2)} • Txn: {merchantTxnId}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE: Failure View Screen                                    */}
        {/* ------------------------------------------------------------- */}
        {stage === 'failure_view' && (
          <div className="flex-1 bg-white text-slate-900 flex flex-col justify-center items-center px-6 py-16 text-center min-h-[500px]">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Payment Failed / Declined</h2>
            <p className="text-xs text-slate-500 mb-6 max-w-xs">
              PhonePe PG received simulated failure or user cancellation response. No donation was deducted.
            </p>
            <div className="w-full max-w-xs space-y-2">
              <button
                type="button"
                onClick={() => setStage('checkout')}
                className="w-full py-3 rounded-xl bg-[#5f259f] hover:bg-[#511e89] text-white font-bold text-sm cursor-pointer shadow-md active:scale-98 transition"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs cursor-pointer transition"
              >
                Cancel & Close
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STAGE: Desktop Web Checkout Screen (Matching User Image)      */}
        {/* ------------------------------------------------------------- */}
        {stage === 'checkout' && (
          <div className="flex-1 flex flex-col overflow-y-auto bg-white">

            {/* Mobile Top App Bar (visible on small screens) */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#ff6d00] flex items-center justify-center text-white shadow-2xs">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                    <path d="M3 6h18" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">{merchantName}</h1>
                  <p className="text-[10px] text-slate-500">PhonePe PG UAT</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-slate-900 font-mono">₹{totalPayable.toFixed(2)}</span>
                <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Web Page Layout (Split Left and Right columns on desktop) */}
            <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">

              {/* ========================================================= */}
              {/* LEFT COLUMN: Merchant Branding, Total, & Powered By PhonePe */}
              {/* ========================================================= */}
              <div className="w-full md:w-[35%] lg:w-[32%] p-6 sm:p-8 flex flex-col justify-between bg-white">
                <div>
                  {/* Merchant Brand Icon & Name */}
                  <div className="hidden md:flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#ff6d00] flex items-center justify-center text-white shadow-sm shrink-0">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <path d="M3 6h18" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                    </div>
                    <span className="text-base font-bold text-slate-900 tracking-tight">
                      {merchantName}
                    </span>
                  </div>

                  {/* Total Box with Dropdown (matching image) */}
                  <div className="mt-4 md:mt-8">
                    <button
                      type="button"
                      onClick={() => setIsBreakupOpen(!isBreakupOpen)}
                      className="w-full bg-[#f8f9fa] hover:bg-slate-100/90 border border-slate-200/90 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer transition shadow-2xs group"
                    >
                      <span className="text-sm font-semibold text-slate-700">Total</span>
                      <span className="text-slate-400 font-bold">:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-slate-900 font-mono">
                          ₹{totalPayable.toFixed(2)}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-transform ${isBreakupOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Expandable Order Breakdown */}
                    <AnimatePresence>
                      {isBreakupOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 text-xs space-y-2">
                            <div className="flex justify-between text-slate-600">
                              <span>Donation / Base Amount:</span>
                              <span className="font-mono font-semibold text-slate-800">₹{amount.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>RonPay Platform Fee (1%):</span>
                              <span className="font-mono font-semibold text-purple-700">₹{effectiveFee.toFixed(2)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                              <span>Total Payable:</span>
                              <span className="font-mono text-[#5f259f]">₹{totalPayable.toFixed(2)}</span>
                            </div>

                            {/* Fee Mode Setting */}
                            <div className="pt-2 border-t border-slate-200">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1.5">Platform Fee Option:</p>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setCurrentFeeOption('ADD_ON')}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold text-center border cursor-pointer transition ${
                                    currentFeeOption === 'ADD_ON'
                                      ? 'border-[#5f259f] bg-purple-100 text-[#5f259f]'
                                      : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  100+1 (Pe Belh)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCurrentFeeOption('DEDUCT')}
                                  className={`py-1.5 px-2 rounded-lg text-[10px] font-bold text-center border cursor-pointer transition ${
                                    currentFeeOption === 'DEDUCT'
                                      ? 'border-[#5f259f] bg-purple-100 text-[#5f259f]'
                                      : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                                  }`}
                                >
                                  99+1 (Paih Thla)
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Donor & Campaign details */}
                  <div className="mt-4 pt-4 border-t border-slate-100 hidden md:block text-xs space-y-1 text-slate-500">
                    <p><span className="font-medium text-slate-700">Payer:</span> {donorName || 'Valued Donor'}</p>
                    {donorVeng && <p><span className="font-medium text-slate-700">Veng:</span> {donorVeng}</p>}
                    <p className="truncate"><span className="font-medium text-slate-700">Cause:</span> {campaignTitle}</p>
                  </div>

                  {/* Desktop Cancel / Close Button in Left Column */}
                  <div className="mt-4 pt-2 hidden md:block">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                      <span>Kharna (Cancel & Close)</span>
                    </button>
                  </div>
                </div>

                {/* Powered by PhonePe at bottom (matching image) */}
                <div className="pt-8 mt-auto flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="text-[11px] text-slate-400 font-medium">Powered by</span>
                  <div className="w-4 h-4 rounded-full bg-[#5f259f] text-white flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-black font-sans leading-none select-none">पे</span>
                  </div>
                  <span className="font-bold text-slate-800 tracking-tight text-xs">PhonePe</span>
                </div>
              </div>

              {/* ========================================================= */}
              {/* RIGHT COLUMN: Payment Options Card (Matching User Image) */}
              {/* ========================================================= */}
              <div className="w-full md:w-[65%] lg:w-[68%] p-4 sm:p-6 md:p-8 flex flex-col justify-between bg-white">
                
                {/* Outlined Payment Options Card */}
                <div className="rounded-2xl border border-slate-200 p-4 sm:p-6 bg-white shadow-2xs">

                  {/* Payment Options Header (Centered at top) */}
                  <div className="text-center pb-4 border-b border-slate-100">
                    <h2 className="text-sm sm:text-base font-semibold text-slate-700">
                      Payment Options
                    </h2>
                  </div>

                  {/* Inner Split: Sub-left method tabs & Sub-right Options Container */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4">

                    {/* SUB-LEFT: UPI & Other Methods Selection List (4.5 cols) */}
                    <div className="md:col-span-5 space-y-4">
                      
                      {/* UPI Payment Category */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          UPI Payment
                        </div>

                        {/* UPI Tab Item (Switches tab without jumping directly) */}
                        <button
                          type="button"
                          onClick={() => setActiveTab('upi')}
                          className={`w-full text-left p-3 rounded-lg flex items-start gap-2.5 transition cursor-pointer relative ${
                            activeTab === 'upi'
                              ? 'bg-[#f8f4fe] border border-purple-200 border-l-4 border-l-[#5f259f]'
                              : 'bg-white hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {/* Official Triangular UPI Icon */}
                          <div className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <path d="M12 2L2 20h9l3-8h6L12 2z" fill="#097939" />
                              <path d="M14 12l-3 8h9l-6-8z" fill="#ED752E" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">UPI</p>
                            <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                              Pay via QR, UPI apps, or VPA
                            </p>
                          </div>
                        </button>
                      </div>

                      {/* Other Methods Category */}
                      <div>
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Other Methods
                        </div>

                        <div className="space-y-2">
                          {/* Debit/Credit Card (Switches tab without jumping directly) */}
                          <button
                            type="button"
                            onClick={() => setActiveTab('cards')}
                            className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition cursor-pointer ${
                              activeTab === 'cards'
                                ? 'bg-[#f8f4fe] border border-purple-200 border-l-4 border-l-[#5f259f]'
                                : 'bg-white hover:bg-slate-50 border border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-slate-600" />
                              <span className="text-xs font-semibold text-slate-800">Debit/Credit Card</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Visa & Mastercard mini emblems */}
                              <span className="text-[9px] font-black italic tracking-tighter text-[#1a1f71] bg-slate-100 px-1 py-0.5 rounded">VISA</span>
                              <span className="w-3.5 h-3.5 rounded-full bg-[#eb001b] inline-block -mr-1.5 opacity-90" />
                              <span className="w-3.5 h-3.5 rounded-full bg-[#f79e1b] inline-block opacity-90" />
                              <span className="text-[9px] text-slate-400 ml-1 font-medium">+2</span>
                            </div>
                          </button>

                          {/* Net Banking (Switches tab without jumping directly) */}
                          <button
                            type="button"
                            onClick={() => setActiveTab('netbanking')}
                            className={`w-full text-left p-3 rounded-lg flex items-center justify-between transition cursor-pointer ${
                              activeTab === 'netbanking'
                                ? 'bg-[#f8f4fe] border border-purple-200 border-l-4 border-l-[#5f259f]'
                                : 'bg-white hover:bg-slate-50 border border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-600" />
                              <span className="text-xs font-semibold text-slate-800">Net Banking</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Mini bank icons */}
                              <span className="w-3 h-3 rounded-full bg-[#004c8f] inline-block" title="SBI" />
                              <span className="w-3 h-3 rounded-full bg-[#004b87] inline-block" title="HDFC" />
                              <span className="w-3 h-3 rounded-full bg-[#b02a30] inline-block" title="ICICI" />
                              <span className="text-[9px] text-slate-400 font-medium">+57</span>
                            </div>
                          </button>
                        </div>
                      </div>

                    </div>

                    {/* SUB-RIGHT: Active Method Selection & Forms (7.5 cols) */}
                    <div className="md:col-span-7">

                      {/* --------------------------------------------------- */}
                      {/* TAB 1: UPI Options (QR Code, UPI Apps, UPI ID)      */}
                      {/* --------------------------------------------------- */}
                      {activeTab === 'upi' && (
                        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center bg-white shadow-2xs relative min-h-[360px]">
                          
                          {/* Sub-modes pill bar */}
                          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-3 text-xs w-full max-w-xs">
                            <button
                              type="button"
                              onClick={() => setUpiSubMode('qr')}
                              className={`flex-1 py-1.5 rounded-lg font-bold text-center cursor-pointer transition ${
                                upiSubMode === 'qr'
                                  ? 'bg-white text-[#5f259f] shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              QR Code
                            </button>
                            <button
                              type="button"
                              onClick={() => setUpiSubMode('apps')}
                              className={`flex-1 py-1.5 rounded-lg font-bold text-center cursor-pointer transition ${
                                upiSubMode === 'apps'
                                  ? 'bg-white text-[#5f259f] shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              UPI Apps
                            </button>
                            <button
                              type="button"
                              onClick={() => setUpiSubMode('vpa')}
                              className={`flex-1 py-1.5 rounded-lg font-bold text-center cursor-pointer transition ${
                                upiSubMode === 'vpa'
                                  ? 'bg-white text-[#5f259f] shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              UPI ID
                            </button>
                          </div>

                          {/* Sub-mode 1: QR Code */}
                          {upiSubMode === 'qr' && (
                            <>
                              <h3 className="text-xs sm:text-sm font-bold text-slate-800 mb-1">
                                Scan to Pay (PhonePe / Any UPI)
                              </h3>

                              {/* Row of UPI mini app logos */}
                              <div className="flex items-center justify-center gap-2.5 my-1">
                                <div className="w-5 h-5 rounded-full bg-[#5f259f] text-white flex items-center justify-center shadow-2xs" title="PhonePe">
                                  <span className="text-[9px] font-black leading-none">पे</span>
                                </div>
                                <div className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-2xs" title="Google Pay">
                                  <span className="text-[10px] font-bold text-blue-600">G</span>
                                </div>
                                <div className="w-5 h-5 rounded-full bg-[#00baf2] text-white flex items-center justify-center shadow-2xs font-bold text-[8px]" title="Paytm">
                                  P
                                </div>
                                <div className="w-5 h-5 rounded-full bg-[#004c8f] text-white flex items-center justify-center shadow-2xs font-bold text-[8px]" title="BHIM">
                                  B
                                </div>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                  <path d="M12 2L2 20h9l3-8h6L12 2z" fill="#097939" />
                                  <path d="M14 12l-3 8h9l-6-8z" fill="#ED752E" />
                                </svg>
                              </div>

                              {/* QR Format Selector: Web Link QR vs Direct UPI App QR */}
                              <div className="flex items-center justify-center p-1 bg-slate-100 rounded-xl border border-slate-200 my-2 w-full max-w-[280px] text-xs font-semibold">
                                <button
                                  type="button"
                                  onClick={() => setQrFormat('weblink')}
                                  className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer text-[11px] ${
                                    qrFormat === 'weblink'
                                      ? 'bg-white text-[#5f259f] shadow-xs font-bold'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                  title="Produces a real clickable HTTPS Web Link for Web Scanners and Phone Cameras"
                                >
                                  <Globe className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Web Link QR</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setQrFormat('upiapp')}
                                  className={`flex-1 py-1.5 px-2 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer text-[11px] ${
                                    qrFormat === 'upiapp'
                                      ? 'bg-white text-[#5f259f] shadow-xs font-bold'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                  title="Produces an authentic standard upi://pay URI for scanning directly inside UPI apps"
                                >
                                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Direct UPI App QR</span>
                                </button>
                              </div>

                              {/* Center QR Code with PhonePe Logo overlay in center */}
                              <div 
                                onClick={() => proceedToSimulation('UPI QR Scan')}
                                className="relative my-1 p-3 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-purple-400 hover:shadow-md transition-all transform hover:scale-[1.01] group"
                                title="Scan with phone or click to simulate payment"
                              >
                                <QRCodeSVG 
                                  value={activeQrCodeValue} 
                                  size={168} 
                                  level="M" 
                                  includeMargin={false} 
                                />
                                {/* Purple PhonePe circle in center of QR */}
                                <div className="absolute inset-0 m-auto w-7 h-7 rounded-full bg-[#5f259f] border-2 border-white shadow-md flex items-center justify-center text-white pointer-events-none">
                                  <span className="text-xs font-black font-sans leading-none">पे</span>
                                </div>
                              </div>

                              {/* Format indicator & link helper */}
                              <div className="mt-1 text-center">
                                {qrFormat === 'weblink' ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[11px] font-medium text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                      🌐 Web QR Scanner, Camera & Google Lens scan atan (Link nei)
                                    </span>
                                    {scanPayWebLink && (
                                      <a
                                        href={scanPayWebLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] text-purple-600 hover:text-purple-800 underline inline-flex items-center gap-1 mt-0.5"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>Link test / Phone-ah hawng rawh</span>
                                      </a>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                    📱 PhonePe, GPay, Paytm App in-app scanner direct atan (UPI URI)
                                  </span>
                                )}
                              </div>

                              {/* QR Expiration Badge (Matching image) */}
                              <div className="mt-1 px-3 py-1 bg-slate-100 rounded-full text-[11px] text-slate-500 font-medium">
                                This QR will expire in {formatTimer(timeLeft)}
                              </div>

                              {/* Quick Interactive Button & UPI VPA */}
                              <div className="mt-2.5 w-full pt-2 border-t border-slate-100 flex flex-col items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => proceedToSimulation('UPI QR Scan')}
                                  className="w-full py-2.5 px-4 bg-[#5f259f] hover:bg-[#511e89] active:scale-[0.99] text-white rounded-xl font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                                >
                                  <QrCode className="w-4 h-4 text-amber-300" />
                                  <span>Simulate QR Payment Response</span>
                                  <ChevronRight className="w-3.5 h-3.5 text-purple-200" />
                                </button>

                                <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
                                  <span>VPA: <span className="font-mono text-slate-600">{merchantVpa}</span></span>
                                  <button
                                    type="button"
                                    onClick={handleCopyUpi}
                                    className="p-0.5 text-purple-600 hover:text-purple-800 cursor-pointer"
                                    title="Copy VPA"
                                  >
                                    {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Sub-mode 2: UPI Apps Selection */}
                          {upiSubMode === 'apps' && (
                            <div className="w-full text-left space-y-3">
                              <p className="text-xs font-bold text-slate-700">Select your preferred UPI App:</p>
                              <div className="grid grid-cols-2 gap-2">
                                {[
                                  { name: 'PhonePe', color: 'bg-[#5f259f]', letter: 'पे', isPhonePe: true, badge: 'Fastest' },
                                  { name: 'Google Pay', color: 'bg-white text-blue-600 border border-slate-200', letter: 'G' },
                                  { name: 'Paytm UPI', color: 'bg-[#00baf2] text-white', letter: 'P' },
                                  { name: 'BHIM UPI', color: 'bg-[#004c8f] text-white', letter: 'B' },
                                  { name: 'CRED UPI', color: 'bg-slate-900 text-white', letter: 'C' },
                                  { name: 'Other UPI', color: 'bg-purple-600 text-white', letter: 'UPI' },
                                ].map((app) => (
                                  <button
                                    key={app.name}
                                    type="button"
                                    onClick={() => setSelectedUpiApp(app.name)}
                                    className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition text-left ${
                                      selectedUpiApp === app.name
                                        ? 'border-[#5f259f] bg-purple-50/70 ring-1 ring-[#5f259f]'
                                        : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${app.color}`}>
                                        {app.letter}
                                      </div>
                                      <span className="text-xs font-semibold text-slate-800">{app.name}</span>
                                    </div>
                                    {app.badge && (
                                      <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                        {app.badge}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={handlePayViaSelectedApp}
                                className="w-full mt-4 py-3 px-4 bg-[#5f259f] hover:bg-[#511e89] text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Smartphone className="w-4 h-4 text-amber-300" />
                                <span>Pay ₹{totalPayable.toFixed(2)} via {selectedUpiApp}</span>
                              </button>

                              {hasLaunchedUpiApp && (
                                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-300 text-center space-y-2 mt-3 animate-in fade-in">
                                  <p className="text-xs font-bold text-emerald-900">
                                    📱 {selectedUpiApp}-ah payment i zo tawh em?
                                  </p>
                                  <p className="text-[11px] text-emerald-700">
                                    Payment i tih zawh tawh chuan a hnuaia button hi hmet la, receipt a in-generate nghal ang:
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => finalizeSuccess('UTR' + Date.now())}
                                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Aw, Ka Pe Zo E (Complete & Close)</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Sub-mode 3: Enter UPI ID */}
                          {upiSubMode === 'vpa' && (
                            <form onSubmit={handlePayByVpa} className="w-full text-left space-y-3">
                              <label className="text-xs font-bold text-slate-700 block">
                                Enter your UPI ID / VPA
                              </label>
                              <input
                                type="text"
                                value={customVpa}
                                onChange={(e) => {
                                  setCustomVpa(e.target.value);
                                  setVpaError('');
                                }}
                                placeholder="e.g. 9862300000@ybl / username@okhdfcbank"
                                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5f259f] focus:border-[#5f259f] outline-none"
                              />
                              {vpaError && (
                                <p className="text-[11px] text-red-600 font-medium">{vpaError}</p>
                              )}

                              <div className="flex flex-wrap gap-1.5 pt-1">
                                <span className="text-[10px] text-slate-400">Demo test IDs:</span>
                                {['testuser@phonepe', 'donor@okhdfcbank', '9862300000@ybl'].map((tid) => (
                                  <button
                                    key={tid}
                                    type="button"
                                    onClick={() => setCustomVpa(tid)}
                                    className="text-[10px] font-mono bg-slate-100 hover:bg-purple-100 text-purple-700 px-2 py-0.5 rounded cursor-pointer transition"
                                  >
                                    {tid}
                                  </button>
                                ))}
                              </div>

                              <button
                                type="submit"
                                className="w-full mt-4 py-3 px-4 bg-[#5f259f] hover:bg-[#511e89] text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                <span>Verify & Pay ₹{totalPayable.toFixed(2)}</span>
                              </button>
                            </form>
                          )}

                        </div>
                      )}

                      {/* --------------------------------------------------- */}
                      {/* TAB 2: Debit/Credit Card Form (Realistic Input)    */}
                      {/* --------------------------------------------------- */}
                      {activeTab === 'cards' && (
                        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-2xs min-h-[360px] flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                              <h3 className="text-xs sm:text-sm font-bold text-slate-800">
                                Enter Card Details
                              </h3>
                              <button
                                type="button"
                                onClick={handleQuickFillDemoCard}
                                className="text-[10px] font-bold text-[#5f259f] bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg border border-purple-200 cursor-pointer transition flex items-center gap-1"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>Quick Fill Demo Card</span>
                              </button>
                            </div>

                            <form onSubmit={handlePayByCard} className="space-y-3">
                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                  Card Number
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={cardNumber}
                                    onChange={(e) => setCardNumber(e.target.value)}
                                    placeholder="4532  ••••  ••••  1890"
                                    className="w-full pl-3 pr-20 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#5f259f] focus:border-[#5f259f] outline-none"
                                  />
                                  <div className="absolute right-2 top-2.5 flex items-center gap-1">
                                    <span className="text-[9px] font-black italic text-[#1a1f71] bg-slate-100 px-1 py-0.5 rounded">VISA</span>
                                    <span className="w-3 h-3 rounded-full bg-[#eb001b] inline-block -mr-1" />
                                    <span className="w-3 h-3 rounded-full bg-[#f79e1b] inline-block" />
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    Valid Thru
                                  </label>
                                  <input
                                    type="text"
                                    value={cardExpiry}
                                    onChange={(e) => setCardExpiry(e.target.value)}
                                    placeholder="MM / YY"
                                    maxLength={5}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#5f259f] focus:border-[#5f259f] outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    CVV
                                  </label>
                                  <input
                                    type="password"
                                    value={cardCvv}
                                    onChange={(e) => setCardCvv(e.target.value)}
                                    placeholder="•••"
                                    maxLength={4}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#5f259f] focus:border-[#5f259f] outline-none"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                  Name on Card
                                </label>
                                <input
                                  type="text"
                                  value={cardHolder}
                                  onChange={(e) => setCardHolder(e.target.value)}
                                  placeholder="Name as printed on card"
                                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-[#5f259f] focus:border-[#5f259f] outline-none"
                                />
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                  type="checkbox"
                                  checked={saveCard}
                                  onChange={(e) => setSaveCard(e.target.checked)}
                                  className="w-3.5 h-3.5 accent-[#5f259f] rounded"
                                />
                                <span className="text-[11px] text-slate-500">
                                  Save card securely as per RBI guidelines
                                </span>
                              </label>

                              <button
                                type="submit"
                                className="w-full mt-2 py-3 px-4 bg-[#5f259f] hover:bg-[#511e89] text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Lock className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Pay ₹{totalPayable.toFixed(2)}</span>
                              </button>
                            </form>
                          </div>

                          <div className="pt-2 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>100% Safe • 256-bit Bank Encryption</span>
                          </div>
                        </div>
                      )}

                      {/* --------------------------------------------------- */}
                      {/* TAB 3: Net Banking Form (Bank Selector)             */}
                      {/* --------------------------------------------------- */}
                      {activeTab === 'netbanking' && (
                        <div className="border border-slate-200 rounded-xl p-4 sm:p-5 bg-white shadow-2xs min-h-[360px] flex flex-col justify-between">
                          <div>
                            <h3 className="text-xs sm:text-sm font-bold text-slate-800 pb-2 border-b border-slate-100 mb-3">
                              Select your Bank
                            </h3>

                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                              Popular Banks
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                              {[
                                { id: 'SBI', name: 'SBI', full: 'State Bank of India', color: 'bg-[#004c8f]' },
                                { id: 'HDFC', name: 'HDFC Bank', full: 'HDFC Bank Ltd', color: 'bg-[#004b87]' },
                                { id: 'ICICI', name: 'ICICI Bank', full: 'ICICI Bank Ltd', color: 'bg-[#b02a30]' },
                                { id: 'AXIS', name: 'Axis Bank', full: 'Axis Bank Ltd', color: 'bg-[#97144d]' },
                                { id: 'KOTAK', name: 'Kotak Bank', full: 'Kotak Mahindra', color: 'bg-[#ea2027]' },
                                { id: 'PNB', name: 'PNB', full: 'Punjab National Bank', color: 'bg-[#990000]' },
                              ].map((bank) => (
                                <button
                                  key={bank.id}
                                  type="button"
                                  onClick={() => setSelectedBank(bank.id)}
                                  className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition text-center ${
                                    selectedBank === bank.id
                                      ? 'border-[#5f259f] bg-purple-50/80 ring-1 ring-[#5f259f]'
                                      : 'border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center ${bank.color}`}>
                                    {bank.id[0]}
                                  </div>
                                  <span className="text-xs font-bold text-slate-800">{bank.name}</span>
                                </button>
                              ))}
                            </div>

                            <div className="mt-3">
                              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                Or choose other bank
                              </label>
                              <select
                                value={selectedBank}
                                onChange={(e) => setSelectedBank(e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#5f259f] focus:border-[#5f259f] outline-none"
                              >
                                <option value="MRB">Mizoram Rural Bank (MRB)</option>
                                <option value="BOB">Bank of Baroda</option>
                                <option value="CANARA">Canara Bank</option>
                                <option value="UNION">Union Bank of India</option>
                                <option value="INDUSIND">IndusInd Bank</option>
                                <option value="YES">YES Bank</option>
                                <option value="FEDERAL">Federal Bank</option>
                                <option value="IDBI">IDBI Bank</option>
                                <option value="CENTRAL">Central Bank of India</option>
                                <option value="INDIAN">Indian Bank</option>
                              </select>
                            </div>

                            <button
                              type="button"
                              onClick={handlePayByNetBanking}
                              className="w-full mt-4 py-3 px-4 bg-[#5f259f] hover:bg-[#511e89] text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Building2 className="w-4 h-4 text-amber-300" />
                              <span>Pay ₹{totalPayable.toFixed(2)} via {selectedBank}</span>
                            </button>
                          </div>

                          <div className="pt-2 text-center text-[10px] text-slate-400">
                            You will be redirected to {selectedBank} NetBanking to authorize payment
                          </div>
                        </div>
                      )}

                    </div>

                  </div>

                </div>

                {/* Page Timeout Banner & Cancel Button at bottom */}
                <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline transition cursor-pointer"
                  >
                    Payment ti lovin kir leh rawh (Cancel & Close)
                  </button>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-[11px] font-semibold">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    <span>This page will timeout in {formatTimer(timeLeft)} mins</span>
                  </div>
                </div>

              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
};
