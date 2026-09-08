import React, { useEffect, useState } from 'react';
import { 
  X, 
  Hourglass, 
  Download, 
  Printer, 
  Share2, 
  CheckCircle2,
  Clock,
  Sparkles,
  Globe
} from 'lucide-react';
import { Campaign } from '../types';
import { generateQRCodeDataUrl, getCampaignWebPortalUrl, generateUPILink } from '../utils/qr';

interface GeneratedQRModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  onClose: () => void;
  onGoHome: () => void;
}

export const GeneratedQRModal: React.FC<GeneratedQRModalProps> = ({
  isOpen,
  campaign,
  onClose,
  onGoHome,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (campaign && isOpen) {
      const portalUrl = getCampaignWebPortalUrl(campaign);
      generateQRCodeDataUrl(portalUrl).then(url => {
        setQrDataUrl(url);
      });
    }
  }, [campaign, isOpen]);

  if (!isOpen || !campaign) return null;

  const isKumtluang = campaign.category === 'kumtluang';

  const handleDownloadPNG = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `${campaign.title.replace(/\s+/g, '_')}_RonPay_QR.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print QR Code.');
      return;
    }

    const badgeText = isKumtluang ? 'KUMTLUANG BAWM • MEMBER PORTAL' : `${campaign.category.toUpperCase()} BAWM`;
    const instructions = isKumtluang
      ? '📱 Scan-in Member Roll & Category (Biak In Sakna, Mission, etc.) thlangin awlsam takin GPay / PhonePe / Paytm hmangin a pek theih e.'
      : '📱 Scan with any UPI App: Google Pay • PhonePe • Paytm • BHIM • Cred';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <title>RonPay QR - ${campaign.title}</title>
          <style>
            *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              text-align: center;
              padding: 16px 12px;
              background: #f1f5f9;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              color: #0f172a;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .action-bar {
              display: flex;
              gap: 10px;
              margin-bottom: 16px;
              width: 100%;
              max-width: 360px;
              justify-content: center;
            }
            .btn-action {
              flex: 1;
              background: #4f46e5;
              color: #ffffff;
              border: none;
              padding: 10px 14px;
              border-radius: 12px;
              font-weight: 800;
              font-size: 13px;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
            }
            .btn-close {
              background: #e2e8f0;
              color: #334155;
              border: none;
              padding: 10px 16px;
              border-radius: 12px;
              font-weight: 700;
              font-size: 13px;
              cursor: pointer;
            }
            .card {
              border: 3px solid #1e1b4b;
              padding: 24px 18px;
              border-radius: 24px;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              width: 100%;
              max-width: 360px;
              box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);
              background: #ffffff;
              margin: 0 auto;
            }
            .badge {
              font-size: 11px;
              color: #1e40af;
              background: #dbeafe;
              border: 1px solid #bfdbfe;
              padding: 5px 14px;
              border-radius: 20px;
              font-weight: 900;
              display: inline-block;
              text-transform: uppercase;
              margin-bottom: 8px;
              max-width: 100%;
              word-break: break-word;
            }
            .status-badge {
              font-size: 10px;
              color: #92400e;
              background: #fef3c7;
              border: 1px solid #fde68a;
              padding: 3px 10px;
              border-radius: 12px;
              font-weight: bold;
              display: inline-block;
              margin-bottom: 8px;
            }
            h2 {
              margin: 4px 0;
              font-size: 20px;
              font-weight: 900;
              color: #0f172a;
              line-height: 1.25;
              word-break: break-word;
            }
            .meta {
              font-size: 12px;
              color: #475569;
              margin: 6px 0;
              word-break: break-all;
            }
            .qr-box {
              background: #ffffff;
              padding: 12px;
              border-radius: 18px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
              border: 1px solid #e2e8f0;
              width: 100%;
              max-width: 250px;
              margin: 10px auto;
            }
            .qr-box img {
              width: 100%;
              max-width: 226px;
              height: auto;
              aspect-ratio: 1 / 1;
              display: block;
              border-radius: 8px;
            }
            .portal-note {
              font-size: 11px;
              font-weight: 600;
              color: #1e3a8a;
              background: #eff6ff;
              padding: 10px;
              border-radius: 12px;
              margin-top: 10px;
              border: 1px solid #bfdbfe;
              line-height: 1.4;
              text-align: center;
              width: 100%;
            }
            .footer {
              font-size: 9.5px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 10px;
              margin-top: 15px;
              width: 100%;
            }
            @media print {
              body { background: #ffffff; padding: 0; }
              .action-bar { display: none !important; }
              .card { box-shadow: none; border: 3px solid #1e1b4b; max-width: 100%; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="action-bar">
            <button class="btn-action" onclick="window.print()">🖨️ Print / Save PDF</button>
            <button class="btn-close" onclick="window.close()">✖ Close</button>
          </div>
          <div class="card">
            <div class="badge">${badgeText}</div>
            <div class="status-badge">STATUS: WAITING FOR APPROVAL</div>
            <h2>${campaign.title}</h2>
            <div class="meta">Location: <b>${campaign.location || 'Mizoram'}</b></div>
            <div class="qr-box">
              <img src="${qrDataUrl}" alt="RonPay QR" />
            </div>
            <div class="portal-note">${instructions}</div>
            <div class="meta">UPI ID: <b>${campaign.upiId}</b></div>
            <div class="footer">Powered by RonPay - Community & Church Payment System (Mizoram)</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 text-center space-y-3.5 shadow-2xl border border-slate-200 relative text-slate-900 my-auto shrink-0 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Status Icon */}
        <div className="w-11 h-11 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto text-lg border border-amber-200 shadow-xs">
          <Hourglass className="w-5 h-5 animate-spin" />
        </div>

        {/* Title */}
        <div>
          <h3 className="text-sm font-black text-slate-900 leading-tight">
            {campaign.title}
          </h3>
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <span className="text-[10px] text-amber-800 font-black bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-2xs">
              <Clock className="w-3 h-3" /> Waiting for Approval
            </span>
            {isKumtluang && (
              <span className="text-[10px] text-blue-800 font-black bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Globe className="w-3 h-3" /> Member Portal
              </span>
            )}
          </div>
        </div>

        {/* QR Code Container */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-center items-center shadow-inner">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Generated QR"
              className="w-44 h-44 object-contain rounded-xl shadow-xs"
            />
          ) : (
            <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={handleDownloadPNG}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-2 rounded-xl text-[11px] transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Download className="w-3.5 h-3.5" /> Image (.png)
          </button>
          <button
            onClick={handlePrintPDF}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-2 rounded-xl text-[11px] transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" /> Print Standee
          </button>
        </div>

        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
          {isKumtluang 
            ? 'Kumtluang Member Portal QR siam a ni ta e. User-te scan hian Member Roll & Dynamic Categories thlanna a inhawng ang.'
            : 'QR Code generate a ni ta e. He QR code scan a nih hian "Waiting for Approval" tiin a lang rih ang.'}
        </p>

        <button
          onClick={onGoHome}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
        >
          Close & Back to Home
        </button>
      </div>
    </div>
  );
};

