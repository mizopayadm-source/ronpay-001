import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, 
  QrCode, 
  CreditCard, 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  AlertCircle,
  ExternalLink,
  Smartphone,
  Lock,
  X,
  Copy,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, Campaign } from '../types';
import { recordUserPaidTxId, saveTransaction } from '../utils/storage';

interface PhonePeStandardCheckoutProps {
  onBack?: () => void;
  onSuccess?: (transaction: Transaction) => void;
  initialTxnId?: string;
  initialAmount?: number;
  initialBaseAmount?: number;
  initialFee?: number;
  campaign?: Campaign | null;
}

export const PhonePeStandardCheckout: React.FC<PhonePeStandardCheckoutProps> = ({
  onBack,
  onSuccess,
  initialTxnId,
  initialAmount,
  initialBaseAmount,
  initialFee,
  campaign
}) => {
  // Extract parameters from URL if available
  const queryParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const txnId = useMemo(() => {
    return initialTxnId || 
      queryParams.get('txnId') || 
      queryParams.get('merchantTransactionId') || 
      queryParams.get('receipt') || 
      queryParams.get('id') || 
      `RPAY_PHPE_${Date.now()}`;
  }, [initialTxnId, queryParams]);

  const totalAmount = useMemo(() => {
    if (initialAmount && initialAmount > 0) return initialAmount;
    const urlAmt = queryParams.get('amt') || queryParams.get('amount');
    if (urlAmt) {
      const parsed = parseFloat(urlAmt);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 505.00;
  }, [initialAmount, queryParams]);

  const baseAmount = useMemo(() => {
    if (initialBaseAmount && initialBaseAmount > 0) return initialBaseAmount;
    const urlBase = queryParams.get('baseAmt');
    if (urlBase) {
      const parsed = parseFloat(urlBase);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return Math.max(1, totalAmount - 5);
  }, [initialBaseAmount, queryParams, totalAmount]);

  const platformFee = useMemo(() => {
    if (initialFee !== undefined && initialFee >= 0) return initialFee;
    const urlFee = queryParams.get('fee');
    if (urlFee) {
      const parsed = parseFloat(urlFee);
      if (!isNaN(parsed)) return parsed;
    }
    return Math.max(0, totalAmount - baseAmount);
  }, [initialFee, queryParams, totalAmount, baseAmount]);

  const feeOption = queryParams.get('feeOpt') || 'ADD_ON';
  const campaignId = campaign?.id || queryParams.get('cid') || 'cmp-custom';
  const campaignTitle = campaign?.title || queryParams.get('ctitle') || 'RonPay Community Bawm';
  const donorName = queryParams.get('donor') || 'Valued Donor';
  const donorPhone = queryParams.get('donorPhone') || '';
  const isAnonymous = queryParams.get('anon') === '1' || queryParams.get('anon') === 'true';
  const category = (queryParams.get('cat') as any) || campaign?.category || 'others';

  // Environment detection: Android device or WebView
  const isAndroid = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const hasBridge = Boolean((window as any).RonPayBridge);
    return /Android/i.test(ua) || hasBridge || queryParams.get('mobile') === 'android';
  }, [queryParams]);

  // Workflow Stages for Android / Mobile App PhonePe PG:
  // 1. 'initial_loading': White screen with PhonePe logo "Please wait, processing your request" (Image 1)
  // 2. 'checkout': Clean payment selection page with NO preselected UPI apps (Image 2)
  // 3. 'pre_simulate_loading': White screen transition to simulation
  // 4. 'simulate_response': Official PhonePe "Simulate Payment Response" (Image 3)
  // 5. 'final_processing': White screen while generating receipt
  // 6. 'failure_view': Clean failure state if Failure was simulated
  type CheckoutStage = 
    | 'initial_loading'
    | 'checkout'
    | 'pre_simulate_loading'
    | 'simulate_response'
    | 'final_processing'
    | 'failure_view';

  const [stage, setStage] = useState<CheckoutStage>('initial_loading');
  const [simulatedStatus, setSimulatedStatus] = useState<'SUCCESS' | 'FAILURE' | 'SUBMITTED'>('SUCCESS');
  const [pendingPaymentMethodName, setPendingPaymentMethodName] = useState<string>('PhonePe Gateway');

  // Requirement 1: Show the white PhonePe processing screen briefly before revealing the checkout options
  useEffect(() => {
    const timer = setTimeout(() => {
      setStage('checkout');
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Payment states - Requirement 2: Nothing pre-selected, pull-down collapsed by default for a clean page
  const [selectedMethod, setSelectedMethod] = useState<'upi_app' | 'qr' | 'card' | 'netbanking' | null>(null);
  const [selectedUpiApp, setSelectedUpiApp] = useState<'phonepe' | 'gpay' | 'paytm' | 'bhim' | 'other' | null>(null);
  const [isQrExpanded, setIsQrExpanded] = useState<boolean>(false);
  const [isUpiAppsExpanded, setIsUpiAppsExpanded] = useState<boolean>(false);
  const [isCardModalOpen, setIsCardModalOpen] = useState<boolean>(false);
  const [isNetBankingModalOpen, setIsNetBankingModalOpen] = useState<boolean>(false);
  const [selectedBank, setSelectedBank] = useState<string>('SBI');
  const [isBreakupOpen, setIsBreakupOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('PhonePe Secure Gateway buatsaih mek a ni...');
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  // 5 Minutes countdown timer (matches PhonePe UAT: "This page will timeout in 04:17 mins")
  const [timeLeft, setTimeLeft] = useState<number>(298); // ~4 mins 58 secs

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Official Virtual Payment Address (VPA) for TSPMIZOPAYUAT
  const merchantVpa = 'mab060000049448@aubank';
  const merchantName = 'TSPMIZOPAYUAT';

  // Dynamic UPI URI
  const upiIntentUri = useMemo(() => {
    const encName = encodeURIComponent(merchantName);
    const note = encodeURIComponent(`RonPay ${txnId}`);
    return `upi://pay?pa=${merchantVpa}&pn=${encName}&am=${totalAmount.toFixed(2)}&tr=${txnId}&tn=${note}&cu=INR`;
  }, [merchantVpa, merchantName, totalAmount, txnId]);

  // Specific App Intent URIs
  const getAppUri = (app: 'phonepe' | 'gpay' | 'paytm' | 'bhim' | 'other' | null) => {
    const encName = encodeURIComponent(merchantName);
    const note = encodeURIComponent(`RonPay ${txnId}`);
    const params = `pa=${merchantVpa}&pn=${encName}&am=${totalAmount.toFixed(2)}&tr=${txnId}&tn=${note}&cu=INR`;
    switch (app) {
      case 'phonepe':
        return `phonepe://pay?${params}`;
      case 'gpay':
        return `tez://upi/pay?${params}`;
      case 'paytm':
        return `paytmmp://pay?${params}`;
      case 'bhim':
      case 'other':
      default:
        return `upi://pay?${params}`;
    }
  };

  // Complete Payment and redirect / trigger success
  const handleCompletePayment = async (methodUsed: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setProcessingMessage(`Connecting to ${methodUsed}... Authorizing via PhonePe...`);

    const utrNumber = 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000);

    const completedTx: Transaction = {
      id: txnId,
      campaignId,
      campaignTitle,
      category,
      donorName: isAnonymous ? 'Anonymous' : (donorName || 'Valued Donor'),
      donorPhone: isAnonymous ? undefined : (donorPhone || undefined),
      isAnonymous,
      amount: baseAmount,
      platformFee,
      feeOption: (feeOption as any) || 'ADD_ON',
      campaignNetReceived: baseAmount,
      totalAmount,
      paymentMethod: 'phonepe',
      status: 'completed',
      timestamp: new Date().toISOString(),
      referenceNo: `T${Date.now()}`,
      verifiedAt: new Date().toISOString(),
      utr: utrNumber
    };

    // 1. Notify server webhook simulation so status queries return PAYMENT_SUCCESS immediately
    try {
      await fetch('/api/phonepe/simulate-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantTransactionId: txnId,
          status: 'PAYMENT_SUCCESS',
          amountInRupees: totalAmount
        })
      });
    } catch (e) {
      console.warn('Simulate callback notify failed:', e);
    }

    // 2. Persist locally to storage
    try {
      saveTransaction(completedTx);
      recordUserPaidTxId(txnId);
      localStorage.setItem(`RONPAY_PENDING_TX_${txnId}`, JSON.stringify(completedTx));
      localStorage.setItem('RONPAY_LAST_CONFIRMED_TXN', JSON.stringify(completedTx));
    } catch (e) {
      console.warn('Local storage save failed:', e);
    }

    // 3. Broadcast to parent window or other tabs
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('ronpay_payment_channel');
        bc.postMessage({
          type: 'PHONEPE_PAYMENT_SUCCESS',
          merchantTransactionId: txnId,
          transaction: completedTx
        });
        bc.close();
      }
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'PHONEPE_PAYMENT_SUCCESS',
          merchantTransactionId: txnId,
          transaction: completedTx
        }, '*');
      }
    } catch (e) {}

    // 4. Brief delay to show realistic banking authorization then navigate
    setTimeout(() => {
      setProcessingMessage('Payment Authorized! Opening Receipt...');
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(completedTx);
        } else {
          // Direct navigation back to the official RonPay receipt screen
          const redirectUrl = `/?view=app&screen=success&receipt=${encodeURIComponent(txnId)}&phonepe_txn_id=${encodeURIComponent(txnId)}&status=PAYMENT_SUCCESS&amt=${totalAmount.toFixed(2)}&baseAmt=${baseAmount.toFixed(2)}&fee=${platformFee.toFixed(2)}&feeOpt=${encodeURIComponent(feeOption)}&cid=${encodeURIComponent(campaignId)}&ctitle=${encodeURIComponent(campaignTitle)}&cat=${encodeURIComponent(category)}&donor=${encodeURIComponent(donorName)}&donorPhone=${encodeURIComponent(donorPhone)}&anon=${isAnonymous ? '1' : '0'}&utr=${encodeURIComponent(utrNumber)}`;
          window.location.href = redirectUrl;
        }
      }, 700);
    }, 1200);
  };

  // Requirement 3: Trigger payment -> PhonePe white loading screen -> Simulate Payment Response page
  const handlePayClick = () => {
    let methodName = 'PhonePe Gateway';
    if (selectedMethod === 'upi_app' && selectedUpiApp) {
      const appNames: Record<string, string> = {
        phonepe: 'PhonePe UPI',
        gpay: 'Google Pay UPI',
        paytm: 'Paytm UPI',
        bhim: 'BHIM UPI',
        other: 'UPI App'
      };
      methodName = appNames[selectedUpiApp] || 'UPI App';

      // If Android, attempt intent launch smoothly
      if (isAndroid) {
        try {
          const appUri = getAppUri(selectedUpiApp);
          if ((window as any).RonPayBridge?.openInExternalBrowser) {
            (window as any).RonPayBridge.openInExternalBrowser(appUri);
          }
        } catch (e) {
          console.warn('Intent notice:', e);
        }
      }
    } else if (selectedMethod === 'qr') {
      methodName = 'UPI QR Scan';
    } else if (selectedMethod === 'card') {
      setIsCardModalOpen(true);
      return;
    } else if (selectedMethod === 'netbanking') {
      setIsNetBankingModalOpen(true);
      return;
    }

    setPendingPaymentMethodName(methodName);
    // Move to white loading screen (Image 1) then to Simulate Payment Response (Image 3)
    setStage('pre_simulate_loading');
    setTimeout(() => {
      setStage('simulate_response');
    }, 1100);
  };

  // Handle Submit button on Simulate Payment Response page
  const handleSubmitSimulatedResponse = () => {
    if (simulatedStatus === 'SUCCESS' || simulatedStatus === 'SUBMITTED') {
      setStage('final_processing');
      setTimeout(() => {
        handleCompletePayment(pendingPaymentMethodName);
      }, 1200);
    } else {
      // Simulate Failure
      setStage('final_processing');
      setTimeout(() => {
        setStage('failure_view');
      }, 1000);
    }
  };

  const handleCopyUpi = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(merchantVpa);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  // -------------------------------------------------------------
  // Requirement 1: White Loading Screen with PhonePe Logo (Image 1)
  // -------------------------------------------------------------
  if (stage === 'initial_loading' || stage === 'pre_simulate_loading' || stage === 'final_processing') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-between items-center px-6 py-12 max-w-lg mx-auto select-none">
        {/* Top spacer */}
        <div className="w-full h-8" />

        {/* Center Content */}
        <div className="flex flex-col items-center text-center">
          {/* PhonePe Purple Circle Logo with Devanagari Pe */}
          <div className="w-16 h-16 rounded-full bg-[#5f259f] text-white flex items-center justify-center shadow-xs mb-8">
            <span className="text-3xl font-black font-sans leading-none select-none tracking-tight">पे</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-normal text-slate-800 tracking-tight leading-snug">
            Please wait,<br />processing your request
          </h2>

          {/* Purple curved arc spinner */}
          <div className="mt-8">
            <div className="w-6 h-6 border-2 border-[#5f259f] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>

        {/* Bottom Notice */}
        <div className="text-center px-4 pb-4">
          <p className="text-xs text-slate-400 font-normal leading-relaxed">
            Please don't hit the back button until the action is complete.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Requirement 3: PhonePe Simulate Payment Response Screen (Image 3)
  // -------------------------------------------------------------
  if (stage === 'simulate_response') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center px-6 py-12 max-w-sm mx-auto select-none">
        {/* PhonePe Purple Logo */}
        <div className="w-14 h-14 rounded-full bg-[#5f259f] text-white flex items-center justify-center shadow-xs mx-auto mb-4">
          <span className="text-2xl font-black font-sans leading-none select-none tracking-tight">पे</span>
        </div>

        {/* Header */}
        <h1 className="text-2xl font-bold text-slate-900 text-center tracking-tight">
          Simulate Payment Response
        </h1>
        <p className="text-xs text-slate-400 text-center mt-1 mb-8">
          Select a status to continue...
        </p>

        {/* Status Choices */}
        <div className="space-y-3 w-full">
          {/* Success Choice */}
          <button
            type="button"
            onClick={() => setSimulatedStatus('SUCCESS')}
            className={`w-full py-3.5 px-4 rounded-md text-sm font-bold text-white transition-all cursor-pointer text-center bg-[#22c55e] hover:bg-[#16a34a] shadow-xs ${
              simulatedStatus === 'SUCCESS' ? 'border-2 border-slate-950 ring-1 ring-slate-950 scale-[1.01]' : 'border-2 border-transparent'
            }`}
          >
            Success
          </button>

          {/* Failure Choice */}
          <button
            type="button"
            onClick={() => setSimulatedStatus('FAILURE')}
            className={`w-full py-3.5 px-4 rounded-md text-sm font-bold text-white transition-all cursor-pointer text-center bg-[#ef4444] hover:bg-[#dc2626] shadow-xs flex items-center justify-center gap-1 ${
              simulatedStatus === 'FAILURE' ? 'border-2 border-slate-950 ring-1 ring-slate-950 scale-[1.01]' : 'border-2 border-transparent'
            }`}
          >
            <span>Failure</span>
            <span className="text-xs">▸</span>
          </button>

          {/* Submitted Choice */}
          <button
            type="button"
            onClick={() => setSimulatedStatus('SUBMITTED')}
            className={`w-full py-2.5 px-4 rounded-md text-sm font-bold text-white transition-all cursor-pointer text-center bg-[#9ca3af] hover:bg-[#6b7280] shadow-xs ${
              simulatedStatus === 'SUBMITTED' ? 'border-2 border-slate-950 ring-1 ring-slate-950 scale-[1.01]' : 'border-2 border-transparent'
            }`}
          >
            <div>Submitted</div>
            <div className="text-[10px] text-slate-100 font-normal">Only for Corp NetBanking</div>
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmitSimulatedResponse}
          className="w-full mt-7 py-3.5 px-4 rounded-md bg-[#5f259f] hover:bg-[#521d8b] text-white font-bold text-base transition shadow-md cursor-pointer active:scale-[0.99] text-center"
        >
          Submit
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Simulated Failure Screen
  // -------------------------------------------------------------
  if (stage === 'failure_view') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center items-center px-6 py-12 max-w-sm mx-auto text-center select-none">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Payment Failed</h2>
        <p className="text-xs text-slate-500 mb-6">
          PhonePe PG received simulated failure response. No amount was deducted.
        </p>
        <button
          type="button"
          onClick={() => setStage('checkout')}
          className="w-full py-3.5 rounded-xl bg-[#5f259f] hover:bg-[#511e89] text-white font-bold text-sm cursor-pointer shadow-md active:scale-98 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Requirement 2: Clean Payment Options Screen
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-900 font-sans flex flex-col justify-between max-w-lg mx-auto shadow-xl relative select-none">
      
      {/* Top Header matching PhonePe PG V2 UAT */}
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                window.location.href = '/?view=app&screen=checkout';
              }
            }}
            className="p-1.5 -ml-1.5 rounded-full hover:bg-slate-100 text-slate-700 cursor-pointer transition active:scale-95"
            title="Go back"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              {merchantName}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Merchant Verified • PhonePe PG
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-lg font-black text-slate-900 tracking-tight font-mono">
            ₹{totalAmount.toFixed(2)}
          </span>
        </div>
      </header>

      {/* Main Body Content */}
      <main className="flex-1 p-4 space-y-4 pb-28">
        
        {/* UPI Payment Section */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5f259f]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                UPI Payment
              </h2>
            </div>
            <span className="text-[10px] text-[#5f259f] font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              Instant
            </span>
          </div>

          <div className="p-3.5 space-y-3">
            <p className="text-xs text-slate-600">
              Take a screenshot or scan with another device
            </p>

            {/* Click here to view QR Toggle */}
            <button
              type="button"
              onClick={() => setIsQrExpanded(!isQrExpanded)}
              className="w-full p-3 rounded-xl border border-slate-200 hover:border-purple-300 bg-slate-50/60 hover:bg-purple-50/30 transition flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#5f259f] flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900 group-hover:text-[#5f259f] transition">
                    Click here to view QR
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Scan using any UPI App (GPay, PhonePe, Paytm)
                  </p>
                </div>
              </div>
              {isQrExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {/* Expanded QR Code Display */}
            <AnimatePresence>
              {isQrExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 bg-purple-50/40 rounded-xl border border-purple-100 flex flex-col items-center justify-center space-y-3">
                    <div className="p-2.5 bg-white rounded-xl shadow-xs border border-slate-200">
                      <QRCodeSVG 
                        value={upiIntentUri} 
                        size={170} 
                        level="M" 
                        includeMargin={false} 
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] font-bold text-slate-800">
                        Scan & Pay ₹{totalAmount.toFixed(2)}
                      </p>
                      <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] text-slate-500">
                        <span className="font-mono">{merchantVpa}</span>
                        <button
                          type="button"
                          onClick={handleCopyUpi}
                          className="p-1 text-purple-700 hover:text-purple-900 cursor-pointer"
                          title="Copy UPI VPA"
                        >
                          {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* SELECTABLE UPI APPS - PULL DOWN FOR MOBILE / ANDROID */}
            <div className="pt-2 border-t border-slate-100">
              {/* Pull Down Toggle Bar */}
              <button
                type="button"
                onClick={() => setIsUpiAppsExpanded(!isUpiAppsExpanded)}
                className="w-full p-3 rounded-xl border border-slate-200 hover:border-purple-300 bg-slate-50/60 hover:bg-purple-50/30 transition flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#5f259f] flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-[#5f259f] transition">
                        UPI Apps (Pull Down)
                      </p>
                      {isAndroid && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                          Android
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {selectedUpiApp
                        ? `Selected: ${selectedUpiApp === 'phonepe' ? 'PhonePe' : selectedUpiApp === 'gpay' ? 'Google Pay' : selectedUpiApp === 'paytm' ? 'Paytm' : selectedUpiApp === 'bhim' ? 'BHIM UPI' : 'Other UPI'}`
                        : 'Tap to select an app (PhonePe, GPay, Paytm, etc.)'}
                    </p>
                  </div>
                </div>
                {isUpiAppsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#5f259f]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {/* Expandable Pull Down Content */}
              <AnimatePresence>
                {isUpiAppsExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-2">
                      {/* Pull-down Quick Select Menu */}
                      <div className="flex items-center gap-2 bg-purple-50/60 p-2 rounded-xl border border-purple-100 mb-2">
                        <label htmlFor="upi-app-pulldown-select" className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                          UPI App Thlanna:
                        </label>
                        <select
                          id="upi-app-pulldown-select"
                          value={selectedUpiApp || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              setSelectedMethod('upi_app');
                              setSelectedUpiApp(e.target.value as any);
                            } else {
                              setSelectedUpiApp(null);
                            }
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5f259f] cursor-pointer"
                        >
                          <option value="">-- UPI App Thlang Rawh --</option>
                          <option value="phonepe">PhonePe</option>
                          <option value="gpay">Google Pay (GPay)</option>
                          <option value="paytm">Paytm UPI</option>
                          <option value="bhim">BHIM UPI</option>
                          <option value="other">Other UPI Apps</option>
                        </select>
                      </div>

                      {/* 1. PhonePe */}
                      <div
                        onClick={() => {
                          setSelectedMethod('upi_app');
                          setSelectedUpiApp('phonepe');
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'phonepe'
                            ? 'border-[#5f259f] bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#5f259f] text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
                            Pe
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-tight flex items-center gap-1.5">
                              <span>PhonePe</span>
                              <span className="text-[9px] font-bold text-[#5f259f] bg-purple-100/70 px-1.5 py-0.2 rounded">
                                Recommended
                              </span>
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Direct PhonePe Intent
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'phonepe'
                            ? 'border-[#5f259f] bg-[#5f259f]'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {selectedMethod === 'upi_app' && selectedUpiApp === 'phonepe' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* 2. Google Pay (GPay) */}
                      <div
                        onClick={() => {
                          setSelectedMethod('upi_app');
                          setSelectedUpiApp('gpay');
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'gpay'
                            ? 'border-[#5f259f] bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-sm shadow-2xs shrink-0">
                            <span className="text-blue-600">G</span>
                            <span className="text-red-500">P</span>
                            <span className="text-amber-500">a</span>
                            <span className="text-emerald-600">y</span>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-tight">
                              Google Pay
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Fast & Secure UPI
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'gpay'
                            ? 'border-[#5f259f] bg-[#5f259f]'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {selectedMethod === 'upi_app' && selectedUpiApp === 'gpay' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* 3. Paytm */}
                      <div
                        onClick={() => {
                          setSelectedMethod('upi_app');
                          setSelectedUpiApp('paytm');
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'paytm'
                            ? 'border-[#5f259f] bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#002e6e] text-[#00b9f5] flex items-center justify-center font-black text-[11px] shadow-2xs shrink-0">
                            Paytm
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-tight">
                              Paytm
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Paytm UPI
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'paytm'
                            ? 'border-[#5f259f] bg-[#5f259f]'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {selectedMethod === 'upi_app' && selectedUpiApp === 'paytm' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* 4. BHIM UPI */}
                      <div
                        onClick={() => {
                          setSelectedMethod('upi_app');
                          setSelectedUpiApp('bhim');
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'bhim'
                            ? 'border-[#5f259f] bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00796b] to-[#ff9800] text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                            BHIM
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-tight">
                              BHIM UPI
                            </p>
                            <p className="text-[10px] text-slate-500">
                              NPCI National Payments
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'bhim'
                            ? 'border-[#5f259f] bg-[#5f259f]'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {selectedMethod === 'upi_app' && selectedUpiApp === 'bhim' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>

                      {/* 5. Other UPI Apps */}
                      <div
                        onClick={() => {
                          setSelectedMethod('upi_app');
                          setSelectedUpiApp('other');
                        }}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'other'
                            ? 'border-[#5f259f] bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs'
                            : 'border-slate-200 hover:border-purple-200 bg-white hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                            UPI
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 leading-tight">
                              Other UPI Apps
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Cred, Amazon Pay, Any UPI App
                            </p>
                          </div>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedMethod === 'upi_app' && selectedUpiApp === 'other'
                            ? 'border-[#5f259f] bg-[#5f259f]'
                            : 'border-slate-300 bg-white'
                        }`}>
                          {selectedMethod === 'upi_app' && selectedUpiApp === 'other' && (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </section>

        {/* Other Methods Section (Debit/Credit Card & Net Banking) */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider px-1">
            Other Methods
          </h2>

          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 overflow-hidden">
            
            {/* Debit/Credit Card */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod('card');
                setIsCardModalOpen(true);
              }}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Debit/Credit Card
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Visa, MasterCard, RuPay, Maestro
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

            {/* Net Banking */}
            <button
              type="button"
              onClick={() => {
                setSelectedMethod('netbanking');
                setIsNetBankingModalOpen(true);
              }}
              className="w-full p-3.5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Net Banking
                  </p>
                  <p className="text-[10px] text-slate-500">
                    All Major Indian Banks Supported
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>

          </div>
        </section>

        {/* Security & Powered by PhonePe Badge */}
        <div className="flex items-center justify-center gap-2 pt-2 text-slate-400 text-xs">
          <ShieldCheck className="w-4 h-4 text-[#5f259f]" />
          <span className="font-semibold text-slate-500">Powered by</span>
          <span className="font-black text-[#5f259f] tracking-tight">PhonePe</span>
          <span className="text-[10px] text-slate-400">• 256-bit SSL Encrypted</span>
        </div>

      </main>

      {/* Sticky Bottom Action Bar matching PhonePe PG */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-slate-200/90 p-4 z-30 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          
          {/* Amount & View Breakup */}
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900 tracking-tight font-mono">
                ₹{totalAmount.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsBreakupOpen(true)}
              className="text-[11px] font-bold text-[#5f259f] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              <span>View Breakup</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Big Purple Pay Button */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={handlePayClick}
            className="px-8 py-3 rounded-full bg-[#5f259f] hover:bg-[#511e89] active:scale-[0.98] text-white font-black text-sm sm:text-base shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Pay</span>
            )}
          </button>
        </div>

        {/* Live Countdown Timeout Notice */}
        <div className="mt-2 text-center flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>This page will timeout in <strong className="font-mono text-slate-700">{formatTimer(timeLeft)} mins</strong></span>
        </div>
      </footer>

      {/* MODAL: View Breakup */}
      <AnimatePresence>
        {isBreakupOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-sm text-slate-900">
                  Payment Summary Breakup
                </h3>
                <button
                  type="button"
                  onClick={() => setIsBreakupOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Donation / Base Amount:</span>
                  <span className="font-mono font-bold text-slate-900">₹{baseAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>RonPay Gateway Platform Fee (1%):</span>
                  <span className="font-mono font-bold text-emerald-600">₹{platformFee.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-black text-slate-900">
                  <span>Grand Total (Total Payable):</span>
                  <span className="font-mono text-[#5f259f]">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl">
                Payment processed securely via PhonePe PG (TSPMIZOPAYUAT) with immediate reconciliation and digital receipt.
              </p>

              <button
                type="button"
                onClick={() => setIsBreakupOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Close Breakup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Debit/Credit Card Simulation */}
      <AnimatePresence>
        {isCardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Debit / Credit Card Payment
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Card Number
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="4111 2222 3333 4444 (Test Card)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Expiry
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="12/28"
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      CVV
                    </label>
                    <input
                      type="text"
                      readOnly
                      value="•••"
                      className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 bg-blue-50/70 p-2.5 rounded-xl border border-blue-100">
                  PhonePe Sandbox Card Simulator: Clicking Pay will authorize payment and issue your instant receipt.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setIsCardModalOpen(false);
                    setPendingPaymentMethodName('Debit/Credit Card');
                    setStage('pre_simulate_loading');
                    setTimeout(() => {
                      setStage('simulate_response');
                    }, 1000);
                  }}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs cursor-pointer shadow-md transition"
                >
                  Pay ₹{totalAmount.toFixed(2)} with Card
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Net Banking Simulation */}
      <AnimatePresence>
        {isNetBankingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Net Banking Bank Selection
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNetBankingModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Select Your Bank:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['SBI', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'PNB', 'Canara Bank'].map(bank => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer ${
                        selectedBank === bank
                          ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {bank}
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-slate-500 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                  Selected: <strong>{selectedBank}</strong>. Clicking Pay will simulate Net Banking authorization and record your payment.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setIsNetBankingModalOpen(false);
                    setPendingPaymentMethodName(`Net Banking (${selectedBank})`);
                    setStage('pre_simulate_loading');
                    setTimeout(() => {
                      setStage('simulate_response');
                    }, 1000);
                  }}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer shadow-md transition"
                >
                  Pay ₹{totalAmount.toFixed(2)} via Net Banking
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL-SCREEN PROCESSING OVERLAY */}
      <AnimatePresence>
        {isProcessing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-slate-100"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-50 text-[#5f259f] flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border-4 border-[#5f259f] border-t-transparent animate-spin" />
                <Lock className="w-6 h-6 text-[#5f259f]" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  PhonePe Payment Gateway
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {processingMessage}
                </p>
              </div>
              <div className="bg-purple-50/80 p-3 rounded-xl text-left text-[11px] space-y-1 text-purple-950 font-medium border border-purple-100">
                <p>• Merchant: <strong>{merchantName}</strong></p>
                <p>• Amount: <strong>₹{totalAmount.toFixed(2)}</strong></p>
                <p>• Status: <strong>Authorizing Bank Transaction...</strong></p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
