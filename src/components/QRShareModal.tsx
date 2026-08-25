import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Download, 
  Check, 
  Printer, 
  ShieldCheck, 
  MapPin, 
  Smartphone,
  ExternalLink,
  MessageCircle,
  Globe,
  QrCode,
  Users
} from 'lucide-react';
import { Campaign } from '../types';
import { generateBawmQRDataUrl, getCampaignWebPortalUrl, createUPIPaymentString, generateQRCodeDataUrl } from '../utils/qr';
import { formatDateDDMMYYYY } from '../utils/date';
import { printHtmlSafely, downloadFileUniversal } from '../utils/export';

interface QRShareModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  onClose: () => void;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({
  isOpen,
  campaign,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [qrMode, setQrMode] = useState<'web' | 'upi'>('web');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (campaign) {
      // Auto-select Web Portal for Kumtluang, UPI for others by default
      const defaultMode = campaign.category === 'kumtluang' ? 'web' : 'upi';
      setQrMode(defaultMode);
    }
  }, [campaign]);

  useEffect(() => {
    if (campaign) {
      if (qrMode === 'web') {
        const portalUrl = getCampaignWebPortalUrl(campaign.id);
        generateQRCodeDataUrl(portalUrl).then(url => setQrDataUrl(url));
      } else {
        const upiPayload = createUPIPaymentString(
          campaign.upiId || 'ronpay@axl',
          campaign.title || 'RonPay Bawm',
          undefined,
          `RonPay:${campaign.id}`
        );
        generateQRCodeDataUrl(upiPayload).then(url => setQrDataUrl(url));
      }
    }
  }, [campaign, qrMode]);

  if (!isOpen || !campaign) return null;

  const isKumtluang = campaign.category === 'kumtluang';
  const webPortalUrl = getCampaignWebPortalUrl(campaign.id);
  const shareUrl = qrMode === 'web' ? webPortalUrl : (campaign.upiId ? `upi://pay?pa=${campaign.upiId}&pn=${encodeURIComponent(campaign.title)}` : webPortalUrl);
  
  const shareText = isKumtluang
    ? `*${campaign.title}* - Kumtluang Bawm Member Portal\n🏢 Org: ${campaign.orgName || campaign.title}\n📍 Location: ${campaign.location}\n📲 Member Roll & Category thlang chunga pekna:\n🔗 ${webPortalUrl}\n\n_RonPay Digital Community Platform_`
    : `*${campaign.title}* - RonPay Bawm Donation\nBawm: ${campaign.category.toUpperCase()}\nLocation: ${campaign.location}\nUPI ID: ${campaign.upiId}\n\nDonation Link: ${webPortalUrl}`;

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: isKumtluang ? `${campaign.title} - Member Portal` : campaign.title,
          text: shareText,
          url: webPortalUrl,
        });
      } catch (err) {
        // Fallback to WhatsApp
        handleShareWhatsApp();
      }
    } else {
      handleShareWhatsApp();
    }
  };

  const handleCopyLink = () => {
    const textToCopy = qrMode === 'web' ? webPortalUrl : (campaign.upiId || webPortalUrl);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const modeLabel = qrMode === 'web' ? 'WebPortal' : 'UPI';
    const fileName = `${campaign.title.replace(/\s+/g, '_')}_${modeLabel}_QR.png`;
    downloadFileUniversal(qrDataUrl, fileName, 'image/png');
  };

  const handlePrintStandee = () => {
    const isKtl = campaign.category === 'kumtluang';
    const badgeTitle = isKtl ? 'KUMTLUANG BAWM • MEMBER PORTAL' : `${campaign.category.toUpperCase()} BAWM`;
    const instructions = isKtl
      ? '📱 Scan-in Member Roll & Category (Biak In Sakna, Mission, etc.) thlangin awlsam takin GPay / PhonePe / Paytm hmangin a pek theih e.'
      : '📱 Scan with any UPI App: Google Pay • PhonePe • Paytm • BHIM • Cred';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${campaign.title} - RonPay Standee</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; text-align: center; padding: 40px 20px; color: #0f172a; background: #ffffff; }
            .card { max-width: 380px; margin: 0 auto; border: 3px solid #1e1b4b; border-radius: 24px; padding: 30px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); background: #ffffff; }
            .logo { font-size: 26px; font-weight: 900; color: #1e1b4b; letter-spacing: -0.5px; }
            .badge { background: #dbeafe; color: #1e40af; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 900; display: inline-block; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bfdbfe; }
            .title { font-size: 19px; font-weight: 900; margin: 15px 0 4px 0; color: #0f172a; }
            .org { font-size: 12px; font-weight: bold; color: #4338ca; margin-bottom: 2px; }
            .loc { font-size: 11px; color: #64748b; margin-bottom: 12px; }
            .qr-box { background: #ffffff; padding: 14px; border-radius: 18px; border: 2px solid #e2e8f0; display: inline-block; margin: 8px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
            .qr-img { width: 220px; height: 220px; display: block; margin: 0 auto; }
            .upi-id { font-family: monospace; font-size: 12px; font-weight: bold; color: #1e1b4b; background: #f1f5f9; padding: 8px 12px; border-radius: 10px; margin-top: 10px; border: 1px solid #cbd5e1; word-break: break-all; }
            .portal-note { font-size: 11px; font-weight: 600; color: #1e3a8a; background: #eff6ff; padding: 10px; border-radius: 12px; margin-top: 12px; border: 1px solid #bfdbfe; line-height: 1.4; }
            .apps { font-size: 10px; font-weight: bold; color: #475569; margin-top: 12px; }
            .footer { font-size: 9.5px; color: #94a3b8; margin-top: 18px; border-top: 1px solid #f1f5f9; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">RONPAY</div>
            <div class="badge">${badgeTitle}</div>
            <div class="title">${campaign.title}</div>
            ${campaign.orgName ? `<div class="org">${campaign.orgName}</div>` : ''}
            <div class="loc">${campaign.location}</div>

            <div class="qr-box">
              <img class="qr-img" src="${qrDataUrl}" alt="QR" />
            </div>

            <div class="portal-note">${instructions}</div>
            
            <div class="upi-id">UPI: ${campaign.upiId || 'ronpay@axl'}</div>
            <div class="apps">Accepts GPay • PhonePe • Paytm • BHIM • RonPay</div>
            <div class="footer">RonPay Mizoram Community Platform • Digital Verified Standee</div>
          </div>
        </body>
      </html>
    `;
    printHtmlSafely(html, `${campaign.title} - RonPay Standee`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-200 relative space-y-3.5 my-auto shrink-0 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              {isKumtluang ? 'Kumtluang Web Portal & QR Share' : 'QR Code & Pekna Link Share'}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              {isKumtluang ? 'Member Roll & Dynamic Categories thlanna' : 'Bawm QR leh a pekna link share-na'}
            </p>
          </div>
        </div>

        {/* QR Mode Selector for Kumtluang / Generic */}
        {isKumtluang && (
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-bold gap-1 border border-slate-200">
            <button
              onClick={() => setQrMode('web')}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                qrMode === 'web'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Portal Link</span>
            </button>
            <button
              onClick={() => setQrMode('upi')}
              className={`flex-1 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                qrMode === 'upi'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Direct UPI QR</span>
            </button>
          </div>
        )}

        {/* QR Card Preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center space-y-2">
          <div className="flex justify-between items-center text-[10px]">
            <span className={`font-extrabold uppercase px-2 py-0.5 rounded-md ${
              isKumtluang ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {isKumtluang ? 'KUMTLUANG MEMBER PORTAL' : `${campaign.category.toUpperCase()} BAWM`}
            </span>
            <span className="text-slate-400 font-medium">Validity: {formatDateDDMMYYYY(campaign.validityDate)}</span>
          </div>

          <h4 className="font-black text-slate-900 text-sm leading-tight">{campaign.title}</h4>
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3 text-rose-500" /> {campaign.location}
          </p>

          {/* QR Display */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 inline-block shadow-2xs my-1">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Campaign QR" className="w-40 h-40 mx-auto object-contain" />
            ) : (
              <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                Generating QR...
              </div>
            )}
          </div>

          {isKumtluang && qrMode === 'web' ? (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-left space-y-1">
              <div className="flex items-center gap-1 text-[10.5px] font-bold text-blue-900">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Web Portal Features (Scan-a hawng tur):</span>
              </div>
              <ul className="text-[10px] text-blue-800 space-y-0.5 list-disc list-inside">
                <li>Member Roll / Phone No Search (E.g. 1460, BCM-8622)</li>
                <li>Biak In Sakna, Ramthianghlim, Mission category amount</li>
                <li>Direct GPay / PhonePe / Paytm payment</li>
              </ul>
            </div>
          ) : (
            <p className="text-[10px] font-mono font-bold text-indigo-700 bg-white py-1 px-2 rounded-lg border border-indigo-100 truncate">
              UPI ID: {campaign.upiId}
            </p>
          )}
        </div>

        {/* Share & Download Actions */}
        <div className="space-y-2 pt-1 text-xs">
          {/* Main Share Button */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleNativeShare}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
            >
              <Share2 className="w-4 h-4 text-indigo-200" />
              <span>Share Portal Link</span>
            </button>

            {/* WhatsApp Share */}
            <button
              onClick={handleShareWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
            >
              <MessageCircle className="w-4 h-4 text-emerald-200" />
              <span>WhatsApp</span>
            </button>
          </div>

          {/* Copy Link & Download Grid */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleCopyLink}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-slate-200 active:scale-98"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-600" />}
              <span>{copied ? 'Copied Link!' : 'Copy Portal URL'}</span>
            </button>

            <button
              onClick={handleDownloadQR}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold py-2.5 px-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer border border-indigo-200 active:scale-98"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Download QR</span>
            </button>
          </div>

          {/* Print Standee */}
          <button
            onClick={handlePrintStandee}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print Official QR Standee / Poster</span>
          </button>
        </div>
      </div>
    </div>
  );
};

