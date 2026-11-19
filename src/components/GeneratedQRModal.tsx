import React, { useEffect, useState, useMemo } from 'react';
import {
  X,
  Hourglass,
  Download,
  Printer,
  Share2,
  Clock,
  Globe,
  Image as ImageIcon,
  Calendar,
  MapPin,
  Loader2
} from 'lucide-react';
import { Campaign } from '../types';
import { generateQRCodeDataUrl, getCampaignWebPortalUrl } from '../utils/qr';
import {
  getCampaignQRCardMeta,
  renderBrandedQRCardPng,
  downloadRenderedQRCard,
  shareRenderedQRCard,
  buildStandeePrintHtml
} from '../utils/qrCardGenerator';

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
  const [includePhotoAndSummary, setIncludePhotoAndSummary] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const portalUrl = useMemo(
    () => (campaign ? getCampaignWebPortalUrl(campaign) : ''),
    [campaign]
  );

  const cardMeta = useMemo(
    () => (campaign ? getCampaignQRCardMeta(campaign, 'smart_link') : null),
    [campaign]
  );

  useEffect(() => {
    if (campaign && isOpen && portalUrl) {
      generateQRCodeDataUrl(portalUrl).then((url) => {
        setQrDataUrl(url);
      });
      setFeedbackMsg('');
    }
  }, [campaign, isOpen, portalUrl]);

  if (!isOpen || !campaign || !cardMeta) return null;

  const isKumtluang = campaign.category === 'kumtluang';
  const hasPhotoOrSummary = Boolean(campaign.imageUrl || cardMeta.summaryText);
  const showPhoto = includePhotoAndSummary && Boolean(campaign.imageUrl);
  const showSummary = includePhotoAndSummary && Boolean(cardMeta.summaryText);
  const statusLabel =
    campaign.status === 'pending_approval' ? 'STATUS: WAITING FOR APPROVAL' : undefined;

  const handleDownloadPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const rendered = await renderBrandedQRCardPng({
        campaign,
        qrValue: portalUrl,
        qrType: 'smart_link',
        includePhotoAndSummary,
        statusBadge: statusLabel,
      });
      downloadRenderedQRCard(rendered);
      setFeedbackMsg('QR Card (.png) save a ni ta e!');
      setTimeout(() => setFeedbackMsg(''), 2500);
    } catch (err) {
      console.error('Generated QR PNG export error:', err);
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
        qrValue: portalUrl,
        qrType: 'smart_link',
        includePhotoAndSummary,
        statusBadge: statusLabel,
      });
      const result = await shareRenderedQRCard(rendered, portalUrl);
      setFeedbackMsg(
        result === 'shared'
          ? 'QR Card share fel a ni!'
          : 'QR Card save a ni a, link copy tel a ni e!'
      );
      setTimeout(() => setFeedbackMsg(''), 2800);
    } catch (err) {
      console.error('Generated QR Share error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintPDF = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setFeedbackMsg('Standee Print nan popup allow rawh le.');
      setTimeout(() => setFeedbackMsg(''), 3000);
      return;
    }

    const qrImgSrc = qrDataUrl || (await generateQRCodeDataUrl(portalUrl));
    const html = buildStandeePrintHtml({
      campaign,
      qrImageSrc: qrImgSrc,
      qrType: 'smart_link',
      includePhotoAndSummary,
      statusBadge: statusLabel,
    });
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/65 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-md rounded-3xl p-4 sm:p-5 text-center space-y-3 shadow-2xl border border-slate-200 relative text-slate-900 my-auto shrink-0 max-h-[94vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Status Header */}
        <div className="flex items-center justify-center gap-2 pt-0.5">
          <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 shrink-0">
            <Hourglass className="w-4 h-4 animate-spin" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-amber-800 font-black bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> Waiting for Approval
            </span>
            {isKumtluang && (
              <span className="text-[10px] text-blue-800 font-black bg-blue-100 border border-blue-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Globe className="w-3 h-3" /> Member Portal
              </span>
            )}
          </div>
        </div>

        {/* Optional Photo & Summary Toggle */}
        {hasPhotoOrSummary && (
          <label className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer select-none text-left">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Thlalak &amp; Summary telh rawh</span>
            </span>
            <input
              type="checkbox"
              checked={includePhotoAndSummary}
              onChange={(e) => setIncludePhotoAndSummary(e.target.checked)}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </label>
        )}

        {/* LIVE WYSIWYG BRANDED QR CARD PREVIEW */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-md border border-slate-200 text-slate-900 text-left">
          {/* Card Color-Coded Header */}
          <div
            className="relative overflow-hidden px-4 py-3 text-white flex items-center gap-3"
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
                className="w-12 h-12 rounded-xl object-cover border-2 border-white/70 bg-white shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
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
                  WEB PORTAL
                </span>
              </div>
              <h3 className="text-sm font-black text-white leading-snug line-clamp-2">
                {cardMeta.title}
              </h3>
              <p className="text-[10px] text-white/85 font-semibold flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 shrink-0 opacity-80" />
                <span className="truncate">{cardMeta.location}</span>
              </p>
            </div>
          </div>

          {/* Card Body */}
          <div className="px-4 py-3 flex flex-col items-center text-center space-y-2">
            {showSummary && (
              <p
                className="w-full text-[11px] font-semibold text-slate-700 leading-snug px-3 py-1.5 rounded-xl border line-clamp-2"
                style={{
                  backgroundColor: cardMeta.theme.softBg,
                  borderColor: cardMeta.theme.softBorder,
                }}
              >
                {cardMeta.summaryText}
              </p>
            )}

            <div className="p-2.5 bg-white border-2 border-slate-200 rounded-2xl flex justify-center items-center shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Generated QR"
                  className="w-40 h-40 object-contain rounded-lg"
                />
              ) : (
                <div className="w-40 h-40 flex items-center justify-center text-slate-400 text-xs">
                  Generating QR Code...
                </div>
              )}
            </div>

            <div className="w-full space-y-1">
              <p className="text-xs font-black text-slate-900 leading-tight">
                {cardMeta.modeLine}
              </p>
              <div>
                <span
                  className="inline-flex items-center gap-1 text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-full border"
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
              <p className="text-[10px] font-bold text-slate-500">
                {cardMeta.scanGuide}
              </p>
            </div>
          </div>

          {/* RonPay Official Brand Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <img
                src="/ronpay-logo.png"
                alt="RonPay"
                className="w-4 h-4 rounded-sm object-contain shrink-0"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-[10.5px] font-black text-slate-900 tracking-tight">
                RonPay - A Digital Payment Platform
              </span>
            </div>
            <p className="text-[8.5px] font-semibold text-slate-500 mt-0.5">
              www.ronpay.app • Verified Community &amp; Church QR Portal
            </p>
          </div>
        </div>

        {feedbackMsg && (
          <div className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-1.5 px-3">
            ✓ {feedbackMsg}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadPNG}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold py-2.5 px-2 rounded-xl text-[11px] transition flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
          >
            {isExporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>Save PNG</span>
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={handleShareCard}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-2.5 px-2 rounded-xl text-[11px] transition flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPDF}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-2 rounded-xl text-[11px] transition flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Standee</span>
          </button>
        </div>

        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
          {isKumtluang
            ? 'Kumtluang Member Portal QR siam a ni ta e. User-te scan hian Member Roll & Dynamic Categories thlanna a inhawng ang.'
            : 'QR Code generate a ni ta e. He QR code scan a nih hian "Waiting for Approval" tiin a lang rih ang.'}
        </p>

        <button
          type="button"
          onClick={onGoHome}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
        >
          Close &amp; Back to Home
        </button>
      </div>
    </div>
  );
};
