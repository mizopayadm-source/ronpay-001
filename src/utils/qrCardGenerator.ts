import QRCode from 'qrcode';
import { Campaign } from '../types';
import { formatDateDDMMYYYY } from './date';

export type QRCardMode = 'smart_link' | 'direct_upi';

export interface QRCardTheme {
  headerBg: string;
  headerBgEnd: string;
  badgeBg: string;
  badgeText: string;
  accentHex: string;
  softBg: string;
  softBorder: string;
  categoryLabel: string;
}

export interface QRCardMeta {
  title: string;
  location: string;
  categoryLabel: string;
  modeLabel: string;
  shortModeTag: string;
  modeLine: string;
  validityText: string;
  scanGuide: string;
  summaryText: string;
  upiId: string;
  fileName: string;
  theme: QRCardTheme;
}

const CATEGORY_THEMES: Record<string, QRCardTheme> = {
  ralna: {
    headerBg: '#1e293b',
    headerBgEnd: '#7f1d1d',
    badgeBg: '#fee2e2',
    badgeText: '#991b1b',
    accentHex: '#b91c1c',
    softBg: '#fef2f2',
    softBorder: '#fecaca',
    categoryLabel: 'RALNA BAWM',
  },
  khawlsak: {
    headerBg: '#064e3b',
    headerBgEnd: '#047857',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    accentHex: '#059669',
    softBg: '#ecfdf5',
    softBorder: '#a7f3d0',
    categoryLabel: 'KHAWLSAK BAWM',
  },
  rikrum: {
    headerBg: '#881337',
    headerBgEnd: '#be123c',
    badgeBg: '#ffe4e6',
    badgeText: '#9f1239',
    accentHex: '#e11d48',
    softBg: '#fff1f2',
    softBorder: '#fecdd3',
    categoryLabel: 'RIKRUM BAWM',
  },
  kumtluang: {
    headerBg: '#1e1b4b',
    headerBgEnd: '#312e81',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    accentHex: '#4338ca',
    softBg: '#eef2ff',
    softBorder: '#c7d2fe',
    categoryLabel: 'KUMTLUANG BAWM',
  },
  others: {
    headerBg: '#3b0764',
    headerBgEnd: '#6d28d9',
    badgeBg: '#f3e8ff',
    badgeText: '#6b21a8',
    accentHex: '#7c3aed',
    softBg: '#faf5ff',
    softBorder: '#e9d5ff',
    categoryLabel: 'RONPAY BAWM',
  },
};

const sanitizeFilePart = (raw: string): string =>
  (raw || 'RonPay_Bawm')
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 48) || 'RonPay_Bawm';

export const getCampaignQRCardMeta = (campaign: Campaign, qrType: QRCardMode): QRCardMeta => {
  const theme = CATEGORY_THEMES[campaign.category] || CATEGORY_THEMES.others;
  const title = (campaign.title || campaign.orgName || 'RonPay Bawm').trim();
  const location = [campaign.location, campaign.section].filter(Boolean).join(' • ') || 'Mizoram';
  const upiId = (campaign.targetUpiId || campaign.upiId || '').trim();

  const isWebLink = qrType === 'smart_link';
  const modeLabel = isWebLink ? 'Web Portal Link' : 'Direct UPI';
  const shortModeTag = isWebLink ? 'WebLink' : 'UPI';
  const modeLine = `${title} • ${modeLabel}`;

  let validityText = 'Active Bawm';
  let validityFileTag = '';
  if (campaign.category === 'kumtluang') {
    validityText = 'Kumtluang • Permanent';
    validityFileTag = 'Permanent';
  } else if (campaign.validityDate) {
    const formatted = formatDateDDMMYYYY(campaign.validityDate);
    if (formatted) {
      validityText = `Valid Upto: ${formatted}`;
      validityFileTag = `Valid_${formatted.replace(/\//g, '-')}`;
    }
  }

  const scanGuide = isWebLink
    ? 'Phone Camera / Google Lens-in Scan Rawh'
    : 'GPay / PhonePe / Paytm / BHIM-in Scan Rawh';

  let summaryParts: string[] = [];
  if (campaign.category === 'ralna') {
    if (campaign.mitthiHming) summaryParts.push(`Mitthi: ${campaign.mitthiHming}`);
    if (campaign.vuiHun) summaryParts.push(`Vui hun: ${campaign.vuiHun}`);
    if (campaign.cause) summaryParts.push(campaign.cause);
    else if (campaign.description) summaryParts.push(campaign.description);
  } else {
    if (campaign.cause) summaryParts.push(campaign.cause);
    else if (campaign.description) summaryParts.push(campaign.description);
    else if (campaign.subTitle) summaryParts.push(campaign.subTitle);
  }
  const summaryText = summaryParts
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' • ')
    .replace(/\s+/g, ' ');

  const titlePart = sanitizeFilePart(title);
  const fileName = validityFileTag
    ? `${titlePart}_${shortModeTag}_${validityFileTag}.png`
    : `${titlePart}_${shortModeTag}_QR.png`;

  return {
    title,
    location,
    categoryLabel: theme.categoryLabel,
    modeLabel,
    shortModeTag,
    modeLine,
    validityText,
    scanGuide,
    summaryText,
    upiId,
    fileName,
    theme,
  };
};

const loadImageSafe = (src?: string): Promise<HTMLImageElement | null> => {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const isSameOriginOrData =
      src.startsWith('data:') ||
      src.startsWith('/') ||
      (typeof window !== 'undefined' && src.startsWith(window.location.origin));
    if (!isSameOriginOrData) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), 3500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const wrapLines = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] => {
  const clean = (text || '').trim().replace(/\s+/g, ' ');
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      current = testLine;
    } else {
      if (current) {
        lines.push(current);
        current = word;
      } else {
        // Single long word truncation
        let cut = word;
        while (cut.length > 1 && ctx.measureText(`${cut}...`).width > maxWidth) {
          cut = cut.slice(0, -1);
        }
        lines.push(`${cut}...`);
        current = '';
      }
      if (lines.length === maxLines) {
        break;
      }
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  // If original text had more content than fits in maxLines, add ellipsis to last line
  const joinedCount = lines.join(' ').length;
  if (lines.length === maxLines && joinedCount < clean.length) {
    let last = lines[maxLines - 1].replace(/\.+$/, '');
    while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last.trimEnd()}...`;
  }

  return lines;
};

export interface RenderQRCardOptions {
  campaign: Campaign;
  qrValue: string;
  qrType: QRCardMode;
  includePhotoAndSummary?: boolean;
  statusBadge?: string;
}

export interface RenderedQRCard {
  dataUrl: string;
  blob: Blob | null;
  fileName: string;
  meta: QRCardMeta;
}

export const renderBrandedQRCardPng = async (
  options: RenderQRCardOptions
): Promise<RenderedQRCard> => {
  const {
    campaign,
    qrValue,
    qrType,
    includePhotoAndSummary = true,
    statusBadge,
  } = options;

  const meta = getCampaignQRCardMeta(campaign, qrType);
  const fontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const monoStack = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

  // Generate high-res QR code image dataUrl first
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    width: 520,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });

  const [qrImg, campaignPhoto, ronpayLogo] = await Promise.all([
    loadImageSafe(qrDataUrl),
    includePhotoAndSummary && campaign.imageUrl ? loadImageSafe(campaign.imageUrl) : Promise.resolve(null),
    loadImageSafe('/ronpay-logo.png'),
  ]);

  // Measure layout heights dynamically so there is zero clipped text or awkward whitespace
  const W = 900;
  const padX = 56;
  const innerW = W - padX * 2;

  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d')!;

  const hasPhoto = Boolean(campaignPhoto);
  const photoSize = 112;
  const headerTextX = hasPhoto ? padX + photoSize + 24 : padX;
  const headerTextW = hasPhoto ? innerW - photoSize - 24 : innerW;

  mctx.font = `900 36px ${fontStack}`;
  const titleLines = wrapLines(mctx, meta.title, headerTextW, 2);

  mctx.font = `600 22px ${fontStack}`;
  const summaryLines =
    includePhotoAndSummary && meta.summaryText
      ? wrapLines(mctx, meta.summaryText, innerW - 44, 2)
      : [];

  mctx.font = `800 26px ${fontStack}`;
  const modeLabelLines = wrapLines(mctx, meta.modeLine, innerW - 24, 2);

  const headerTopPad = 40;
  const headerBadgeH = 34;
  const headerTitleH = titleLines.length * 44;
  const headerLocH = 32;
  const headerContentH = Math.max(hasPhoto ? photoSize : 0, headerBadgeH + 14 + headerTitleH + 10 + headerLocH);
  const headerH = headerTopPad + headerContentH + 34;

  const summaryBlockH = summaryLines.length > 0 ? summaryLines.length * 30 + 34 : 0;
  const statusBlockH = statusBadge ? 46 : 0;
  const qrBoxSize = 510;
  const qrSectionTop = headerH + (summaryBlockH > 0 ? summaryBlockH + 26 : 32) + (statusBlockH > 0 ? statusBlockH + 14 : 0);

  const infoStartY = qrSectionTop + qrBoxSize + 30;
  const modeLabelH = modeLabelLines.length * 34;
  const upiBlockH = qrType === 'direct_upi' && meta.upiId ? 44 : 0;
  const validityBlockH = 48;
  const scanGuideH = 34;

  const footerTopY = infoStartY + modeLabelH + 12 + (upiBlockH ? upiBlockH + 12 : 0) + validityBlockH + 16 + scanGuideH + 28;
  const footerH = 104;
  const H = footerTopY + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 1. White Card Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Subtle outer frame border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 2, 2, W - 4, H - 4, 34);
  ctx.stroke();

  // 2. Top Color-Coded Header Banner
  ctx.save();
  drawRoundedRect(ctx, 2, 2, W - 4, headerH, 32);
  ctx.clip();
  const grad = ctx.createLinearGradient(0, 0, W, headerH);
  grad.addColorStop(0, meta.theme.headerBg);
  grad.addColorStop(1, meta.theme.headerBgEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, headerH);
  // Subtle decorative glow circle
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath();
  ctx.arc(W - 80, 30, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Flatten bottom corners of header banner cleanly
  const gradFlat = ctx.createLinearGradient(0, 0, W, headerH);
  gradFlat.addColorStop(0, meta.theme.headerBg);
  gradFlat.addColorStop(1, meta.theme.headerBgEnd);
  ctx.fillStyle = gradFlat;
  ctx.fillRect(4, headerH - 28, W - 8, 28);

  // Header Content: Optional Campaign Photo Thumbnail
  const headerBodyY = headerTopPad;
  if (campaignPhoto) {
    const photoY = headerBodyY + Math.max(0, (headerContentH - photoSize) / 2);
    ctx.save();
    drawRoundedRect(ctx, padX, photoY, photoSize, photoSize, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.clip();

    // Object-cover scaling
    const scale = Math.max(photoSize / campaignPhoto.width, photoSize / campaignPhoto.height);
    const drawW = campaignPhoto.width * scale;
    const drawH = campaignPhoto.height * scale;
    ctx.drawImage(
      campaignPhoto,
      padX + (photoSize - drawW) / 2,
      photoY + (photoSize - drawH) / 2,
      drawW,
      drawH
    );
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, padX, photoY, photoSize, photoSize, 22);
    ctx.stroke();
  }

  // Header Category Badge + Mode Pill
  let badgeX = headerTextX;
  const badgeY = headerBodyY;
  ctx.font = `900 17px ${fontStack}`;
  const catBadgeW = ctx.measureText(meta.categoryLabel).width + 28;
  drawRoundedRect(ctx, badgeX, badgeY, catBadgeW, 32, 16);
  ctx.fillStyle = meta.theme.badgeBg;
  ctx.fill();
  ctx.fillStyle = meta.theme.badgeText;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(meta.categoryLabel, badgeX + 14, badgeY + 16);

  badgeX += catBadgeW + 12;
  const modePillText = qrType === 'smart_link' ? 'WEB PORTAL' : 'DIRECT UPI';
  const modeBadgeW = ctx.measureText(modePillText).width + 26;
  if (badgeX + modeBadgeW <= W - padX) {
    drawRoundedRect(ctx, badgeX, badgeY, modeBadgeW, 32, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(modePillText, badgeX + 13, badgeY + 16);
  }

  // Header Campaign Title
  ctx.font = `900 36px ${fontStack}`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let cursorY = badgeY + headerBadgeH + 14;
  titleLines.forEach((line) => {
    ctx.fillText(line, headerTextX, cursorY);
    cursorY += 44;
  });

  // Header Location
  ctx.font = `600 20px ${fontStack}`;
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  const locText = wrapLines(ctx, meta.location, headerTextW, 1)[0] || meta.location;
  ctx.fillText(locText, headerTextX, cursorY + 4);

  // 3. Optional Status Badge (e.g. WAITING FOR APPROVAL)
  let nextY = headerH + 24;
  if (statusBadge) {
    ctx.font = `900 18px ${fontStack}`;
    const stW = Math.min(innerW, ctx.measureText(statusBadge).width + 44);
    const stX = (W - stW) / 2;
    drawRoundedRect(ctx, stX, nextY, stW, 40, 20);
    ctx.fillStyle = '#fef3c7';
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(statusBadge, W / 2, nextY + 20);
    nextY += 54;
  }

  // 4. Optional 2-Line Summary Box
  if (summaryLines.length > 0) {
    drawRoundedRect(ctx, padX, nextY, innerW, summaryBlockH, 18);
    ctx.fillStyle = meta.theme.softBg;
    ctx.fill();
    ctx.strokeStyle = meta.theme.softBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `600 22px ${fontStack}`;
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let sy = nextY + 17;
    summaryLines.forEach((line) => {
      ctx.fillText(line, W / 2, sy);
      sy += 30;
    });
  }

  // 5. Center Clean White QR Frame
  const qrBoxX = (W - qrBoxSize) / 2;
  const qrBoxY = qrSectionTop;

  // Soft shadow frame around QR box
  ctx.save();
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
  ctx.stroke();

  if (qrImg) {
    const innerQrPad = 22;
    ctx.drawImage(
      qrImg,
      qrBoxX + innerQrPad,
      qrBoxY + innerQrPad,
      qrBoxSize - innerQrPad * 2,
      qrBoxSize - innerQrPad * 2
    );
  }

  // 6. Identification Label + UPI ID + Valid Upto + Scan Guide
  let infoY = infoStartY;
  ctx.font = `800 26px ${fontStack}`;
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  modeLabelLines.forEach((line) => {
    ctx.fillText(line, W / 2, infoY);
    infoY += 34;
  });

  infoY += 10;

  if (qrType === 'direct_upi' && meta.upiId) {
    const upiDisplay = `UPI ID: ${meta.upiId}`;
    ctx.font = `700 20px ${monoStack}`;
    const upiW = Math.min(innerW, ctx.measureText(upiDisplay).width + 40);
    drawRoundedRect(ctx, (W - upiW) / 2, infoY, upiW, 40, 12);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(upiDisplay, W / 2, infoY + 20);
    infoY += 52;
  }

  // Validity Pill
  ctx.font = `800 22px ${fontStack}`;
  const valW = Math.min(innerW, ctx.measureText(meta.validityText).width + 52);
  drawRoundedRect(ctx, (W - valW) / 2, infoY, valW, 44, 22);
  ctx.fillStyle = meta.theme.softBg;
  ctx.fill();
  ctx.strokeStyle = meta.theme.softBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = meta.theme.accentHex;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(meta.validityText, W / 2, infoY + 22);
  infoY += 60;

  // Scan Guide
  ctx.font = `700 20px ${fontStack}`;
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(meta.scanGuide, W / 2, infoY);

  // 7. Official Brand Footer: RonPay Logo + "RonPay - A Digital Payment Platform"
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(4, footerTopY, W - 8, footerH - 4);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, footerTopY);
  ctx.lineTo(W - 4, footerTopY);
  ctx.stroke();

  const brandText = 'RonPay - A Digital Payment Platform';
  ctx.font = `800 23px ${fontStack}`;
  const brandTextW = ctx.measureText(brandText).width;
  const logoSize = 44;
  const logoGap = ronpayLogo ? 14 : 0;
  const totalBrandW = (ronpayLogo ? logoSize : 0) + logoGap + brandTextW;
  const brandStartX = (W - totalBrandW) / 2;
  const footerCenterY = footerTopY + footerH / 2 - 6;

  if (ronpayLogo) {
    const logoY = footerCenterY - logoSize / 2 + 4;
    ctx.save();
    drawRoundedRect(ctx, brandStartX, logoY, logoSize, logoSize, 10);
    ctx.clip();
    ctx.drawImage(ronpayLogo, brandStartX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(brandText, brandStartX + (ronpayLogo ? logoSize + logoGap : 0), footerCenterY - 2);

  ctx.font = `600 16px ${fontStack}`;
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('www.ronpay.app • Verified Community & Church QR Portal', W / 2, footerTopY + footerH - 22);

  const dataUrl = canvas.toDataURL('image/png');
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );

  return { dataUrl, blob, fileName: meta.fileName, meta };
};

export const downloadRenderedQRCard = (rendered: RenderedQRCard): void => {
  const link = document.createElement('a');
  link.download = rendered.fileName;
  link.href = rendered.dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const shareRenderedQRCard = async (
  rendered: RenderedQRCard,
  shareUrl: string
): Promise<'shared' | 'downloaded'> => {
  const caption = `${rendered.meta.title} (${rendered.meta.modeLabel})\n${rendered.meta.validityText}\n${shareUrl}`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && rendered.blob) {
    try {
      const file = new File([rendered.blob], rendered.fileName, { type: 'image/png' });
      const canShareFiles =
        typeof (navigator as any).canShare === 'function'
          ? (navigator as any).canShare({ files: [file] })
          : false;

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: rendered.meta.title,
          text: caption,
        });
        return 'shared';
      }

      await navigator.share({
        title: rendered.meta.title,
        text: `${rendered.meta.title} • ${rendered.meta.validityText}`,
        url: shareUrl,
      });
      return 'shared';
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return 'shared';
      }
    }
  }

  // Fallback for desktop browsers: download the PNG card & copy link
  downloadRenderedQRCard(rendered);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    }
  } catch {}
  return 'downloaded';
};

export const buildStandeePrintHtml = (params: {
  campaign: Campaign;
  qrImageSrc: string;
  qrType: QRCardMode;
  includePhotoAndSummary: boolean;
  statusBadge?: string;
}): string => {
  const { campaign, qrImageSrc, qrType, includePhotoAndSummary, statusBadge } = params;
  const meta = getCampaignQRCardMeta(campaign, qrType);
  const esc = (s: string) =>
    (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const showPhoto = includePhotoAndSummary && Boolean(campaign.imageUrl);
  const showSummary = includePhotoAndSummary && Boolean(meta.summaryText);

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <title>${esc(meta.title)} - RonPay QR Standee</title>
        <style>
          *, *:before, *:after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            padding: 18px 12px;
            background: #f1f5f9;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            color: #0f172a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .action-bar {
            display: flex;
            gap: 10px;
            margin-bottom: 16px;
            width: 100%;
            max-width: 400px;
          }
          .btn-action {
            flex: 1;
            background: #4f46e5;
            color: #ffffff;
            border: none;
            padding: 11px 14px;
            border-radius: 12px;
            font-weight: 800;
            font-size: 13px;
            cursor: pointer;
          }
          .btn-close {
            background: #e2e8f0;
            color: #334155;
            border: none;
            padding: 11px 16px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 13px;
            cursor: pointer;
          }
          .card {
            width: 100%;
            max-width: 400px;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            border: 2px solid #cbd5e1;
            box-shadow: 0 12px 30px -8px rgba(15, 23, 42, 0.14);
          }
          .header {
            background: linear-gradient(135deg, ${meta.theme.headerBg}, ${meta.theme.headerBgEnd});
            color: #ffffff;
            padding: 18px 20px;
            display: flex;
            align-items: center;
            gap: 14px;
            text-align: left;
          }
          .photo {
            width: 60px;
            height: 60px;
            border-radius: 14px;
            object-fit: cover;
            border: 2px solid rgba(255,255,255,0.7);
            background: #ffffff;
            flex-shrink: 0;
          }
          .badges {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 6px;
          }
          .cat-badge {
            font-size: 10px;
            font-weight: 900;
            padding: 3px 9px;
            border-radius: 999px;
            background: ${meta.theme.badgeBg};
            color: ${meta.theme.badgeText};
            text-transform: uppercase;
          }
          .mode-badge {
            font-size: 10px;
            font-weight: 800;
            padding: 3px 9px;
            border-radius: 999px;
            background: rgba(255,255,255,0.18);
            color: #ffffff;
            border: 1px solid rgba(255,255,255,0.3);
            text-transform: uppercase;
          }
          .title {
            font-size: 19px;
            font-weight: 900;
            line-height: 1.22;
            color: #ffffff;
            word-break: break-word;
          }
          .loc {
            font-size: 11.5px;
            color: rgba(255,255,255,0.85);
            margin-top: 3px;
            font-weight: 600;
          }
          .body {
            padding: 16px 20px 18px;
            text-align: center;
          }
          .status-badge {
            display: inline-block;
            font-size: 10px;
            font-weight: 900;
            color: #92400e;
            background: #fef3c7;
            border: 1px solid #f59e0b;
            padding: 4px 12px;
            border-radius: 999px;
            margin-bottom: 12px;
            text-transform: uppercase;
          }
          .summary {
            background: ${meta.theme.softBg};
            border: 1px solid ${meta.theme.softBorder};
            color: #334155;
            font-size: 11.5px;
            font-weight: 600;
            line-height: 1.4;
            padding: 9px 12px;
            border-radius: 12px;
            margin-bottom: 14px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .qr-box {
            background: #ffffff;
            padding: 12px;
            border-radius: 18px;
            border: 2px solid #cbd5e1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
          }
          .qr-box img {
            width: 230px;
            height: 230px;
            display: block;
          }
          .mode-line {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            margin-top: 12px;
            word-break: break-word;
          }
          .upi {
            display: inline-block;
            font-size: 11.5px;
            font-weight: 700;
            color: #1e293b;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            background: #f8fafc;
            border: 1px dashed #cbd5e1;
            padding: 4px 10px;
            border-radius: 8px;
            margin-top: 6px;
            word-break: break-all;
          }
          .validity {
            display: inline-block;
            margin-top: 9px;
            font-size: 12px;
            font-weight: 800;
            color: ${meta.theme.accentHex};
            background: ${meta.theme.softBg};
            border: 1px solid ${meta.theme.softBorder};
            padding: 5px 14px;
            border-radius: 999px;
          }
          .scan-guide {
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            margin-top: 8px;
          }
          .footer {
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
            padding: 12px 16px;
            text-align: center;
          }
          .brand-row {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .brand-logo {
            width: 24px;
            height: 24px;
            border-radius: 6px;
            object-fit: contain;
          }
          .brand-name {
            font-size: 12.5px;
            font-weight: 900;
            color: #0f172a;
          }
          .brand-sub {
            font-size: 9.5px;
            color: #64748b;
            font-weight: 600;
            margin-top: 3px;
          }
          @media print {
            body { background: #ffffff; padding: 0; }
            .action-bar { display: none !important; }
            .card { box-shadow: none; max-width: 100%; page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="action-bar">
          <button class="btn-action" onclick="window.print()">🖨️ Print / Save PDF</button>
          <button class="btn-close" onclick="window.close()">✖ Close</button>
        </div>
        <div class="card">
          <div class="header">
            ${showPhoto ? `<img class="photo" src="${esc(campaign.imageUrl || '')}" alt="${esc(meta.title)}" />` : ''}
            <div style="min-width:0;flex:1;">
              <div class="badges">
                <span class="cat-badge">${esc(meta.categoryLabel)}</span>
                <span class="mode-badge">${qrType === 'smart_link' ? 'WEB PORTAL' : 'DIRECT UPI'}</span>
              </div>
              <div class="title">${esc(meta.title)}</div>
              <div class="loc">${esc(meta.location)}</div>
            </div>
          </div>
          <div class="body">
            ${statusBadge ? `<div class="status-badge">${esc(statusBadge)}</div>` : ''}
            ${showSummary ? `<div class="summary">${esc(meta.summaryText)}</div>` : ''}
            <div class="qr-box">
              <img src="${qrImageSrc}" alt="RonPay QR Code" />
            </div>
            <div class="mode-line">${esc(meta.modeLine)}</div>
            ${qrType === 'direct_upi' && meta.upiId ? `<div class="upi">UPI ID: ${esc(meta.upiId)}</div>` : ''}
            <div><span class="validity">${esc(meta.validityText)}</span></div>
            <div class="scan-guide">${esc(meta.scanGuide)}</div>
          </div>
          <div class="footer">
            <div class="brand-row">
              <img class="brand-logo" src="/ronpay-logo.png" alt="RonPay" onerror="this.style.display='none'" />
              <span class="brand-name">RonPay - A Digital Payment Platform</span>
            </div>
            <div class="brand-sub">www.ronpay.app • Verified Community &amp; Church QR Portal</div>
          </div>
        </div>
      </body>
    </html>
  `;
};
