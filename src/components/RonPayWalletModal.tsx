import React, { useState, useEffect } from 'react';
import { 
  X, 
  Wallet, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Building2, 
  QrCode, 
  CheckCircle2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Printer, 
  ArrowRight,
  TrendingUp,
  CreditCard,
  Smartphone,
  ChevronRight,
  AlertCircle,
  History,
  Lock
} from 'lucide-react';
import { RonPayWallet, WalletTransaction, CreatorProfile, Campaign } from '../types';
import { getStoredWallet, saveStoredWallet } from '../utils/storage';
import { formatDateTimeDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';

interface RonPayWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile;
  campaigns?: Campaign[];
  onStartScanner?: () => void;
  onOpenBankTransfer?: () => void;
  onOpenHistory?: () => void;
  language?: 'mizo' | 'english';
}

export const RonPayWalletModal: React.FC<RonPayWalletModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  campaigns = [],
  onStartScanner,
  onOpenBankTransfer,
  onOpenHistory,
  language = 'mizo',
}) => {
  const [wallet, setWallet] = useState<RonPayWallet>(() => getStoredWallet());
  const [activeTab, setActiveTab] = useState<'overview' | 'topup' | 'settle' | 'statement'>('overview');
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);
  const [copiedHandle, setCopiedHandle] = useState<boolean>(false);

  // Top Up State
  const [topUpAmount, setTopUpAmount] = useState<number | ''>(500);
  const [topUpMethod, setTopUpMethod] = useState<'gpay' | 'phonepe' | 'paytm' | 'card' | 'netbanking'>('gpay');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState<boolean>(false);
  const [topUpSuccessTx, setTopUpSuccessTx] = useState<WalletTransaction | null>(null);

  // Settle to Bank State
  const [settleAmount, setSettleAmount] = useState<number | ''>(wallet.balance > 0 ? wallet.balance : 500);
  const [settleBankName, setSettleBankName] = useState<string>(
    wallet.linkedBankName || 'State Bank of India (Aizawl Main)'
  );
  const [settleAccountNo, setSettleAccountNo] = useState<string>(
    wallet.linkedAccountLast4 ? `XXXX-XXXX-${wallet.linkedAccountLast4}` : '3928104589'
  );
  const [settleIfsc, setSettleIfsc] = useState<string>('SBIN0001234');
  const [isProcessingSettle, setIsProcessingSettle] = useState<boolean>(false);
  const [settleSuccessTx, setSettleSuccessTx] = useState<WalletTransaction | null>(null);
  const [settleError, setSettleError] = useState<string>('');

  // Statement filter
  const [statementFilter, setStatementFilter] = useState<'all' | 'credit' | 'debit'>('all');

  useEffect(() => {
    if (isOpen) {
      const freshWallet = getStoredWallet();
      // Update UPI handle if creator has phone
      if (creatorProfile?.phone && (!freshWallet.walletId || freshWallet.walletId === 'WAL-9436001234')) {
        const cleanPhone = creatorProfile.phone.replace(/\D/g, '');
        freshWallet.walletId = `WAL-${cleanPhone.slice(-10)}`;
        freshWallet.upiHandle = `ronpay.${cleanPhone.slice(-10)}@yesbank`;
        if (creatorProfile.upiId) {
          freshWallet.linkedUpiId = creatorProfile.upiId;
        }
        saveStoredWallet(freshWallet);
      }
      setWallet(freshWallet);
      setSettleAmount(freshWallet.balance > 0 ? freshWallet.balance : 500);
      setTopUpSuccessTx(null);
      setSettleSuccessTx(null);
    }
  }, [isOpen, creatorProfile]);

  if (!isOpen) return null;

  const handleCopyUPI = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(wallet.upiHandle);
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    }
  };

  // Execute Top Up
  const handleExecuteTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(topUpAmount);
    if (!numAmount || numAmount < 10) {
      alert('Khawngaihin amount dik chhu lut rawh le (Minimum ₹10).');
      return;
    }

    setIsProcessingTopUp(true);

    setTimeout(() => {
      const newBal = wallet.balance + numAmount;
      const tx: WalletTransaction = {
        id: `WTX-${Date.now().toString().slice(-6)}`,
        type: 'credit',
        title: `Wallet Top-up (${topUpMethod.toUpperCase()})`,
        amount: numAmount,
        status: 'completed',
        source: topUpMethod === 'card' ? 'card_topup' : 'upi_topup',
        timestamp: new Date().toISOString(),
        utrRef: `UPI/${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        remark: `Added funds to RonPay Wallet via ${topUpMethod.toUpperCase()}`,
        balanceAfter: newBal
      };

      const updatedWallet: RonPayWallet = {
        ...wallet,
        balance: newBal,
        totalCredited: wallet.totalCredited + numAmount,
        history: [tx, ...wallet.history]
      };

      saveStoredWallet(updatedWallet);
      setWallet(updatedWallet);
      setIsProcessingTopUp(false);
      setTopUpSuccessTx(tx);
    }, 1000);
  };

  // Execute Bank Settlement
  const handleExecuteSettle = (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError('');
    const numAmount = Number(settleAmount);
    if (!numAmount || numAmount < 50) {
      setSettleError('Minimum settlement amount chu ₹50 a ni e.');
      return;
    }
    if (numAmount > wallet.balance) {
      setSettleError(`I Wallet Balance (₹${wallet.balance.toLocaleString('en-IN')}) aia tam i transfer thei lo.`);
      return;
    }

    setIsProcessingSettle(true);

    setTimeout(() => {
      const newBal = wallet.balance - numAmount;
      const tx: WalletTransaction = {
        id: `WTX-${Date.now().toString().slice(-6)}`,
        type: 'debit',
        title: `Bank Settlement (IMPS Payout)`,
        amount: numAmount,
        status: 'completed',
        source: 'bank_withdrawal',
        timestamp: new Date().toISOString(),
        utrRef: `IMPS/RON/${Math.floor(100000000 + Math.random() * 900000000)}`,
        remark: `Transferred to ${settleBankName} (${settleAccountNo.slice(-4)})`,
        balanceAfter: newBal
      };

      const updatedWallet: RonPayWallet = {
        ...wallet,
        balance: newBal,
        totalWithdrawn: wallet.totalWithdrawn + numAmount,
        history: [tx, ...wallet.history]
      };

      saveStoredWallet(updatedWallet);
      setWallet(updatedWallet);
      setIsProcessingSettle(false);
      setSettleSuccessTx(tx);
    }, 1200);
  };

  // Filtered Statement
  const filteredHistory = wallet.history.filter(item => {
    if (statementFilter === 'credit') return item.type === 'credit';
    if (statementFilter === 'debit') return item.type === 'debit';
    return true;
  });

  const handlePrintStatement = () => {
    const rows = filteredHistory.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          ${formatDateTimeDDMMYYYY(item.timestamp)}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <b>${item.title}</b><br/>
          <span style="color: #64748b; font-size: 10px;">Ref: ${item.utrRef || item.id}</span>
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold; color: ${item.type === 'credit' ? '#16a34a' : '#dc2626'};">
          ${item.type === 'credit' ? '+' : '-'}₹${item.amount.toLocaleString('en-IN')}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-weight: bold;">
          ₹${(item.balanceAfter ?? wallet.balance).toLocaleString('en-IN')}
        </td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: system-ui, sans-serif; padding: 24px; color: #0f172a;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px;">
          <h1 style="margin: 0; font-size: 20px; text-transform: uppercase;">RonPay Digital Wallet Statement</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">Mizoram Community Digital Pay • Wallet ID: ${wallet.walletId}</p>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748b;">Generated on: ${formatDateTimeDDMMYYYY(new Date())}</p>
        </div>

        <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 12px;">
          <div>
            <div><b>Account Holder:</b> ${creatorProfile?.name || 'RonPay Verified User'}</div>
            <div><b>VPA / Handle:</b> ${wallet.upiHandle}</div>
          </div>
          <div style="text-align: right;">
            <div><b>Current Available Balance:</b> <span style="font-size: 15px; color: #0f172a; font-weight: 900;">₹${wallet.balance.toLocaleString('en-IN')}</span></div>
            <div><b>Status:</b> Active & KYC Verified</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 11px;">Date & Time</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 11px;">Description / UTR</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-align: right;">Amount (₹)</th>
              <th style="padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 11px; text-align: right;">Balance After</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" style="text-align:center; padding: 20px;">No wallet transactions recorded.</td></tr>'}
          </tbody>
        </table>

        <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center;">
          This is a computer-generated RonPay Digital Wallet Statement. RonPay Community Network, Mizoram.
        </div>
      </div>
    `;

    printHtmlSafely(html);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col text-slate-900 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-md border border-indigo-400/40">
              <Wallet className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  RonPay Wallet
                </h2>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  ● ACTIVE
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                Mizoram Community Digital Wallet & Balance Hub
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1 shrink-0 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Balance</span>
          </button>
          <button
            onClick={() => setActiveTab('topup')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'topup'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Add Money</span>
          </button>
          <button
            onClick={() => setActiveTab('settle')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'settle'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-blue-600" />
            <span>To Bank</span>
          </button>
          <button
            onClick={() => setActiveTab('statement')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'statement'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <History className="w-3.5 h-3.5 text-slate-600" />
            <span>Statement</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Virtual Digital Wallet Card */}
              <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 shadow-xl border border-indigo-800/60 relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  <Wallet className="w-24 h-24" />
                </div>

                <div className="flex justify-between items-start mb-3 relative z-10">
                  <div>
                    <span className="text-[10px] uppercase tracking-widest font-extrabold text-indigo-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" /> Available RonPay Balance
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {isBalanceHidden ? '₹ • • • • •' : `₹${wallet.balance.toLocaleString('en-IN')}`}
                      </span>
                      <button
                        onClick={() => setIsBalanceHidden(!isBalanceHidden)}
                        className="text-indigo-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                        title={isBalanceHidden ? "Show Balance" : "Hide Balance"}
                      >
                        {isBalanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1 shadow-xs">
                    <ShieldCheck className="w-3 h-3" /> VERIFIED
                  </span>
                </div>

                {/* Virtual UPI Handle */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/15 flex items-center justify-between gap-2 mt-4 relative z-10">
                  <div className="min-w-0">
                    <span className="text-[9px] text-indigo-200 font-bold block uppercase tracking-wider">
                      Wallet VPA / UPI ID
                    </span>
                    <span className="font-mono text-xs font-black text-amber-300 truncate block">
                      {wallet.upiHandle}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyUPI}
                    className="bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] px-2.5 py-1 rounded-xl transition flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedHandle ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Wallet Info Meta */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10 text-left text-[11px] relative z-10">
                  <div>
                    <span className="text-indigo-300 block text-[9px] uppercase font-bold">Holder</span>
                    <span className="font-bold text-white truncate block">
                      {creatorProfile?.name || 'RonPay Community User'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-indigo-300 block text-[9px] uppercase font-bold">Linked Bank</span>
                    <span className="font-bold text-slate-200 truncate block">
                      {wallet.linkedBankName || 'State Bank of India'} (••{wallet.linkedAccountLast4 || '4589'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Matrix Inside Wallet */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setActiveTab('topup')}
                  className="bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200 p-3 rounded-2xl flex flex-col items-center justify-center text-center transition group cursor-pointer shadow-xs active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-emerald-950">Add Money</span>
                  <span className="text-[9.5px] text-emerald-700 font-medium">Instant UPI</span>
                </button>

                <button
                  onClick={() => setActiveTab('settle')}
                  className="bg-blue-50 hover:bg-blue-100/90 border border-blue-200 p-3 rounded-2xl flex flex-col items-center justify-center text-center transition group cursor-pointer shadow-xs active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-blue-950">To Bank</span>
                  <span className="text-[9.5px] text-blue-700 font-medium">Instant IMPS</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    if (onStartScanner) onStartScanner();
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200 p-3 rounded-2xl flex flex-col items-center justify-center text-center transition group cursor-pointer shadow-xs active:scale-95"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-1.5 shadow-xs group-hover:scale-105 transition-transform">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black text-indigo-950">Scan & Pay</span>
                  <span className="text-[9.5px] text-indigo-700 font-medium">Any QR</span>
                </button>
              </div>

              {/* Wallet Summary Stats */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Credited</span>
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      ₹{wallet.totalCredited.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Settled to Bank</span>
                    <span className="text-xs sm:text-sm font-black text-slate-900">
                      ₹{wallet.totalWithdrawn.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Snapshot */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
                <div className="flex justify-between items-center mb-2.5">
                  <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-indigo-600" /> Recent Wallet Activity
                  </h3>
                  <button
                    onClick={() => setActiveTab('statement')}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {wallet.history.slice(0, 3).map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          item.type === 'credit' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {item.type === 'credit' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(item.timestamp)}</p>
                        </div>
                      </div>
                      <span className={`font-black shrink-0 ${
                        item.type === 'credit' ? 'text-emerald-600' : 'text-slate-900'
                      }`}>
                        {item.type === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ADD MONEY (TOP UP) */}
          {activeTab === 'topup' && (
            <div className="space-y-4 animate-fadeIn">
              {topUpSuccessTx ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center space-y-3">
                  <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-black text-emerald-950">Top-Up Successful!</h3>
                  <p className="text-xs text-emerald-800">
                    ₹{topUpSuccessTx.amount.toLocaleString('en-IN')} chu i RonPay Wallet-ah hlawhtling takin a lut fel e.
                  </p>
                  <div className="bg-white p-3 rounded-2xl border border-emerald-100 text-left text-xs space-y-1">
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>UTR / Reference:</span>
                      <span className="font-mono font-bold text-slate-800">{topUpSuccessTx.utrRef}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>New Wallet Balance:</span>
                      <span className="font-black text-emerald-700 text-sm">₹{wallet.balance.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setTopUpSuccessTx(null)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-xs"
                    >
                      Add More Funds
                    </button>
                    <button
                      onClick={() => setActiveTab('overview')}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-xs border border-slate-200 cursor-pointer shadow-xs"
                    >
                      Back to Balance
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleExecuteTopUp} className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
                    <label className="text-xs font-black text-slate-700 block mb-1.5">
                      Top-Up Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-black text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="10"
                        max="100000"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="500"
                        className="w-full pl-8 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    {/* Quick Amount Pills */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {[100, 200, 500, 1000, 2000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTopUpAmount(amt)}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            topUpAmount === amt
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          +₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Payment Gateway Options */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 block">
                      Select Payment Source
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setTopUpMethod('gpay')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                          topUpMethod === 'gpay'
                            ? 'bg-indigo-50 border-indigo-600 text-indigo-950 font-black ring-1 ring-indigo-600'
                            : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-indigo-600 shrink-0" />
                        <div>
                          <div className="text-xs">Google Pay</div>
                          <div className="text-[9.5px] text-slate-500 font-normal">UPI Direct</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTopUpMethod('phonepe')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                          topUpMethod === 'phonepe'
                            ? 'bg-purple-50 border-purple-600 text-purple-950 font-black ring-1 ring-purple-600'
                            : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-purple-600 shrink-0" />
                        <div>
                          <div className="text-xs">PhonePe UPI</div>
                          <div className="text-[9.5px] text-slate-500 font-normal">Instant Top-up</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTopUpMethod('paytm')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                          topUpMethod === 'paytm'
                            ? 'bg-sky-50 border-sky-600 text-sky-950 font-black ring-1 ring-sky-600'
                            : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                        }`}
                      >
                        <Smartphone className="w-5 h-5 text-sky-600 shrink-0" />
                        <div>
                          <div className="text-xs">Paytm / UPI</div>
                          <div className="text-[9.5px] text-slate-500 font-normal">Fast Checkout</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTopUpMethod('card')}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                          topUpMethod === 'card'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-black ring-1 ring-emerald-600'
                            : 'bg-white border-slate-200 text-slate-700 font-bold hover:bg-slate-50'
                        }`}
                      >
                        <CreditCard className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-xs">Debit / ATM Card</div>
                          <div className="text-[9.5px] text-slate-500 font-normal">RuPay / Visa</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingTopUp}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isProcessingTopUp ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing Instant Top-Up...
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" /> Add ₹{Number(topUpAmount || 0).toLocaleString('en-IN')} to Wallet
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: SETTLE TO BANK */}
          {activeTab === 'settle' && (
            <div className="space-y-4 animate-fadeIn">
              {settleSuccessTx ? (
                <div className="bg-blue-50 border border-blue-200 rounded-3xl p-5 text-center space-y-3">
                  <div className="w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md animate-bounce">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-black text-blue-950">Bank Transfer Successful!</h3>
                  <p className="text-xs text-blue-800">
                    ₹{settleSuccessTx.amount.toLocaleString('en-IN')} chu i Bank Account-ah IMPS hmangin thawn fel nghal a ni e.
                  </p>
                  <div className="bg-white p-3 rounded-2xl border border-blue-100 text-left text-xs space-y-1">
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>IMPS Reference:</span>
                      <span className="font-mono font-bold text-slate-800">{settleSuccessTx.utrRef}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Bank & Account:</span>
                      <span className="font-bold text-slate-800">{settleBankName} ({settleAccountNo.slice(-4)})</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Remaining Balance:</span>
                      <span className="font-black text-blue-700 text-sm">₹{wallet.balance.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setSettleSuccessTx(null)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-xs"
                    >
                      Make Another Transfer
                    </button>
                    <button
                      onClick={() => setActiveTab('overview')}
                      className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-xs border border-slate-200 cursor-pointer shadow-xs"
                    >
                      Back to Balance
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleExecuteSettle} className="space-y-4">
                  {/* Balance Notice */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-3 rounded-2xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-blue-800 font-bold uppercase block">Current Balance</span>
                      <span className="text-base font-black text-blue-950">₹{wallet.balance.toLocaleString('en-IN')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettleAmount(wallet.balance)}
                      className="bg-blue-600 text-white text-[10.5px] font-bold px-2.5 py-1 rounded-xl hover:bg-blue-700 transition cursor-pointer"
                    >
                      Transfer All
                    </button>
                  </div>

                  {settleError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{settleError}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-black text-slate-700 block mb-1">
                        Transfer Amount (₹)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max={wallet.balance || 100000}
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="500"
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-700 block mb-1">
                        Bank Name
                      </label>
                      <input
                        type="text"
                        value={settleBankName}
                        onChange={(e) => setSettleBankName(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-black text-slate-700 block mb-1">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={settleAccountNo}
                          onChange={(e) => setSettleAccountNo(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-slate-700 block mb-1">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={settleIfsc}
                          onChange={(e) => setSettleIfsc(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>Payout Fee:</span>
                    <span className="font-black text-emerald-600">₹0.00 (FREE COMMUNITY PAYOUT)</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingSettle || wallet.balance <= 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-3 rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    {isProcessingSettle ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing IMPS Settlement...
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" /> Transfer ₹{Number(settleAmount || 0).toLocaleString('en-IN')} to Bank
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 4: STATEMENT / PASSBOOK */}
          {activeTab === 'statement' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between gap-2">
                {/* Filter Pills */}
                <div className="flex bg-slate-100 p-1 rounded-xl text-[10.5px] font-bold text-slate-600 gap-1">
                  <button
                    onClick={() => setStatementFilter('all')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      statementFilter === 'all' ? 'bg-white text-indigo-900 shadow-2xs font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    All ({wallet.history.length})
                  </button>
                  <button
                    onClick={() => setStatementFilter('credit')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      statementFilter === 'credit' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    Credits (+)
                  </button>
                  <button
                    onClick={() => setStatementFilter('debit')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      statementFilter === 'debit' ? 'bg-white text-rose-700 shadow-2xs font-black' : 'hover:text-slate-900'
                    }`}
                  >
                    Debits (-)
                  </button>
                </div>

                {/* Print/Export Statement */}
                <button
                  onClick={handlePrintStatement}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Passbook
                </button>
              </div>

              {/* Transactions List */}
              <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                {filteredHistory.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No transactions found in this filter.
                  </div>
                ) : (
                  filteredHistory.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-slate-50/80 transition flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          item.type === 'credit' 
                            ? 'bg-emerald-100 text-emerald-700' 
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {item.type === 'credit' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-[12px] truncate">{item.title}</p>
                          <p className="text-[10px] text-slate-400">{formatDateTimeDDMMYYYY(item.timestamp)}</p>
                          {item.remark && (
                            <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{item.remark}</p>
                          )}
                          <p className="font-mono text-[9px] text-slate-400 mt-0.5">Ref: {item.utrRef || item.id}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`text-xs font-black block ${
                          item.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {item.type === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[9.5px] text-slate-400 font-medium block mt-0.5">
                          Bal: ₹{(item.balanceAfter ?? wallet.balance).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10.5px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> 256-Bit Encrypted Community Wallet
          </div>
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-1.5 rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
