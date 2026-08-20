import React, { useRef } from 'react';
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
  MessageCircle
} from 'lucide-react';
import { Campaign } from '../types';
import { generateBawmQRDataUrl } from '../utils/qr';
import { formatDateDDMMYYYY } from '../utils/date';

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
  const [copied, setCopied] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState<string>('');

  React.useEffect(() => {
    if (campaign) {
      generateBawmQRDataUrl(campaign).then(url => setQrDataUrl(url));
    }
  }, [campaign]);

  if (!isOpen || !campaign) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?campaignId=${campaign.id}`;
  const shareText = `*${campaign.title}* - RonPay Bawm Donation\nBawm: ${campaign.category.toUpperCase()}\nLocation: ${campaign.location}\nUPI ID: ${campaign.upiId}\n\nDonation Link: ${shareUrl}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaign.title,
          text: shareText,
          url: shareUrl,
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
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  };

  const handleDownloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${campaign.title.replace(/\s+/g, '_')}_RonPay_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintStandee = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Khawngaihin popups allow rawh le.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${campaign.title} - RonPay Standee</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; text-align: center; padding: 40px 20px; color: #0f172a; }
            .card { max-width: 380px; margin: 0 auto; border: 3px solid #312e81; border-radius: 24px; padding: 30px 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            .logo { font-size: 24px; font-weight: 900; color: #312e81; letter-spacing: -0.5px; }
            .badge { background: #e0e7ff; color: #3730a3; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; display: inline-block; margin-top: 5px; text-transform: uppercase; }
            .title { font-size: 18px; font-weight: 800; margin: 15px 0 5px 0; color: #1e1b4b; }
            .loc { font-size: 12px; color: #64748b; margin-bottom: 15px; }
            .qr-box { background: #ffffff; padding: 15px; border-radius: 16px; border: 2px solid #e2e8f0; display: inline-block; margin: 10px 0; }
            .qr-img { width: 220px; height: 220px; display: block; }
            .upi-id { font-family: monospace; font-size: 13px; font-weight: bold; color: #4338ca; background: #f8fafc; padding: 8px 12px; border-radius: 8px; margin-top: 10px; border: 1px solid #e2e8f0; }
            .apps { font-size: 10px; color: #64748b; margin-top: 15px; }
            .footer { font-size: 9px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">RONPAY</div>
            <div class="badge">${campaign.category} BAWM</div>
            <div class="title">${campaign.title}</div>
            <div class="loc">${campaign.location}</div>

            <div class="qr-box">
              <img class="qr-img" src="${qrDataUrl}" alt="QR" />
            </div>

            <div class="upi-id">UPI: ${campaign.upiId}</div>
            <div class="apps">Accepts GPay • PhonePe • Paytm • BHIM • RonPay</div>
            <div class="footer">RonPay Mizoram Community Platform • Digital Verified Standee</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); window.close(); }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-3.5 backdrop-blur-xs animate-fadeIn text-slate-800">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-indigo-200 relative space-y-4">
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
            <h3 className="text-sm font-black text-slate-900">QR Code & Pekna Link Share</h3>
            <p className="text-[10px] text-slate-400 font-medium">Bawm QR leh a pekna link share-na</p>
          </div>
        </div>

        {/* QR Card Preview */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-center space-y-2">
          <div className="flex justify-between items-center text-[10px]">
            <span className="font-extrabold uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
              {campaign.category}
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

          <p className="text-[10px] font-mono font-bold text-indigo-700 bg-white py-1 px-2 rounded-lg border border-indigo-100 truncate">
            UPI ID: {campaign.upiId}
          </p>
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
              <span>Share QR / Link</span>
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
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
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
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 px-3 rounded-xl text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
          >
            <Printer className="w-3.5 h-3.5 text-amber-300" />
            <span>Print Official QR Standee / Poster</span>
          </button>
        </div>
      </div>
    </div>
  );
};
