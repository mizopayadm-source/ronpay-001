import QRCode from 'qrcode';
import { Campaign } from '../types';

export interface UPIPayload {
  upiId: string;
  name: string;
  amount?: number;
  note?: string;
  transactionRef?: string;
  currency?: string;
}

export const generateUPILink = (payload: UPIPayload): string => {
  const {
    upiId,
    name,
    amount,
    note,
    transactionRef = `TXN${Date.now()}`,
    currency = 'INR'
  } = payload;

  const cleanUpiId = upiId ? upiId.trim() : '';
  const cleanName = name ? name.trim() : 'RonPay Merchant';
  const cleanNote = note ? note.trim() : 'RonPay Contribution';

  let upiUrl = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanName)}&tr=${encodeURIComponent(transactionRef)}&tn=${encodeURIComponent(cleanNote)}&cu=${currency}`;

  if (amount && amount > 0) {
    upiUrl += `&am=${amount.toFixed(2)}`;
  }

  return upiUrl;
};

export const getCustomDomain = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('ronpay_custom_domain');
    if (saved && saved.trim()) return saved.trim();
    if (window.location.origin && window.location.origin !== 'null') {
      return `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`;
    }
  }
  return 'https://ronpay-001-pi.vercel.app';
};

export const generateCampaignWebLink = (campaignOrId: string | Campaign, customDomain?: string): string => {
  const baseDomain = (customDomain && customDomain.trim()) ? customDomain.trim().replace(/\/+$/, '') : getCustomDomain().replace(/\/+$/, '');
  
  if (typeof campaignOrId === 'string') {
    return `${baseDomain}/?campaign=${encodeURIComponent(campaignOrId)}`;
  }

  const camp = campaignOrId;
  const params = new URLSearchParams();
  params.set('campaign', camp.id);
  if (camp.category) params.set('cat', camp.category);
  if (camp.title) params.set('title', camp.title);
  if (camp.targetUpiId || camp.upiId) params.set('upi', camp.targetUpiId || camp.upiId);
  if (camp.location) params.set('loc', camp.location);
  if (camp.orgName || camp.orgCode) params.set('org', (camp.orgName || camp.orgCode)!);
  if (camp.targetAmount) params.set('target', String(camp.targetAmount));
  if (camp.cause) params.set('cause', camp.cause);
  if (camp.creatorName) params.set('creator', camp.creatorName);
  if (camp.mitthiHming) params.set('mitthi', camp.mitthiHming);
  if (camp.vuiHun) params.set('vuiHun', camp.vuiHun);
  if (camp.vuitu) params.set('vuitu', camp.vuitu);
  if (camp.thihni) params.set('thihni', camp.thihni);
  if (camp.imageUrl && camp.imageUrl.startsWith('http')) params.set('img', camp.imageUrl);

  return `${baseDomain}/?${params.toString()}`;
};

export const getCampaignWebPortalUrl = (campaignOrId: string | Campaign, customDomain?: string): string => {
  return generateCampaignWebLink(campaignOrId, customDomain);
};

export const createUPIPaymentString = (upiId: string, name: string, amount?: number, note?: string): string => {
  return generateUPILink({
    upiId,
    name,
    amount,
    note,
  });
};

export const generateQRCodeDataUrl = async (text: string): Promise<string> => {
  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width: 450,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code', err);
    // Fallback QR service
    return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
  }
};

export const generateReceiptWebLink = (transactionId: string, customDomain?: string): string => {
  const baseDomain = (customDomain && customDomain.trim()) ? customDomain.trim().replace(/\/+$/, '') : getCustomDomain().replace(/\/+$/, '');
  return `${baseDomain}/?receipt=${encodeURIComponent(transactionId)}`;
};

export const generateOffAppPaymentQR = (payload: {
  upiId: string;
  name: string;
  amount?: number;
  campaignId: string;
  transactionRef?: string;
  donorName?: string;
}): { upiIntentUrl: string; receiptWebUrl: string } => {
  const txRef = payload.transactionRef || `RPAY${Date.now()}`;
  const receiptWebUrl = generateReceiptWebLink(txRef);
  const cleanUpiId = payload.upiId ? payload.upiId.trim() : 'ronpay@upi';
  const cleanName = payload.name ? payload.name.trim() : 'RonPay Bawm';
  const note = `RonPay:${payload.campaignId}:${txRef}`;

  let upiIntentUrl = `upi://pay?pa=${encodeURIComponent(cleanUpiId)}&pn=${encodeURIComponent(cleanName)}&tr=${encodeURIComponent(txRef)}&tn=${encodeURIComponent(note)}&cu=INR&url=${encodeURIComponent(receiptWebUrl)}`;

  if (payload.amount && payload.amount > 0) {
    upiIntentUrl += `&am=${payload.amount.toFixed(2)}`;
  }

  return { upiIntentUrl, receiptWebUrl };
};

export const generateReceiptQRDataUrl = async (transactionId: string): Promise<string> => {
  const receiptUrl = generateReceiptWebLink(transactionId);
  return generateQRCodeDataUrl(receiptUrl);
};

export const generateBawmQRDataUrl = async (campaign: Campaign, mode: 'auto' | 'upi' | 'web' = 'auto'): Promise<string> => {
  // If mode is 'web' or 'auto' (universal compatibility with Google Lens, Phone camera, RonPay Scanner)
  if (mode === 'web' || mode === 'auto' || campaign.category === 'kumtluang') {
    const portalUrl = generateCampaignWebLink(campaign);
    return generateQRCodeDataUrl(portalUrl);
  }

  const upiPayload = generateUPILink({
    upiId: campaign.targetUpiId || campaign.upiId || 'ronpay@axl',
    name: campaign.title || 'RonPay Bawm',
    note: `RonPay:${campaign.id}`
  });
  return generateQRCodeDataUrl(upiPayload);
};
