import React, { useState } from 'react';
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  Smartphone, 
  MessageSquare, 
  ExternalLink,
  Receipt,
  ShieldCheck
} from 'lucide-react';
import { Transaction } from '../types';
import { 
  formatWhatsAppReceiptMessage, 
  getWhatsAppReceiptShareUrl, 
  cleanIndianPhoneNumber 
} from '../utils/whatsappReceipt';

interface WhatsAppReceiptModalProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
  language?: 'mizo' | 'english';
}

export const WhatsAppReceiptModal: React.FC<WhatsAppReceiptModalProps> = ({
  transaction,
  isOpen,
  onClose,
  language = 'mizo',
}) => {
  const isMizo = language !== 'english';
  
  // Initial phone number from transaction or blank
  const initialPhone = transaction.donorPhone ? transaction.donorPhone.replace(/\D/g, '').slice(-10) : '';
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [copied, setCopied] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  if (!isOpen) return null;

  const phoneValidation = cleanIndianPhoneNumber(phoneNumber);
  const receiptMessage = formatWhatsAppReceiptMessage(transaction, { language });

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptMessage).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleSendDirect = () => {
    const target = phoneValidation.isValid ? phoneValidation.cleaned : undefined;
    const url = getWhatsAppReceiptShareUrl(transaction, target, { language });
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleShareUniversal = () => {
    const url = getWhatsAppReceiptShareUrl(transaction, undefined, { language });
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-[#25D366] to-teal-600 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs border border-white/30 flex items-center justify-center text-white shrink-0 shadow-xs">
              <MessageSquare className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black tracking-tight">
                  {isMizo ? 'WhatsApp Digital Receipt' : 'WhatsApp Digital Receipt'}
                </h3>
                <span className="bg-white/25 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                  VERIFIED
                </span>
              </div>
              <p className="text-[11px] text-emerald-50">
                {isMizo ? 'Sum pekna official receipt WhatsApp-ah thawn rawh' : 'Send official verified receipt via WhatsApp'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto text-slate-800 text-xs">
          
          {/* Quick Summary Strip */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-[10px] uppercase font-black text-emerald-800 tracking-wider">
                {transaction.category ? `${transaction.category.toUpperCase()} BAWM` : 'RONPAY RECEIPT'}
              </div>
              <div className="text-xs font-bold text-slate-900 truncate max-w-[200px]">
                {transaction.campaignTitle || 'RonPay Community Fund'}
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Petu: <span className="font-bold text-slate-900">{transaction.isAnonymous ? 'Anonymous' : (transaction.donorName || 'User')}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-emerald-700 font-bold uppercase">Pek Zat</div>
              <div className="text-base font-black text-emerald-900">
                ₹{(transaction.totalAmount || transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[9.5px] font-mono text-slate-500">
                {transaction.id}
              </div>
            </div>
          </div>

          {/* Target Phone Number Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{isMizo ? 'WhatsApp Phone Number (10 Digits):' : 'WhatsApp Phone Number:'}</span>
              </span>
              {phoneNumber.length > 0 && (
                <span className={`text-[10px] font-bold ${phoneValidation.isValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {phoneValidation.isValid ? '✓ Valid Mobile' : `${phoneNumber.length}/10 digits`}
                </span>
              )}
            </label>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                +91
              </div>
              <input
                type="tel"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 9862300000"
                className="w-full pl-11 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-none transition shadow-2xs"
              />
            </div>

            <p className="text-[10.5px] text-slate-500">
              {isMizo 
                ? 'I phone number emaw, Khawhar In committee, Treasurer, chhungte number chhu lut la, an WhatsApp-ah a thleng nghal ang.' 
                : 'Enter donor, family or committee phone number to send receipt directly.'}
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2 pt-1">
            {/* Direct Send to Specific Phone */}
            <button
              type="button"
              onClick={handleSendDirect}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition shadow-sm cursor-pointer ${
                phoneValidation.isValid
                  ? 'bg-[#25D366] hover:bg-[#1ebd59] text-white shadow-emerald-500/20'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {phoneValidation.isValid 
                  ? (isMizo ? `+91 ${phoneValidation.cleaned}-ah WhatsApp Thawn Rawh` : `Send to +91 ${phoneValidation.cleaned}`) 
                  : (isMizo ? 'WhatsApp-ah Thawn Rawh (Chat Thlang Rawh)' : 'Share via WhatsApp App')}
              </span>
            </button>

            {/* Universal Share Button */}
            <button
              type="button"
              onClick={handleShareUniversal}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isMizo ? 'Group emaw Contact Dang Thlanna (WhatsApp Web / App)' : 'Choose Any Contact / Group'}</span>
            </button>
          </div>

          {/* Text Preview & Copy Option */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 transition cursor-pointer flex items-center gap-1"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{showPreview ? (isMizo ? 'Receipt Thuchah Thup Rawh' : 'Hide Preview') : (isMizo ? 'Receipt Thuchah En Rawh (Preview)' : 'Preview Receipt Message')}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 transition cursor-pointer bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? (isMizo ? 'Copy Fel E!' : 'Copied!') : (isMizo ? 'Text Copy Rawh' : 'Copy Text')}</span>
              </button>
            </div>

            {showPreview && (
              <div className="bg-slate-950 text-slate-200 p-3 rounded-xl text-[10.5px] font-mono whitespace-pre-line leading-relaxed max-h-48 overflow-y-auto border border-slate-800 select-all">
                {receiptMessage}
              </div>
            )}
          </div>

          {/* Trust Banner */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center gap-2 text-[10.5px] text-slate-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{isMizo ? 'Online link chuanna verified receipt a nih avangin awlsam takin phone-ah a endik theih vek e.' : 'Includes tamper-proof URL and transaction reference for instant online verification.'}</span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
          >
            {isMizo ? 'Khar Rawh' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
