import { Transaction } from '../types';
import { formatDateTimeDDMMYYYY } from './date';
import { generateReceiptWebLink } from './qr';

export interface PhoneValidationResult {
  isValid: boolean;
  cleaned: string;
  formatted: string;
  countryCode: string;
}

/**
 * Validates and normalizes Indian mobile phone numbers (10 digits)
 */
export const cleanIndianPhoneNumber = (phone: string): PhoneValidationResult => {
  if (!phone) {
    return { isValid: false, cleaned: '', formatted: '', countryCode: '91' };
  }

  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Strip leading 0 or +91 / 91
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  const isValid = digits.length === 10;
  const formatted = isValid ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : phone;

  return {
    isValid,
    cleaned: digits,
    formatted,
    countryCode: '91',
  };
};

/**
 * Formats a clean, high-clarity, professional WhatsApp Digital Receipt
 */
export const formatWhatsAppReceiptMessage = (
  tx: Transaction,
  options?: { language?: 'mizo' | 'english' }
): string => {
  const isMizo = options?.language !== 'english';
  const receiptUrl = generateReceiptWebLink(tx.id);
  const donor = tx.isAnonymous 
    ? (isMizo ? 'Hming Thup (Anonymous)' : 'Anonymous Contributor') 
    : (tx.donorName || (isMizo ? 'Mimal / Donor' : 'Donor'));
  
  const amountVal = Number(tx.amount) || 0;
  const platformFeeVal = Number(tx.platformFee) || 0;
  const totalAmountVal = Number(tx.totalAmount) || (amountVal + platformFeeVal);

  const amountStr = `₹${amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const feeStr = `₹${platformFeeVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalStr = `₹${totalAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateStr = formatDateTimeDDMMYYYY(tx.timestamp || new Date().toISOString());
  
  const categoryNames: Record<string, { mizo: string; eng: string; icon: string }> = {
    ralna: { mizo: 'Ralna Bawm (Chhiatni & Mitthi Ralna)', eng: 'Condolence & Bereavement', icon: '🖤' },
    kumtluang: { mizo: 'Kumtluang Bawm (Kohhran & Pawl)', eng: 'Church & Recurring Fund', icon: '🏛️' },
    khawlsak: { mizo: 'Khawlsak Bawm (Building & Project)', eng: 'Building & Capital Fund', icon: '🏗️' },
    rikrum: { mizo: 'Rikrum Bawm (Emergency & Disaster)', eng: 'Disaster & Medical Relief', icon: '🚨' },
    others: { mizo: 'Mimal & Chhungkua Bawm', eng: 'Personal & Family Events', icon: '🎁' },
  };

  const catMeta = categoryNames[tx.category || 'others'] || { mizo: 'RonPay Bawm', eng: 'RonPay Bawm', icon: '📦' };

  let breakdownText = '';
  if (tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0) {
    breakdownText = `\n📊 *${isMizo ? 'Thawhlawm Thendarh (Breakdown):' : 'Breakdown:'}*\n` +
      Object.entries(tx.subCategoryBreakdown)
        .map(([k, v]) => `  • ${k}: ₹${Number(v).toLocaleString('en-IN')}`)
        .join('\n') + '\n';
  }

  const phoneVal = tx.donorPhone ? cleanIndianPhoneNumber(tx.donorPhone).formatted : '';

  return (
    `🧾 *RONPAY OFFICIAL DIGITAL RECEIPT*\n` +
    `*Mizoram Community & Smart Payment*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *STATUS:* ${isMizo ? 'HLAWHTLING (PAID & VERIFIED)' : 'PAID & VERIFIED'}\n` +
    `🔖 *Receipt / TXN ID:* \`${tx.id}\`\n` +
    `📅 *Hun / Date:* ${dateStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${catMeta.icon} *Bawm:* ${isMizo ? catMeta.mizo : catMeta.eng}\n` +
    `🎯 *Hming / Campaign:* ${tx.campaignTitle || 'RonPay Community Cause'}\n` +
    `👤 *Petu (Donor):* ${donor}\n` +
    (tx.memberId || tx.subId ? `🆔 *Member / Roll ID:* ${tx.memberId || tx.subId}\n` : '') +
    (phoneVal ? `📱 *Phone:* ${phoneVal}\n` : '') +
    (tx.periodLabel ? `🗓️ *Pek Hun / Period:* ${tx.periodLabel}\n` : '') +
    (tx.remark ? `💬 *Thuchah / Remark:* ${tx.remark}\n` : '') +
    breakdownText +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 *Pek Zat (Principal):* ${amountStr}\n` +
    `⚡ *Platform Fee:* ${feeStr}\n` +
    `💰 *TOTAL SETTLED:* *${totalStr}*\n` +
    `💳 *Payment Mode:* ${tx.paymentMethod === 'cash' ? '💵 Cash' : '⚡ Online UPI (PhonePe / GPay)'}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🌐 *Online-a Verified Receipt Enna Link:*\n` +
    `${receiptUrl}\n\n` +
    `_Hei hi RonPay System generated digital receipt rintlak a ni a, signature a ngai lo. Link click-in browser leh phone camera-in a check reng theih e._\n` +
    `🙏 *Ka lawm e! RonPay Mizoram*`
  );
};

/**
 * Builds the URL to open WhatsApp with prefilled message
 * If phone number is provided and valid, sends directly to that person: https://wa.me/91XXXXXXXXXX?text=...
 * If no phone number is provided, opens universal selector: https://api.whatsapp.com/send?text=...
 */
export const getWhatsAppReceiptShareUrl = (
  tx: Transaction,
  targetPhone?: string,
  options?: { language?: 'mizo' | 'english' }
): string => {
  const message = formatWhatsAppReceiptMessage(tx, options);
  const encodedText = encodeURIComponent(message);

  if (targetPhone && targetPhone.trim()) {
    const check = cleanIndianPhoneNumber(targetPhone);
    if (check.isValid) {
      return `https://wa.me/91${check.cleaned}?text=${encodedText}`;
    }
  }

  // Universal share intent
  return `https://api.whatsapp.com/send?text=${encodedText}`;
};

/**
 * Opens WhatsApp receipt in a new window/tab safely across web, Android, iOS
 */
export const openWhatsAppReceipt = (
  tx: Transaction,
  targetPhone?: string,
  options?: { language?: 'mizo' | 'english' }
): void => {
  const url = getWhatsAppReceiptShareUrl(tx, targetPhone, options);
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
