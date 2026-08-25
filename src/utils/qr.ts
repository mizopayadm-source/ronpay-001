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
    if (window.location.hostname !== 'localhost') {
      return `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}`;
    }
  }
  return 'https://ronpay-001-smoky.vercel.app/';
};

export const generateCampaignWebLink = (campaignId: string, customDomain?: string): string => {
  const baseDomain = (customDomain && customDomain.trim()) ? customDomain.trim().replace(/\/+$/, '') : getCustomDomain().replace(/\/+$/, '');
  return `${baseDomain}/?campaign=${encodeURIComponent(campaignId)}`;
};

export const getCampaignWebPortalUrl = (campaignId: string, customDomain?: string): string => {
  return generateCampaignWebLink(campaignId, customDomain);
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
