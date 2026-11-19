import React, { useState, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  Copy,
  Download,
  Globe,
  Smartphone,
  Check,
  Printer,
  Share2,
  Image as ImageIcon,
  Calendar,
  MapPin,
  Loader2
} from 'lucide-react';
import { Campaign } from '../types';
import { generateUPILink, generateCampaignWebLink, generateQRCodeDataUrl } from '../utils/qr';
import {
  getCampaignQRCardMeta,
  renderBrandedQRCardPng,
  downloadRenderedQRCard,
  shareRenderedQRCard,
  buildStandeePrintHtml
} from '../utils/qrCardGenerator';

interface QRShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign | null;
}

export const QRShareModal: React.FC<QRShareModalProps> = ({ isOpen, onClose, campaign }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string>('');
  const [includePhotoAndSummary, setIncludePhotoAndSummary] = useState<boolean>(true);
  const [qrType, setQrType] = useState<'direct_upi' | 'smart_link'>('smart_link');

  React.useEffect(() => {
    if (isOpen && campaign) {
      setQrType('smart_link');
      setShareFeedback('');
    }
  }, [isOpen, campaign]);

  const cardMeta = useMemo(() => {
    if (!campaign) return null;
    return getCampaignQRCardMeta(campaign, qrType);
  }, [campaign, qrType]);

  if (!isOpen || !campaign || !cardMeta) return null;

  const effectiveUpiId = campaign.targetUpiId || campaign.upiId || 'khatla.presbyterian@hdfc';
  const effectiveName = campaign.creatorName || campaign.orgName || campaign.title;

  const upiLink = generateUPILink({
    upiId: effectiveUpiId,
    name: effectiveName,
    note: `RonPay:${campaign.id}`
  });

  const smartWebLink = generateCampaignWebLink(campaign);
  const activeQrValue = qrType === 'smart_link' ? smartWebLink : upiLink;

  const hasPhotoOrSummary = Boolean(campaign.imageUrl || cardMeta.summaryText);
  const showPhoto = includePhotoAndSummary && Boolean(campaign.imageUrl);
  const showSummary = includePhotoAndSummary && Boolean(cardMeta.summaryText);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeQrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQR = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const rendered = await renderBrandedQRCardPng({
        campaign,
        qrValue: activeQrValue,
        qrType,
        includePhotoAndSummary,
      });
      downloadRenderedQRCard(rendered);
      setShareFeedback('QR Card (.png) save a ni ta e!');
      setTimeout(() => setShareFeedback(''), 2500);
    } catch (err) {
      console.error('QR Card PNG export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareCard = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const rendered = await renderBrandedQRCardPng({
        campaign,
        qrValue: activeQrValue,
        qrType,
        includePhotoAndSummary,
      });
      const result = await shareRenderedQRCard(rendered, smartWebLink);
      setShareFeedback(
        result === 'shared'
          ? 'QR Card share fel a ni!'
          : 'QR Card save a ni a, link copy tel a ni e!'
      );
      setTimeout(() => setShareFeedback(''), 2800);
    } catch (err) {
      console.error('QR Card share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintStandee = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setShareFeedback('Standee Print nan popup allow rawh le.');
      setTimeout(() => setShareFeedback(''), 3000);
      return;
    }

    const qrImgSrc = await generateQRCodeDataUrl(activeQrValue);
    const html = buildStandeePrintHtml({
      campaign,
      qrImageSrc: qrImgSrc,
      qrType,
      includePhotoAndSummary,
    });
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-md rounded-3xl p-4 sm:p-5 shadow-2xl text-white space-y-3.5 max-h-[95vh] overflow-y-auto">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {cardMeta.categoryLabel} QR
            </span>
            <h3 className="text-sm sm:text-base font-black text-slate-100 mt-1 truncate">
              {cardMeta.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR Mode Switch */}
        <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setQrType('smart_link')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              qrType === 'smart_link'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Portal Link</span>
          </button>
          <button
            type="button"
            onClick={() => setQrType('direct_upi')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              qrType === 'direct_upi'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Direct UPI QR</span>
          </button>
        </div>

        {/* Optional Photo & Summary Toggle */}
        {hasPhotoOrSummary && (
          <label className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/70 border border-slate-700/80 cursor-pointer select-none">
            <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>Thlalak &amp; Summary telh rawh</span>
            </span>
            <input
              type="checkbox"
              checked={includePhotoAndSummary}
              onChange={(e) => setIncludePhotoAndSummary(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
            />
          </label>
        )}

        {/* LIVE WYSIWYG BRANDED QR CARD PREVIEW (Matches Downloaded PNG) */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200 text-slate-900">
          {/* Card Color-Coded Header */}
          <div
            className="relative overflow-hidden px-4 py-3.5 text-white flex items-center gap-3"
            style={{
              background: `linear-gradient(135deg, ${cardMeta.theme.headerBg}, ${cardMeta.theme.headerBgEnd})`,
            }}
          >
            {campaign.category === 'ralna' && (
              <div className="absolute top-0 right-0 overflow-hidden rounded-bl-xl shadow-xs border-l border-b border-white/40 z-10">
                <div className="flex h-3.5 w-16">
                  <div className="flex-1 bg-black" title="YMA Flag - Dum (Black)" />
                  <div className="flex-1 bg-white" title="YMA Flag - Var (White)" />
                  <div className="flex-1 bg-red-600" title="YMA Flag - Sen (Vibrant Red)" />
                </div>
              </div>
            )}
            {showPhoto && campaign.imageUrl && (
              <img
                src={campaign.imageUrl}
                alt={cardMeta.title}
                referrerPolicy="no-referrer"
                className="w-13 h-13 rounded-xl object-cover border-2 border-white/70 bg-white shrink-0 shadow-sm"
              />
            )}
            <div className="min-w-0 flex-1 text-left">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span
                  className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: cardMeta.theme.badgeBg,
                    color: cardMeta.theme.badgeText,
                  }}
                >
                  {cardMeta.categoryLabel}
                </span>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-white/15 text-white border border-white/25">
                  {qrType === 'smart_link' ? 'WEB PORTAL' : 'DIRECT UPI'}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-black leading-snug text-white line-clamp-2">
                {cardMeta.title}
              </h4>
              <p className="text-[10.5px] text-white/85 font-semibold flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0 opacity-80" />
                <span className="truncate">{cardMeta.location}</span>
              </p>
            </div>
          </div>

          {/* Card Body: Optional 2-Line Summary + Crisp QR + Label + Validity */}
          <div className="px-4 pt-3.5 pb-3.5 flex flex-col items-center text-center space-y-2.5">
            {showSummary && (
              <p
                className="w-full text-[11px] font-semibold text-slate-700 leading-snug px-3 py-2 rounded-xl border line-clamp-2"
                style={{
                  backgroundColor: cardMeta.theme.softBg,
                  borderColor: cardMeta.theme.softBorder,
                }}
              >
                {cardMeta.summaryText}
              </p>
            )}

            {/* Clean White QR Frame */}
            <div className="bg-white p-2.5 rounded-2xl border-2 border-slate-200 shadow-xs inline-flex items-center justify-center">
              <QRCodeSVG
                id="ronpay-share-qr-svg"
                value={activeQrValue}
                size={196}
                level="M"
                includeMargin
                fgColor="#0f172a"
                bgColor="#ffffff"
                className="w-44 h-44 sm:w-48 sm:h-48"
              />
            </div>

            {/* Identification Label + UPI ID + Valid Upto + Scan Guide */}
            <div className="w-full space-y-1.5 pt-0.5">
              <p className="text-xs sm:text-[13px] font-black text-slate-900 leading-tight px-1">
                {cardMeta.modeLine}
              </p>

              {qrType === 'direct_upi' && effectiveUpiId && (
                <div className="inline-block text-[10.5px] font-bold font-mono text-slate-700 bg-slate-50 border border-dashed border-slate-300 px-2.5 py-0.5 rounded-lg break-all">
                  UPI ID: {effectiveUpiId}
                </div>
              )}

              <div>
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full border"
                  style={{
                    backgroundColor: cardMeta.theme.softBg,
                    borderColor: cardMeta.theme.softBorder,
                    color: cardMeta.theme.accentHex,
                  }}
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{cardMeta.validityText}</span>
                </span>
              </div>

              <p className="text-[10.5px] font-bold text-slate-500">
                {cardMeta.scanGuide}
              </p>

              {qrType === 'smart_link' && (
                <p className="text-[9px] text-slate-400 font-mono truncate max-w-full px-2">
                  {smartWebLink}
                </p>
              )}
            </div>
          </div>

          {/* Official Brand Footer: RonPay Logo + "RonPay - A Digital Payment Platform" */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-2">
              <img
                src="/ronpay-logo.png"
                alt="RonPay"
                className="w-5 h-5 rounded-md object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-[11px] font-black text-slate-900 tracking-tight">
                RonPay - A Digital Payment Platform
              </span>
            </div>
            <p className="text-[9px] font-semibold text-slate-500 mt-0.5">
              www.ronpay.app • Verified Community &amp; Church QR Portal
            </p>
          </div>
        </div>

        {/* Feedback Toast */}
        {shareFeedback && (
          <div className="text-center text-[11px] font-extrabold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-xl py-1.5 px-3">
            ✓ {shareFeedback}
          </div>
        )}

        {/* Primary & Secondary Action Buttons */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadQR}
            className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition"
            title="Download Branded PNG QR Card"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Save PNG Card</span>
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleShareCard}
            className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white flex items-center justify-center gap-1.5 shadow-md cursor-pointer active:scale-95 transition"
            title="Share QR Card to WhatsApp / Apps"
          >
            <Share2 className="w-4 h-4" />
            <span>Share Card</span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span className="text-[11px]">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrintStandee}
            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer transition"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px]">Print Standee</span>
          </button>
        </div>
      </div>
    </div>
  );
};
