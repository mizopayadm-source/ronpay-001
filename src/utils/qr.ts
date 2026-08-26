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
  if (camp.upiId) params.set('upi', camp.upiId);
  if (camp.location) params.set('loc', camp.location);
  if (camp.orgCode) params.set('org', camp.orgCode);
  if (camp.targetAmount) params.set('target', String(camp.targetAmount));

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
      width: 400,
      margin: 2,
      color: {
        dark: '#1e1b4b',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
    return dataUrl;
  } catch (err) {
    console.error('Error generating QR code', err);
    // Fallback QR service
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
  }
};

export const generateBawmQRDataUrl = async (campaign: Campaign, mode: 'auto' | 'upi' | 'web' = 'auto'): Promise<string> => {
  // If mode is 'web' or if auto and it's kumtluang, generate Web Portal link QR
  if (mode === 'web' || (mode === 'auto' && campaign.category === 'kumtluang')) {
    const portalUrl = generateCampaignWebLink(campaign.id);
    return generateQRCodeDataUrl(portalUrl);
  }

  const upiPayload = generateUPILink({
    upiId: campaign.upiId || 'ronpay@axl',
    name: campaign.title || 'RonPay Bawm',
    note: `RonPay:${campaign.id}`
  });
  return generateQRCodeDataUrl(upiPayload);
};
