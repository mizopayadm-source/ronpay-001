import React, { useState } from 'react';
import { 
  X, 
  Building2, 
  Send, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck, 
  CreditCard, 
  QrCode, 
  DollarSign, 
  Clock, 
  Lock, 
  Printer, 
  Smartphone,
  Info,
  Loader2,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { Transaction, CreatorProfile } from '../types';
import { printHtmlSafely } from '../utils/export';
import { formatDateTimeDDMMYYYY } from '../utils/date';

interface BankTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile;
  onTransferSuccess: (transaction: Transaction) => void;
}

export const BankTransferModal: React.FC<BankTransferModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  onTransferSuccess,
}) => {
  const [tab, setTab] = useState<'bank' | 'upi' | 'settlement'>('bank');
  
  // Bank Account Form
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('SBIN0001234');
  const [bankName, setBankName] = useState('State Bank of India (Aizawl Main)');
  const [amount, setAmount] = useState<number | ''>(500);
  const [remark, setRemark] = useState('');

  // UPI Form
  const [upiId, setUpiId] = useState('');
  const [upiAmount, setUpiAmount] = useState<number | ''>(500);
  const [upiRemark, setUpiRemark] = useState('');

  // Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  if (!isOpen) return null;

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!accountName.trim()) {
      setErrorMsg('Beneficiary Account Name dah a ngai e.');
      return;
    }
    if (!accountNumber.trim() || accountNumber.length < 8) {
      setErrorMsg('Bank Account Number dik tawk lo a ni.');
      return;
    }
    if (accountNumber !== confirmAccount) {
      setErrorMsg('Account number leh Confirm account number a inang lo.');
      return;
    }
    if (!ifsc.trim() || ifsc.length < 4) {
      setErrorMsg('IFSC Code dik tak dah rawh.');
      return;
    }
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 1) {
      setErrorMsg('Sum thawn zat tur dah rawh (₹1 aia tlem lo).');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const txId = 'BNK-' + Date.now().toString().slice(-6);
      const newTx: Transaction = {
        id: txId,
        campaignId: 'direct-bank-transfer',
        campaignTitle: `Bank Transfer: ${accountName} (${bankName})`,
        category: 'others',
        donorName: creatorProfile.name || 'RonPay User',
        donorPhone: creatorProfile.phone || '9862300000',
        amount: numAmount,
        platformFee: 0,
        totalAmount: numAmount,
        paymentMethod: 'online',
        status: 'completed',
        remark: remark || `Direct IMPS/NEFT Transfer to ${accountNumber.slice(-4)}`,
        timestamp: new Date().toISOString(),
        txHash: `IMPS${Date.now()}RPAY`,
      };

      setIsProcessing(false);
      setCompletedTx(newTx);
      onTransferSuccess(newTx);
    }, 1200);
  };

  const handleUpiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!upiId.trim() || !upiId.includes('@')) {
      setErrorMsg('UPI ID dik tak dah rawh (e.g. 9862300000@sbi).');
      return;
    }
    const numAmount = Number(upiAmount);
    if (!numAmount || numAmount < 1) {
      setErrorMsg('Sum thawn zat tur dah rawh (₹1 aia tlem lo).');
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      const txId = 'UPI-' + Date.now().toString().slice(-6);
      const newTx: Transaction = {
        id: txId,
        campaignId: 'direct-upi-transfer',
        campaignTitle: `UPI Transfer to: ${upiId}`,
        category: 'others',
        donorName: creatorProfile.name || 'RonPay User',
        donorPhone: creatorProfile.phone || '9862300000',
        amount: numAmount,
        platformFee: 0,
        totalAmount: numAmount,
        paymentMethod: 'online',
        status: 'completed',
        remark: upiRemark || `Instant UPI Pay to ${upiId}`,
        timestamp: new Date().toISOString(),
        txHash: `UPI${Date.now()}RPAY`,
      };

      setIsProcessing(false);
      setCompletedTx(newTx);
      onTransferSuccess(newTx);
    }, 1200);
  };

  const handleSettlementSubmit = () => {
    setErrorMsg('');
    setIsProcessing(true);
    setTimeout(() => {
      const txId = 'SETTLE-' + Date.now().toString().slice(-6);
      const settleAmount = 5000;
      const newTx: Transaction = {
        id: txId,
        campaignId: 'creator-settlement',
        campaignTitle: `Bawm Public Fund Settlement to ${creatorProfile.name || 'Creator Bank'}`,
        category: 'others',
        donorName: 'RonPay Settlement Pool',
        donorPhone: creatorProfile.phone || '9862300000',
        amount: settleAmount,
        platformFee: 0,
        totalAmount: settleAmount,
        paymentMethod: 'online',
        status: 'completed',
        remark: `Direct Payout to Bank Account ending in 8892`,
        timestamp: new Date().toISOString(),
        txHash: `SETTLE${Date.now()}`,
      };

      setIsProcessing(false);
      setCompletedTx(newTx);
      onTransferSuccess(newTx);
    }, 1200);
  };

  const printReceipt = (tx: Transaction) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>RonPay Bank Transfer Receipt - ${tx.id}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 25px; text-align: center; color: #0f172a; }
            .receipt { max-width: 400px; margin: 0 auto; border: 2px solid #059669; border-radius: 16px; padding: 20px; text-align: left; }
            .title { font-size: 18px; font-weight: 900; color: #065f46; text-align: center; margin-bottom: 4px; }
            .sub { font-size: 11px; color: #64748b; text-align: center; margin-bottom: 15px; }
            .badge { background: #dcfce7; color: #166534; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; }
            .amount { background: #f0fdf4; border: 1px dashed #86efac; border-radius: 12px; padding: 12px; text-align: center; font-size: 24px; font-weight: 900; color: #047857; margin: 15px 0; }
            .row { display: flex; justify-content: space-between; font-size: 12px; margin: 6px 0; }
            .lbl { color: #64748b; }
            .val { font-weight: 700; color: #0f172a; }
            .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="title">RONPAY INSTANT TRANSFER</div>
            <div class="sub">Direct Bank & Settlement Receipt</div>
            <div style="text-align: center;"><span class="badge">SUCCESSFUL (IMPS / UPI)</span></div>

            <div class="amount">₹${tx.amount.toLocaleString('en-IN')}</div>

            <div class="row"><span class="lbl">Tx ID:</span><span class="val">${tx.id}</span></div>
            <div class="row"><span class="lbl">Date & Time:</span><span class="val">${formatDateTimeDDMMYYYY(tx.timestamp)}</span></div>
            <div class="row"><span class="lbl">Transfer Type:</span><span class="val">${tx.campaignTitle}</span></div>
            <div class="row"><span class="lbl">Sender:</span><span class="val">${tx.donorName}</span></div>
            <div class="row"><span class="lbl">Platform Fee:</span><span class="val">₹0 (Free / Zero Fee)</span></div>
            <div class="row"><span class="lbl">Remark:</span><span class="val">${tx.remark}</span></div>
            <div class="row"><span class="lbl">Reference Hash:</span><span class="val" style="font-family: monospace; font-size: 9px;">${tx.txHash}</span></div>

            <div class="footer">RonPay Mizoram Community Platform • 100% Direct & Transparent</div>
          </div>
        </body>
      </html>
    `;
    const bawmName = (tx.campaignTitle || 'Transfer_Receipt').replace(/[/\\?%*:|"<>]/g, '').trim();
    const docTitle = `RonPay Transfer Receipt - ${bawmName}`;
    const fileName = `RonPay-${bawmName.replace(/\s+/g, '_')}.pdf`;
    printHtmlSafely(html, docTitle, fileName);
  };

  return (
    <div 
      id="bank-transfer-modal-overlay"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="bank-transfer-dialog"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-teal-950 text-white px-5 py-4 flex items-center justify-between border-b border-emerald-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">To Bank & Settlement</h3>
                <span className="text-[9px] bg-emerald-400/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/40">
                  Instant IMPS
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Direct Bank Account, UPI & Payout Settlement
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {completedTx ? (
            /* Success Receipt Screen */
            <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                  Transfer Successful
                </span>
                <h4 className="text-xl font-black text-slate-900 mt-2">
                  ₹{completedTx.amount.toLocaleString('en-IN')}
                </h4>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {completedTx.campaignTitle}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  Tx ID: {completedTx.id} • {formatDateTimeDDMMYYYY(completedTx.timestamp)}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Instant Settled
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Platform Fee:</span>
                  <span className="font-bold text-slate-900">₹0 (Zero Fee)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference:</span>
                  <span className="font-mono text-[10px] text-slate-600">{completedTx.txHash}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => printReceipt(completedTx)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4 text-slate-600" /> Print Receipt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCompletedTx(null);
                    onClose();
                  }}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition cursor-pointer active:scale-95 shadow-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setTab('bank'); setErrorMsg(''); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tab === 'bank' 
                      ? 'bg-white text-emerald-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Bank Account
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('upi'); setErrorMsg(''); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tab === 'upi' 
                      ? 'bg-white text-indigo-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  To UPI ID
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('settlement'); setErrorMsg(''); }}
                  className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    tab === 'settlement' 
                      ? 'bg-white text-amber-700 shadow-xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  Bawm Settlement
                </button>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl border border-rose-200 font-bold text-xs flex items-center gap-2">
                  <X className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Tab 1: Bank Account */}
              {tab === 'bank' && (
                <form onSubmit={handleBankSubmit} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold text-[11px] mb-1">
                      Beneficiary / Account Holder Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Lalnunmawia / YMA Welfare Fund"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-bold text-[11px] mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        placeholder="Account Number"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold text-[11px] mb-1">
                        Confirm Account Number
                      </label>
                      <input
                        type="text"
                        placeholder="Re-enter Account Number"
                        value={confirmAccount}
                        onChange={(e) => setConfirmAccount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-700 font-bold text-[11px] mb-1">
                        IFSC Code
                      </label>
                      <input
                        type="text"
                        placeholder="SBIN0001234"
                        value={ifsc}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setIfsc(val);
                          if (val.startsWith('SBIN')) setBankName('State Bank of India (Aizawl Main)');
                          else if (val.startsWith('HDFC')) setBankName('HDFC Bank (Chanmari Branch)');
                          else if (val.startsWith('ICIC')) setBankName('ICICI Bank (Bawngkawn)');
                          else if (val.startsWith('UTIB')) setBankName('Axis Bank (Khatla)');
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-bold text-[11px] mb-1">
                        Bank Branch
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-[11px] mb-1">
                      Thawn Zat Tur (Amount in ₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-bold text-slate-500 text-sm">₹</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="500"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-emerald-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-[11px] mb-1">
                      Purpose / Remark (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tanpuina / Thawhlawm"
                      value={remark}
                      onChange={(e) => setRemark(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-md mt-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Bank Transfer Process mek...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Transfer ₹{Number(amount || 0).toLocaleString('en-IN')} Now
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Tab 2: To UPI ID */}
              {tab === 'upi' && (
                <form onSubmit={handleUpiSubmit} className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-bold text-[11px] mb-1">
                      Recipient UPI ID / VPA
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9862300000@sbi or ymami@okhdfcbank"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-[11px] mb-1">
                      Thawn Zat Tur (Amount in ₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 font-bold text-slate-500 text-sm">₹</span>
                      <input
                        type="number"
                        min="1"
                        placeholder="500"
                        value={upiAmount}
                        onChange={(e) => setUpiAmount(e.target.value ? Number(e.target.value) : '')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm font-black text-indigo-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold text-[11px] mb-1">
                      Note / Remark (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Tanpuina pekna"
                      value={upiRemark}
                      onChange={(e) => setUpiRemark(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-md mt-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        UPI Pay Process mek...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Pay ₹{Number(upiAmount || 0).toLocaleString('en-IN')} via UPI
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Tab 3: Creator Bawm Settlement */}
              {tab === 'settlement' && (
                <div className="space-y-3.5">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-amber-950 space-y-1">
                    <div className="flex items-center gap-1.5 font-extrabold text-amber-900 text-xs">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      RonPay Bawm Direct Settlement
                    </div>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Mipui donation tling khawmte hi Creator registered Bank Account-ah direct & 0% fee deduction-in a transfer nghal theih e.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Registered Creator:</span>
                      <span className="font-extrabold text-slate-900">{creatorProfile.name || 'Lalnunmawia (YMA Secretary)'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Linked Bank Account:</span>
                      <span className="font-mono font-bold text-slate-800">State Bank of India (***8892)</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <span className="text-slate-500">Available Public Fund:</span>
                      <span className="font-black text-emerald-600 text-sm">₹5,000</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Platform Settlement Fee:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ₹0 (0% Free for Charity)
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSettlementSubmit}
                    disabled={isProcessing}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 shadow-md"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        Settling to Bank Account...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        Withdraw / Settle ₹5,000 to Bank Now
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
