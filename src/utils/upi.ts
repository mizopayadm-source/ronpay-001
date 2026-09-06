import { Campaign, Transaction } from '../types';
import { generateReceiptWebLink } from './qr';

export interface UpiIntentPayload {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef: string;
  campaignId?: string;
  donorName?: string;
  donorPhone?: string;
}

export interface UpiAppOption {
  id: 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'cred' | 'amazonpay' | 'generic';
  name: string;
  shortName: string;
  scheme: string;
  androidPackage?: string;
  iosScheme?: string;
  accentColor: string;
  badgeBg: string;
  iconBg: string;
  popular?: boolean;
}

/**
 * Strict verification for Indian UPI VPA / UPI ID format.
 * Format standard: username@bankhandle (e.g. name@okhdfcbank, 9862000000@ybl, merchant@axl)
 */
export function validateUpiId(upiId?: string | null): { isValid: boolean; error?: string; cleanUpiId?: string } {
  if (!upiId || typeof upiId !== 'string') {
    return { isValid: false, error: 'UPI ID a awm lo (Missing UPI ID). Campaign siamtu hian UPI ID a dah a ngai a ni.' };
  }

  const clean = upiId.trim().toLowerCase();

  if (clean.length < 5) {
    return { isValid: false, error: 'UPI ID hi a tawi lutuk (Minimum 5 characters needed).' };
  }

  if (clean.length > 60) {
    return { isValid: false, error: 'UPI ID hi a sei lutuk (Maximum 60 characters allowed).' };
  }

  // Must contain exactly one '@' symbol
  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, error: 'UPI ID format a dik lo: "@" symbol vawikhat chauh a awm tur a ni (e.g. name@okhdfcbank, phone@ybl).' };
  }

  const [handle, pspBank] = parts;

  // Handle (before @) validation: alphanumeric, dots, hyphens, underscores
  const handleRegex = /^[a-zA-Z0-9.\-_]{2,45}$/;
  if (!handleRegex.test(handle)) {
    return { isValid: false, error: `UPI ID handle "${handle}" a dik lo. Letter, number, dot leh hyphen chauh hman theih a ni.` };
  }

  // Bank PSP (after @) validation: alphabetical / alphanumeric standard handles
  const pspRegex = /^[a-zA-Z0-9.\-_]{2,25}$/;
  if (!pspRegex.test(pspBank)) {
    return { isValid: false, error: `UPI Bank handle "@${pspBank}" a dik lo. Bank handle dik (e.g. @okhdfcbank, @okaxis, @ybl, @axl, @paytm, @sbi) hman tur a ni.` };
  }

  return { isValid: true, cleanUpiId: clean };
}

/**
 * Available UPI App Options with their standard schemes
 */
export const UPI_APP_OPTIONS: UpiAppOption[] = [
  {
    id: 'gpay',
    name: 'Google Pay (GPay)',
    shortName: 'GPay',
    scheme: 'upi://pay',
    androidPackage: 'com.google.android.apps.nbu.paisa.user',
    iosScheme: 'gpay://',
    accentColor: '#1a73e8',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconBg: 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white',
    popular: true,
  },
  {
    id: 'phonepe',
    name: 'PhonePe',
    shortName: 'PhonePe',
    scheme: 'upi://pay',
    androidPackage: 'com.phonepe.app',
    iosScheme: 'phonepe://',
    accentColor: '#5f259f',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    iconBg: 'bg-gradient-to-tr from-purple-700 to-indigo-800 text-white',
    popular: true,
  },
  {
    id: 'paytm',
    name: 'Paytm UPI',
    shortName: 'Paytm',
    scheme: 'upi://pay',
    androidPackage: 'net.one97.paytm',
    iosScheme: 'paytmmp://',
    accentColor: '#00b9f5',
    badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    iconBg: 'bg-gradient-to-tr from-cyan-600 to-sky-500 text-white',
    popular: true,
  },
  {
    id: 'bhim',
    name: 'BHIM UPI',
    shortName: 'BHIM',
    scheme: 'upi://pay',
    androidPackage: 'in.org.npci.upiapp',
    iosScheme: 'bhim://',
    accentColor: '#00833e',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    iconBg: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
    popular: true,
  },
  {
    id: 'cred',
    name: 'CRED UPI',
    shortName: 'CRED',
    scheme: 'upi://pay',
    androidPackage: 'com.dreamplug.androidapp',
    iosScheme: 'cred://',
    accentColor: '#111827',
    badgeBg: 'bg-slate-100 text-slate-900 border-slate-300',
    iconBg: 'bg-gradient-to-tr from-slate-900 to-slate-800 text-white',
  },
  {
    id: 'amazonpay',
    name: 'Amazon Pay',
    shortName: 'Amazon',
    scheme: 'upi://pay',
    androidPackage: 'in.amazon.mShop.android.shopping',
    iosScheme: 'amazon://',
    accentColor: '#ff9900',
    badgeBg: 'bg-amber-50 text-amber-900 border-amber-200',
    iconBg: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
  },
  {
    id: 'generic',
    name: 'Any UPI App (Android Chooser)',
    shortName: 'Choose Any App',
    scheme: 'upi://pay',
    accentColor: '#4f46e5',
    badgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    iconBg: 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white',
    popular: true,
  }
];

/**
 * Generate standard NPCI compliant UPI Intent URI.
 * If androidPackage is provided on mobile, uses Android Chrome Intent URI format
 * so Chrome opens the exact targeted UPI app with the standard 'upi' scheme.
 */
export function buildUpiIntentUrl(
  payload: UpiIntentPayload,
  appScheme: string = 'upi://pay',
  androidPackage?: string
): string {
  const { upiId, payeeName, amount, note, transactionRef } = payload;
  
  const cleanUpiId = upiId.trim();
  const cleanPayee = payeeName.trim().replace(/[^a-zA-Z0-9 ]/g, ' ').substring(0, 50);
  // NPCI spec: Note should be alphanumeric and spaces only, no colons or special chars
  const cleanNote = (note || `RonPay ${transactionRef}`).replace(/[^a-zA-Z0-9 ]/g, ' ').trim().substring(0, 40);
  const formattedAmount = Number(amount).toFixed(2);

  // NPCI UPI Standard Query Parameters:
  // pa = Payee VPA (Required)
  // pn = Payee Name (Required)
  // am = Transaction Amount (Required)
  // cu = Currency (INR)
  // tn = Transaction Note (Optional, clean alphanumeric)
  // Build standard RFC 3986 encoded query string with %20 instead of '+'
  const queryParts = [
    `pa=${encodeURIComponent(cleanUpiId)}`,
    `pn=${encodeURIComponent(cleanPayee)}`,
    `am=${formattedAmount}`,
    `cu=INR`,
    `tn=${encodeURIComponent(cleanNote)}`
  ];

  const queryString = queryParts.join('&');

  // If an Android package is specified (e.g. GPay or PhonePe), use the standard Android Chrome Intent
  // syntax: intent://pay?<params>#Intent;scheme=upi;package=<pkg>;end
  // This allows Android Chrome to target the exact app using standard NPCI 'upi' scheme.
  if (androidPackage && isMobileDevice()) {
    return `intent://pay?${queryString}#Intent;scheme=upi;package=${androidPackage};end`;
  }

  // Standard generic UPI scheme (upi://pay?...)
  let base = appScheme;
  if (!base.includes('://')) {
    base = 'upi://pay';
  }

  const delimiter = base.includes('?') ? '&' : '?';
  return `${base}${delimiter}${queryString}`;
}

/**
 * Detects if user device is mobile (Android / iOS)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
}

/**
 * Detects specific OS for deep linking optimization
 */
export function getMobileOS(): 'android' | 'ios' | 'other' {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}
