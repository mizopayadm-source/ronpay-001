import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadFileUniversal } from './export';

export interface PDFExportResult {
  success: boolean;
  fileName: string;
  blobUrl?: string;
  blob?: Blob;
  dataUri?: string;
  error?: string;
}

/**
 * Sanitize all <style> tags and element inline styles in a cloned document
 * to prevent html2canvas crashing on modern CSS features like oklch(), color-mix(), etc.
 */
function sanitizeClonedDocumentStyles(clonedDoc: Document, clonedEl: HTMLElement) {
  try {
    // 1. Sanitize all <style> tags
    const styleTags = clonedDoc.querySelectorAll('style');
    styleTags.forEach((styleTag) => {
      if (styleTag.textContent) {
        let css = styleTag.textContent;
        // Replace oklch(...) occurrences with safe hex / rgb values
        if (css.includes('oklch')) {
          css = css.replace(/oklch\([^)]+\)/gi, '#1e293b');
        }
        // Replace color-mix(...) if any
        if (css.includes('color-mix')) {
          css = css.replace(/color-mix\([^)]+\)/gi, '#334155');
        }
        styleTag.textContent = css;
      }
    });

    // 2. Sanitize inline styles on all elements
    const allElements = clonedDoc.querySelectorAll('*');
    const colorProps = ['color', 'backgroundColor', 'borderColor', 'outlineColor', 'fill', 'stroke', 'boxShadow', 'textDecorationColor'];
    
    allElements.forEach((el: any) => {
      if (el.style) {
        colorProps.forEach((prop) => {
          try {
            const val = el.style[prop];
            if (val && typeof val === 'string' && (val.includes('oklch') || val.includes('color-mix'))) {
              el.style[prop] = '#0f172a';
            }
          } catch {}
        });
      }
    });

    // 3. Ensure the target root element has clean solid background and text color
    if (clonedEl) {
      clonedEl.style.backgroundColor = '#ffffff';
      clonedEl.style.color = '#0f172a';
      clonedEl.style.transform = 'none';
      clonedEl.style.margin = '0 auto';
    }
  } catch (err) {
    console.warn('Error during cloned document style sanitization:', err);
  }
}

/**
 * High-quality client-side PDF generator that works reliably across all devices,
 * Mobile WebViews, Android, iOS, and sandboxed iframes.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  fileName: string = 'RonPay_Statement.pdf',
  onProgress?: (status: string) => void
): Promise<PDFExportResult> {
  try {
    if (onProgress) onProgress('Document buatsaih mek a ni...');

    // Ensure clean filename
    const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

    // 1. Capture element to high-res canvas (2x density for crisp text & charts)
    if (onProgress) onProgress('High-resolution snapshot siam mek a ni...');
    
    // Temporarily ensure element is at full width without zoom scale distortion
    const originalTransform = element.style.transform;
    element.style.transform = 'none';

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: Math.max(element.scrollWidth, 850),
        onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
          sanitizeClonedDocumentStyles(clonedDoc, clonedEl);
        }
      });
    } catch (h2cError: any) {
      console.warn('First html2canvas attempt failed, retrying with minimal scale:', h2cError);
      canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
          sanitizeClonedDocumentStyles(clonedDoc, clonedEl);
        }
      });
    } finally {
      // Restore original transform
      element.style.transform = originalTransform;
    }

    if (onProgress) onProgress('PDF phek rem fel mek a ni...');

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Check if wide (landscape) or tall (portrait)
    const isLandscape = canvasWidth > canvasHeight * 1.15;
    
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Standard 6mm margin for clean printable borders
    const margin = 6;
    const contentWidth = pageWidth - (margin * 2);
    const scaledContentHeight = (canvasHeight * contentWidth) / canvasWidth;

    const pageContentHeight = pageHeight - (margin * 2);

    let heightLeft = scaledContentHeight;
    let position = margin;
    let page = 0;

    // Draw first page
    pdf.addImage(
      imgData,
      'JPEG',
      margin,
      position,
      contentWidth,
      scaledContentHeight,
      undefined,
      'FAST'
    );
    heightLeft -= pageContentHeight;
    page++;

    // Add extra pages if document exceeds one A4 page
    while (heightLeft > 0) {
      position = margin - (page * pageContentHeight);
      pdf.addPage();
      pdf.addImage(
        imgData,
        'JPEG',
        margin,
        position,
        contentWidth,
        scaledContentHeight,
        undefined,
        'FAST'
      );
      heightLeft -= pageContentHeight;
      page++;
    }

    if (onProgress) onProgress('PDF download & save mek a ni...');

    // Generate Blob & Data URI for universal multi-channel handling
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const dataUri = pdf.output('datauristring');

    // Multi-tier download execution for Android WebViews and mobile browsers
    try {
      // 1. Trigger direct anchor download using Blob Object URL
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = cleanFileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 800);
    } catch (e) {
      console.warn('Anchor blob download failed, trying dataUri and pdf.save', e);
      try {
        pdf.save(cleanFileName);
      } catch (saveErr) {
        console.warn('pdf.save failed', saveErr);
      }
    }

    return {
      success: true,
      fileName: cleanFileName,
      blobUrl,
      blob: pdfBlob,
      dataUri,
    };
  } catch (error: any) {
    console.error('PDF Generation failed:', error);
    return {
      success: false,
      fileName,
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
      // Ensure UTF-8 charset and document title are properly preserved
      let completeHtml = htmlContent;
      if (!htmlContent.includes('<!DOCTYPE') && !htmlContent.includes('<html')) {
        completeHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>${docTitle || 'RonPay Document'}</title>
              <style>
                @page { size: auto; margin: 8mm; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 10px; color: #0f172a; background: #ffffff; }
                table { width: 100%; border-collapse: collapse; }
                @media print {
                  body { padding: 0; }
                  .no-print { display: none !important; }
                }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
          </html>
        `;
      }
      frameDoc.write(completeHtml);
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
      }, 450);
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
