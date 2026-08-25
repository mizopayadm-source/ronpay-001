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
    note: `RonPay ${campaign.category.toUpperCase()} - ${campaign.title}`
  });

  const smartWebLink = generateCampaignWebLink(campaign.id, customDomainInput);
  const activeQrValue = qrType === 'smart_link' ? smartWebLink : upiLink;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeQrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintStandee = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${campaign.title} - RonPay QR Standee</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; text-align: center; padding: 40px; }
            .card { border: 3px solid #1e1b4b; border-radius: 24px; padding: 30px; max-width: 420px; margin: 0 auto; }
            .title { font-size: 24px; font-weight: 800; color: #1e1b4b; margin-bottom: 8px; }
            .sub { font-size: 14px; color: #64748b; margin-bottom: 20px; }
            .qr-box { background: white; padding: 20px; border-radius: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .badge { background: #e0e7ff; color: #3730a3; padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 12px; display: inline-block; margin-bottom: 15px; }
            .upi { font-size: 14px; font-weight: 600; color: #0f172a; margin-top: 15px; font-family: monospace; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">${campaign.category.toUpperCase()} BAWM • MEMBER PORTAL</div>
            <div class="title">${campaign.title}</div>
            <div class="sub">${campaign.description || campaign.cause || 'Thawhlawm / Pekna'}</div>
            <div class="qr-box">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(activeQrValue)}" width="240" height="240" />
            </div>
            <div class="upi">UPI ID: ${effectiveUpiId}</div>
            ${campaign.category === 'kumtluang' ? '<div style="font-size:12px;font-weight:bold;color:#4338ca;margin-top:10px;">📲 Scan-in Member Roll & Category (Pathian Ram, Mission, Building) thlan theih a ni.</div>' : ''}
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-6 shadow-2xl text-white space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {campaign.category} QR
            </span>
            <h3 className="text-lg font-bold text-slate-100 mt-1">{campaign.title}</h3>
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
        <div className="bg-white p-5 rounded-2xl flex flex-col items-center justify-center shadow-inner">
          <QRCodeSVG value={activeQrValue} size={200} level="H" includeMargin />
          <p className="text-[11px] font-bold text-slate-800 mt-2 font-mono">
            {qrType === 'smart_link' ? '🌐 WEB PORTAL LINK' : `UPI: ${effectiveUpiId}`}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <button
            onClick={handleCopyLink}
            className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
          <button
            onClick={handlePrintStandee}
            className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Standee</span>
          </button>
        </div>
      </div>
    </div>
  );
};
