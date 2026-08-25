import QRCode from 'qrcode';
import { Campaign } from '../types';

export const DEFAULT_WEB_PORTAL_DOMAIN = 'https://ronpay-001-smoky.vercel.app';

export const getCampaignWebPortalUrl = (campaignId: string, customDomain?: string): string => {
  const base = customDomain || (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') ? window.location.origin : DEFAULT_WEB_PORTAL_DOMAIN);
  const cleanBase = base.replace(/\/+$/, '');
  return `${cleanBase}/?campaignId=${encodeURIComponent(campaignId)}`;
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
    const portalUrl = getCampaignWebPortalUrl(campaign.id);
    return generateQRCodeDataUrl(portalUrl);
  }

  const upiPayload = createUPIPaymentString(
    campaign.upiId || 'ronpay@axl',
    campaign.title || 'RonPay Bawm',
    undefined,
    `RonPay:${campaign.id}`
  );
  return generateQRCodeDataUrl(upiPayload);
};

export const createUPIPaymentString = (upiId: string, name: string, amount?: number, note?: string) => {
  let str = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}`;
  if (amount && amount > 0) {
    str += `&am=${amount.toFixed(2)}&cu=INR`;
  }
  if (note) {
    str += `&tn=${encodeURIComponent(note)}`;
  }
  return str;
};

