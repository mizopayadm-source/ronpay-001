import QRCode from 'qrcode';
import { Campaign } from '../types';

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

export const generateBawmQRDataUrl = async (campaign: Campaign): Promise<string> => {
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
