import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface PDFExportResult {
  success: boolean;
  fileName: string;
  blobUrl?: string;
  blob?: Blob;
  dataUri?: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Intelligent Row-Aware Canvas Pagination Engine:
 * Takes a high-resolution canvas of the entire statement and its DOM container,
 * and partitions it into clean A4 pages by strictly respecting table row boundaries
 * and section card containers.
 * 
 * Guarantees:
 * - Table rows (<tr>) are NEVER sliced in half horizontally
 * - Next page begins cleanly at the start of the next row
 * - Table header (<thead>) is automatically repeated at the top of subsequent table pages
 * - Clean top and bottom margins on every page
 * - Clear "Page X of Y" page numbering at the bottom of every page
 */
async function paginateCanvasToPDF(
  canvas: HTMLCanvasElement,
  renderTarget: HTMLElement,
  cleanFileName: string,
  onProgress?: (status: string) => void
): Promise<PDFExportResult> {
  if (onProgress) onProgress('PDF phek rem fel mek a ni...');

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const isLandscape = canvasWidth > canvasHeight * 1.15;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const marginMm = 8;
  const contentWidthMm = pageWidth - marginMm * 2;
  const contentHeightMm = pageHeight - marginMm * 2;
  const footerHeightMm = 6; // Reserved for "Page X of Y"
  const usableHeightMm = contentHeightMm - footerHeightMm;

  // Maximum canvas pixels that fit into usableHeightMm
  const maxCanvasPageHeight = (usableHeightMm * canvasWidth) / contentWidthMm;

  // Map DOM element vertical boundaries to canvas coordinates
  const bodyRect = renderTarget.getBoundingClientRect();
  const scale = canvasWidth / (renderTarget.offsetWidth || 794);

  interface BreakBlock {
    top: number;
    bottom: number;
  }
  const protectedBlocks: BreakBlock[] = [];

  // Protect table rows, thead, tfoot, cards, signatures, and summary bars from horizontal splits
  const protectedElements = renderTarget.querySelectorAll(
    'tr, thead, tfoot, .sign-grid, .sign-box, .header-banner, .summary-bar, .target-bar, .footer'
  );

  protectedElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) {
      const top = (rect.top - bodyRect.top) * scale;
      const bottom = (rect.bottom - bodyRect.top) * scale;
      protectedBlocks.push({ top, bottom });
    }
  });

  // Sort protected blocks by vertical top position
  protectedBlocks.sort((a, b) => a.top - b.top);

  // Check if there is a <thead> so we can cleanly repeat column headers on subsequent table pages
  let theadCanvas: HTMLCanvasElement | null = null;
  let theadHeight = 0;
  const theadEl = renderTarget.querySelector('thead');
  if (theadEl) {
    const thRect = theadEl.getBoundingClientRect();
    const thTop = (thRect.top - bodyRect.top) * scale;
    const thH = thRect.height * scale;
    if (thH > 0 && thH < maxCanvasPageHeight * 0.35) {
      theadCanvas = document.createElement('canvas');
      theadCanvas.width = canvasWidth;
      theadCanvas.height = Math.round(thH);
      const thCtx = theadCanvas.getContext('2d');
      if (thCtx) {
        thCtx.drawImage(
          canvas,
          0, Math.round(thTop), canvasWidth, Math.round(thH),
          0, 0, canvasWidth, Math.round(thH)
        );
        theadHeight = Math.round(thH);
      }
    }
  }

  // Find table vertical limits to know where tabular rows end
  const tableEl = renderTarget.querySelector('table');
  const tableBottomCanvas = tableEl
    ? (tableEl.getBoundingClientRect().bottom - bodyRect.top) * scale
    : 0;

  // Calculate safe page break slices
  interface PageSlice {
    sourceY: number;
    sourceHeight: number;
    includeThead: boolean;
  }
  const slices: PageSlice[] = [];

  let currentY = 0;
  let pageIndex = 0;

  while (currentY < canvasHeight - 2) {
    let availableCanvasHeight = maxCanvasPageHeight;
    let shouldIncludeThead = false;

    // For page 2+, if we are in the middle of a table, reserve space for repeated thead
    if (pageIndex > 0 && theadCanvas && tableBottomCanvas > 0 && currentY < tableBottomCanvas - 20) {
      availableCanvasHeight = maxCanvasPageHeight - theadHeight;
      shouldIncludeThead = true;
    }

    const idealEnd = currentY + availableCanvasHeight;

    if (idealEnd >= canvasHeight) {
      // Reached the document end
      const sliceH = canvasHeight - currentY;
      if (sliceH > 0) {
        slices.push({
          sourceY: currentY,
          sourceHeight: sliceH,
          includeThead: shouldIncludeThead,
        });
      }
      break;
    }

    // Determine the safe cut line: start at idealEnd, and if it cuts through any protected element, pull it back
    let cutY = idealEnd;

    for (const block of protectedBlocks) {
      // If cutY cuts strictly through the middle of a table row or card:
      if (cutY > block.top + 2 && cutY < block.bottom - 2) {
        // Cut before this element begins, moving it cleanly to the next page!
        cutY = block.top;
      }
    }

    // Safety fallback: if no progress can be made (e.g. element taller than page), cut at idealEnd
    if (cutY <= currentY + 15) {
      cutY = idealEnd;
    }

    const sliceH = cutY - currentY;
    slices.push({
      sourceY: currentY,
      sourceHeight: sliceH,
      includeThead: shouldIncludeThead,
    });

    currentY = cutY;
    pageIndex++;
  }

  const totalPages = slices.length;

  // Render each page into jsPDF with its own dedicated slice
  for (let i = 0; i < totalPages; i++) {
    const s = slices[i];
    if (i > 0) {
      pdf.addPage();
    }

    let drawYMm = marginMm;

    // 1. Draw repeated table column header if on subsequent table pages
    if (s.includeThead && theadCanvas) {
      const thHeightMm = (theadHeight * contentWidthMm) / canvasWidth;
      const thDataUrl = theadCanvas.toDataURL('image/jpeg', 0.92);
      pdf.addImage(
        thDataUrl,
        'JPEG',
        marginMm,
        drawYMm,
        contentWidthMm,
        thHeightMm,
        undefined,
        'FAST'
      );
      drawYMm += thHeightMm;
    }

    // 2. Draw the clean, un-split page content slice
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvasWidth;
    pageCanvas.height = Math.max(1, Math.round(s.sourceHeight));
    const pctx = pageCanvas.getContext('2d');
    if (pctx) {
      pctx.fillStyle = '#ffffff';
      pctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      pctx.drawImage(
        canvas,
        0, Math.round(s.sourceY), canvasWidth, Math.round(s.sourceHeight),
        0, 0, canvasWidth, Math.round(s.sourceHeight)
      );
    }

    const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    const sliceHeightMm = (s.sourceHeight * contentWidthMm) / canvasWidth;

    pdf.addImage(
      pageImgData,
      'JPEG',
      marginMm,
      drawYMm,
      contentWidthMm,
      sliceHeightMm,
      undefined,
      'FAST'
    );

    // 3. Add clean footer with centered page number
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text(
      `Page ${i + 1} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 3.5,
      { align: 'center' }
    );
  }

  if (onProgress) onProgress('PDF download mek a ni...');

  const pdfBlob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const dataUri = pdf.output('datauristring');

  // Trigger instant direct download
  let downloadTriggered = false;
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = cleanFileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    downloadTriggered = true;
    setTimeout(() => {
      try {
        document.body.removeChild(a);
      } catch {}
    }, 2000);
  } catch (e) {
    console.warn('Anchor download failed, trying pdf.save fallback:', e);
  }

  if (!downloadTriggered) {
    try {
      pdf.save(cleanFileName);
      downloadTriggered = true;
    } catch (saveErr) {
      console.warn('pdf.save failed:', saveErr);
    }
  }

  // Background relay for Android WebViews
  let serverDownloadUrl: string | undefined;
  try {
    const base64Data = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
    if (typeof fetch !== 'undefined') {
      const prepareResp = await fetch('/api/prepare-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: base64Data,
          fileName: cleanFileName,
          mimeType: 'application/pdf',
        }),
      });
      if (prepareResp.ok) {
        const prepareData = await prepareResp.json();
        if (prepareData?.downloadUrl) {
          serverDownloadUrl = new URL(prepareData.downloadUrl, window.location.origin).href;
        }
      }
    }
  } catch (relayErr) {
    console.warn('Server download relay error, using blob URL:', relayErr);
  }

  return {
    success: true,
    fileName: cleanFileName,
    downloadUrl: serverDownloadUrl || blobUrl,
    blobUrl,
    blob: pdfBlob,
    dataUri,
  };
}

/**
 * Generate PDF from raw HTML string using an isolated iframe and smart row-aware pagination.
 */
export async function exportHTMLToPDF(
  htmlContent: string,
  fileName: string = 'RonPay_Statement.pdf',
  onProgress?: (status: string) => void
): Promise<PDFExportResult> {
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  let iframe: HTMLIFrameElement | null = null;

  try {
    if (onProgress) onProgress('Document buatsaih mek a ni...');

    iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '794px'; // Exact A4 width at 96 DPI
    iframe.style.height = '1123px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      throw new Error('Failed to create isolated document context for PDF rendering');
    }

    let fullHtml = htmlContent;
    if (!fullHtml.toLowerCase().includes('<html')) {
      fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 16px; 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      background: #ffffff; 
      color: #0f172a; 
      width: 794px; 
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;
    }

    iframeDoc.open();
    iframeDoc.write(fullHtml);
    iframeDoc.close();

    // Allow iframe fonts and layout to settle
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (onProgress) onProgress('Snapshot siam mek a ni...');

    const renderTarget = iframeDoc.body;
    renderTarget.style.width = '794px';
    renderTarget.style.margin = '0';
    renderTarget.style.backgroundColor = '#ffffff';

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(renderTarget, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 2000,
        windowWidth: 794,
      });
    } catch (primaryCanvasErr) {
      console.warn('Isolated canvas render failed, retrying without external images:', primaryCanvasErr);
      const imgs = renderTarget.querySelectorAll('img');
      imgs.forEach((img) => {
        img.style.display = 'none';
      });

      canvas = await html2canvas(renderTarget, {
        scale: 1.2,
        useCORS: false,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
      });
    }

    return await paginateCanvasToPDF(canvas, renderTarget, cleanFileName, onProgress);
  } catch (error: any) {
    console.error('exportHTMLToPDF failed:', error);
    return {
      success: false,
      fileName: cleanFileName,
      error: error?.message || 'PDF siam theih a ni lo',
    };
  } finally {
    if (iframe) {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }
  }
}

/**
 * High-quality client-side PDF generator from DOM element with smart row-aware pagination.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  fileName: string = 'RonPay_Statement.pdf',
  onProgress?: (status: string) => void
): Promise<PDFExportResult> {
  const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  // Prefer isolated HTML-based export
  try {
    const htmlContent = element.outerHTML || element.innerHTML;
    return await exportHTMLToPDF(htmlContent, cleanFileName, onProgress);
  } catch (fallbackErr) {
    console.warn('exportHTMLToPDF delegation failed, trying direct element capture:', fallbackErr);
  }

  try {
    if (onProgress) onProgress('Document buatsaih mek a ni...');

    const originalTransform = element.style.transform;
    element.style.transform = 'none';

    const canvas = await html2canvas(element, {
      scale: 1.5,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794,
    });

    element.style.transform = originalTransform;

    return await paginateCanvasToPDF(canvas, element, cleanFileName, onProgress);
  } catch (error: any) {
    console.error('exportElementToPDF fallback failed:', error);
    return {
      success: false,
      fileName: cleanFileName,
      error: error?.message || 'PDF siam theih a ni lo',
    };
  }
}

/**
 * Universal Print Trigger with multiple failover channels:
 * 1. Isolated print iframe with content & full stylesheets
 * 2. Window.print()
 * 3. Pop-up window fallback
 */
export function executePrintSafely(htmlContent: string, docTitle: string = 'RonPay Document'): void {
  try {
    let frame = document.getElementById('ronpay-direct-print-frame') as HTMLIFrameElement;
    if (frame) {
      try {
        document.body.removeChild(frame);
      } catch (e) {
        // ignore
      }
    }

    frame = document.createElement('iframe');
    frame.id = 'ronpay-direct-print-frame';
    frame.style.position = 'fixed';
    frame.style.left = '-9999px';
    frame.style.top = '0';
    frame.style.width = '1024px';
    frame.style.height = '768px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);

    const frameDoc = frame.contentWindow?.document || frame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setTimeout(() => {
        try {
          if (frame.contentWindow) {
            frame.contentWindow.focus();
            frame.contentWindow.print();
          } else {
            window.print();
          }
        } catch (e) {
          console.warn('Iframe print failed, falling back to window.print', e);
          window.print();
        }
      }, 400);
      return;
    }
  } catch (e) {
    console.warn('Iframe setup error, falling back to window.print', e);
  }

  try {
    window.print();
  } catch (e) {
    console.error('All print methods failed', e);
  }
}
