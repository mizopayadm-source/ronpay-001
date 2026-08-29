import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Download, Share2, Globe, Smartphone, Check, Printer } from 'lucide-react';
import { Campaign } from '../types';
import { generateUPILink, generateCampaignWebLink, getCustomDomain } from '../utils/qr';

interface QRShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({ isOpen, onClose, campaign }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [qrType, setQrType] = useState<'direct_upi' | 'smart_link'>(() =>
    campaign?.category === 'kumtluang' ? 'smart_link' : 'direct_upi'
  );
  const [customDomainInput, setCustomDomainInput] = useState<string>('');

  React.useEffect(() => {
    setCustomDomainInput(getCustomDomain());
    if (campaign?.category === 'kumtluang') {
      setQrType('smart_link');
    }
  }, [isOpen, campaign]);

  if (!isOpen || !campaign) return null;

  const effectiveUpiId = campaign.targetUpiId || campaign.upiId || 'khatla.presbyterian@hdfc';
  const effectiveName = campaign.creatorName || campaign.orgName || campaign.title;

  const upiLink = generateUPILink({
    upiId: effectiveUpiId,
    name: effectiveName,
    note: `RonPay:${campaign.id}`
  });

  const smartWebLink = generateCampaignWebLink(campaign, customDomainInput);
  const activeQrValue = qrType === 'smart_link' ? smartWebLink : upiLink;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeQrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById('ronpay-share-qr-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 500;
      canvas.height = 500;
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 500, 500);
        ctx.drawImage(img, 25, 25, 450, 450);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `${campaign.title.replace(/\s+/g, '_')}_QR.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrintStandee = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Khawngaihin popup allow rawh le, Standee Print nan.');
      return;
    }

    const isKumtluang = campaign.category === 'kumtluang';
    const badgeText = isKumtluang ? 'KUMTLUANG BAWM • MEMBER PORTAL' : `${campaign.category.toUpperCase()} BAWM`;
    const noteText = isKumtluang 
      ? '📲 Scan-in Member Roll & Category (Pathian Ram, Mission, Building) thlan theih a ni.' 
      : '📱 Scan with any UPI App (Google Pay • PhonePe • Paytm • BHIM)';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <title>${campaign.title} - RonPay QR Standee</title>
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
              border-radius: 24px;
              padding: 24px 18px;
              width: 100%;
              max-width: 360px;
              margin: 0 auto;
              background: #ffffff;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
            }
            .badge {
              background: #e0e7ff;
              color: #3730a3;
              padding: 6px 14px;
              border-radius: 999px;
              font-weight: 800;
              font-size: 11px;
              display: inline-block;
              margin-bottom: 12px;
              letter-spacing: 0.3px;
              max-width: 100%;
              word-break: break-word;
            }
            .title {
              font-size: 20px;
              font-weight: 900;
              color: #1e1b4b;
              margin-bottom: 4px;
              line-height: 1.25;
              word-break: break-word;
              max-width: 100%;
            }
            .sub {
              font-size: 13px;
              color: #64748b;
              margin-bottom: 16px;
              font-weight: 500;
              max-width: 100%;
              word-break: break-word;
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
              margin: 0 auto;
            }
            .qr-box img {
              width: 100%;
              max-width: 226px;
              height: auto;
              aspect-ratio: 1 / 1;
              display: block;
              border-radius: 8px;
            }
            .upi {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 14px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
              word-break: break-all;
              background: #f8fafc;
              padding: 6px 12px;
              border-radius: 8px;
              border: 1px dashed #cbd5e1;
              max-width: 100%;
            }
            .note {
              font-size: 11px;
              font-weight: 700;
              color: #4338ca;
              margin-top: 12px;
              line-height: 1.4;
              background: #eff6ff;
              padding: 8px 12px;
              border-radius: 10px;
              border: 1px solid #bfdbfe;
              max-width: 100%;
            }
            .footer-branding {
              font-size: 9.5px;
              color: #94a3b8;
              margin-top: 16px;
              border-top: 1px solid #f1f5f9;
              padding-top: 8px;
              width: 100%;
              font-weight: 600;
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
            <div class="title">${campaign.title}</div>
            <div class="sub">${campaign.description || campaign.cause || 'Thawhlawm / Pekna'}</div>
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(activeQrValue)}" alt="QR Standee" />
            </div>
            <div class="upi">UPI ID: ${effectiveUpiId}</div>
            <div class="note">${noteText}</div>
            <div class="footer-branding">RonPay • Mizoram Community & Church QR Portal</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl text-white space-y-4 max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {campaign.category} QR
            </span>
            <h3 className="text-base sm:text-lg font-bold text-slate-100 mt-1 truncate max-w-[240px] sm:max-w-xs">
              {campaign.title}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Mode Switch */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setQrType('smart_link')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              qrType === 'smart_link' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Portal Link</span>
          </button>
          <button
            onClick={() => setQrType('direct_upi')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              qrType === 'direct_upi' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Direct UPI QR</span>
          </button>
        </div>

        {/* QR Code Canvas */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner">
          <QRCodeSVG 
            id="ronpay-share-qr-svg"
            value={activeQrValue} 
            size={220} 
            level="M" 
            includeMargin 
            fgColor="#000000"
            bgColor="#ffffff"
            className="w-48 h-48 sm:w-52 sm:h-52"
          />
          <p className="text-[11px] font-bold text-slate-800 mt-2 font-mono break-all text-center">
            {qrType === 'smart_link' ? '🌐 WEB PORTAL LINK' : `UPI: ${effectiveUpiId}`}
          </p>
        </div>

        {/* Actions Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs font-bold">
          <button
            onClick={handleCopyLink}
            className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-700 cursor-pointer text-center"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="text-[11px]">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
          <button
            onClick={handleDownloadQR}
            className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-700 cursor-pointer text-center"
            title="Download PNG QR Code"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span className="text-[11px]">Save PNG</span>
          </button>
          <button
            onClick={handlePrintStandee}
            className="py-2.5 px-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex flex-col sm:flex-row items-center justify-center gap-1.5 shadow-md cursor-pointer text-center"
          >
            <Printer className="w-4 h-4" />
            <span className="text-[11px]">Print Standee</span>
          </button>
        </div>
      </div>
    </div>
  );
};

