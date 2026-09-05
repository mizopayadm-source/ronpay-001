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

export interface PDFExportOptions {
  orientation?: 'portrait' | 'landscape' | 'auto';
  autoDownload?: boolean;
}

/**
 * High-quality client-side PDF generator that works reliably across all devices,
 * Mobile WebViews, Android, iOS, and sandboxed iframes.
 */
export async function exportElementToPDF(
  element: HTMLElement,
  fileName: string = 'RonPay_Statement.pdf',
  onProgress?: (status: string) => void,
  options?: PDFExportOptions
): Promise<PDFExportResult> {
  try {
    if (onProgress) onProgress('Document buatsaih mek a ni...');

    // Ensure clean filename
    const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

    // 1. Detect orientation: explicit options > element data attribute > column count
    const targetOrientation = options?.orientation;
    const dataOrientation = element.getAttribute('data-orientation') || 
                            element.querySelector('[data-default-orientation]')?.getAttribute('data-default-orientation') ||
                            element.getAttribute('data-default-orientation');
    
    // Count columns in rendered table
    const table = element.querySelector('table');
    const thCols = table ? table.querySelectorAll('thead tr:first-child th').length : 0;
    
    let isLandscape = false;
    if (targetOrientation === 'landscape') {
      isLandscape = true;
    } else if (targetOrientation === 'portrait') {
      isLandscape = false;
    } else if (dataOrientation === 'landscape') {
      isLandscape = true;
    } else if (dataOrientation === 'portrait') {
      isLandscape = false;
    } else if (thCols >= 7) {
      // Automatic rule: 7+ columns (multi-category ledger / Kumtluang) => Landscape
      isLandscape = true;
    } else {
      isLandscape = false;
    }

    // Exact A4 dimensions in px at standard 96 CSS DPI (Portrait: 794x1123, Landscape: 1123x794)
    const targetWidth = isLandscape ? 1123 : 794;

    // 2. Capture element to high-res canvas (2x density for crisp text & charts)
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
        width: targetWidth,
        windowWidth: targetWidth + 40,
        onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
          sanitizeClonedDocumentStyles(clonedDoc, clonedEl);
          if (clonedEl) {
            clonedEl.classList.remove('mobile-phone-flow');
            clonedEl.style.width = `${targetWidth}px`;
            clonedEl.style.maxWidth = `${targetWidth}px`;
            clonedEl.style.minWidth = `${targetWidth}px`;
            clonedEl.style.boxSizing = 'border-box';
            clonedEl.style.overflow = 'visible';
            clonedEl.style.position = 'relative';
            clonedEl.style.transform = 'none';

            // Ensure all tables display as standard tables and occupy full width
            const tables = clonedEl.querySelectorAll('table');
            tables.forEach(t => {
              t.style.display = 'table';
              t.style.width = '100%';
              t.style.maxWidth = '100%';
              t.style.tableLayout = 'auto';
            });
          }
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
        width: targetWidth,
        windowWidth: targetWidth + 40,
        onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
          sanitizeClonedDocumentStyles(clonedDoc, clonedEl);
          if (clonedEl) {
            clonedEl.classList.remove('mobile-phone-flow');
            clonedEl.style.width = `${targetWidth}px`;
            clonedEl.style.maxWidth = `${targetWidth}px`;
            clonedEl.style.minWidth = `${targetWidth}px`;
            clonedEl.style.boxSizing = 'border-box';
            clonedEl.style.overflow = 'visible';
            clonedEl.style.position = 'relative';
            clonedEl.style.transform = 'none';

            const tables = clonedEl.querySelectorAll('table');
            tables.forEach(t => {
              t.style.display = 'table';
              t.style.width = '100%';
              t.style.maxWidth = '100%';
              t.style.tableLayout = 'auto';
            });
          }
        }
      });
    } finally {
      // Restore original transform
      element.style.transform = originalTransform;
    }

    if (onProgress) onProgress('PDF phek rem fel mek a ni...');

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
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
    const pageContentHeight = pageHeight - (margin * 2);
    const mmToPx = canvasWidth / contentWidth;
    const pageMaxHeightPx = Math.floor(pageContentHeight * mmToPx);

    // Helper to calculate relative offsetTop without being affected by CSS scale or transforms
    const getRelativeOffsetTop = (target: HTMLElement, container: HTMLElement): number => {
      let top = 0;
      let curr: HTMLElement | null = target;
      while (curr && curr !== container && curr !== document.body) {
        top += curr.offsetTop;
        curr = curr.offsetParent as HTMLElement | null;
      }
      return top;
    };

    const containerHeight = element.scrollHeight || element.offsetHeight || 1;
    const scaleY = canvasHeight / containerHeight;

    // Collect elements that should not be split across pages (table rows, footer, signature grid)
    interface BreakableBlock {
      topPx: number;
      bottomPx: number;
    }

    const breakableElements = element.querySelectorAll('tbody tr, tfoot tr, .sign-grid, .summary-bar, .report-footer');
    const blocks: BreakableBlock[] = [];

    breakableElements.forEach(el => {
      const topPx = Math.round(getRelativeOffsetTop(el as HTMLElement, element) * scaleY);
      const bottomPx = Math.round((getRelativeOffsetTop(el as HTMLElement, element) + (el as HTMLElement).offsetHeight) * scaleY);
      if (bottomPx > topPx) {
        blocks.push({ topPx, bottomPx });
      }
    });

    blocks.sort((a, b) => a.topPx - b.topPx);

    // Smart single-page fit threshold:
    // If the canvas height is slightly larger than 1 page (up to 20% overflow, such as ~25-28 rows + signatures),
    // scale it cleanly so the entire statement fits on ONE pristine page!
    if (canvasHeight <= pageMaxHeightPx * 1.20) {
      const fitScale = Math.min(1, pageMaxHeightPx / canvasHeight);
      const scaledWidth = contentWidth * fitScale;
      const scaledHeight = (canvasHeight * scaledWidth) / canvasWidth;
      const offsetX = margin + (contentWidth - scaledWidth) / 2;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(
        imgData,
        'JPEG',
        offsetX,
        margin,
        scaledWidth,
        scaledHeight,
        undefined,
        'FAST'
      );
    } else {
      // Clean, non-overlapping multi-page slicing with exact row boundary awareness
      let currentY = 0;
      let pageIndex = 0;

      while (currentY < canvasHeight) {
        const availableSlicePx = pageMaxHeightPx;
        const targetY = currentY + availableSlicePx;

        let cutY = targetY;
        if (targetY >= canvasHeight) {
          cutY = canvasHeight;
        } else {
          // Check if any block is split across targetY
          let foundSplit = false;
          for (const block of blocks) {
            if (block.topPx < targetY && block.bottomPx > targetY) {
              if (block.topPx > currentY + (availableSlicePx * 0.35)) {
                cutY = block.topPx;
                foundSplit = true;
              }
              break;
            }
          }

          if (!foundSplit) {
            let bestBoundary = -1;
            for (const block of blocks) {
              if (block.bottomPx <= targetY && block.bottomPx > bestBoundary) {
                bestBoundary = block.bottomPx;
              }
            }
            if (bestBoundary > currentY + (availableSlicePx * 0.35)) {
              cutY = bestBoundary;
            }
          }
        }

        if (cutY <= currentY) {
          cutY = Math.min(canvasHeight, currentY + availableSlicePx);
        }

        const sliceHeightPx = cutY - currentY;

        // Create isolated canvas for this specific page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sliceHeightPx;
        const pageCtx = pageCanvas.getContext('2d');

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, canvasWidth, sliceHeightPx);

          // Draw ONLY the exact unique slice for this page
          pageCtx.drawImage(
            canvas,
            0, currentY, canvasWidth, sliceHeightPx,
            0, 0, canvasWidth, sliceHeightPx
          );
        }

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = (sliceHeightPx * contentWidth) / canvasWidth;

        if (pageIndex > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          pageImgData,
          'JPEG',
          margin,
          margin,
          contentWidth,
          sliceHeightMm,
          undefined,
          'FAST'
        );

        // Advance to next slice with ZERO overlap
        currentY = cutY;
        pageIndex++;
      }
    }

    if (onProgress) onProgress('PDF download & save mek a ni...');

    // Generate Blob & Data URI for universal multi-channel handling
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const dataUri = pdf.output('datauristring');

    // Multi-tier download execution for Android WebViews and mobile browsers
    if (options?.autoDownload !== false) {
      try {
        await downloadFileUniversal(
          pdfBlob,
          cleanFileName,
          'application/pdf',
          cleanFileName.replace(/_/g, ' ').replace(/\.pdf$/i, '')
        );
      } catch (e) {
        console.warn('downloadFileUniversal in exportElementToPDF failed, using direct anchor fallback:', e);
        try {
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
          }, 1000);
        } catch (anchorErr) {
          console.warn('Anchor fallback failed, trying pdf.save:', anchorErr);
          try {
            pdf.save(cleanFileName);
          } catch {}
        }
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
export function executePrintSafely(
  htmlContent: string, 
  docTitle: string = 'RonPay Document',
  orientation?: 'portrait' | 'landscape'
): void {
  try {
    const isLandscape = orientation === 'landscape' || 
      htmlContent.includes('data-default-orientation="landscape"') ||
      htmlContent.includes('size: A4 landscape') ||
      htmlContent.includes('size: landscape') ||
      htmlContent.includes('x-report-orientation" content="landscape"') ||
      htmlContent.includes('report-orientation-landscape');

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
    frame.style.width = isLandscape ? '1123px' : '794px';
    frame.style.height = isLandscape ? '794px' : '1123px';
    frame.style.border = '0';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    document.body.appendChild(frame);

    const frameDoc = frame.contentWindow?.document || frame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      
      const pageCss = `@page { size: ${isLandscape ? 'landscape' : 'portrait'}; margin: 8mm; }`;
      let completeHtml = htmlContent;
      
      if (!htmlContent.includes('<!DOCTYPE') && !htmlContent.includes('<html')) {
        completeHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>${docTitle || 'RonPay Document'}</title>
              <style>
                ${pageCss}
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
      } else if (!completeHtml.includes('@page')) {
        completeHtml = completeHtml.replace('</head>', `<style>${pageCss}</style></head>`);
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
