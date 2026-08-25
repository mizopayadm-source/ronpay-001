import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadFileUniversal } from './export';

export interface PDFExportResult {
  success: boolean;
  fileName: string;
  blobUrl?: string;
  blob?: Blob;
  error?: string;
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

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(element.scrollWidth, 850),
    });

    // Restore original transform
    element.style.transform = originalTransform;

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

    // Generate Blob for universal multi-channel handling
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);

    // Multi-tier download execution
    try {
      // 1. Direct universal downloader with Web Share / Blob download
      await downloadFileUniversal(pdfBlob, cleanFileName, 'application/pdf', cleanFileName.replace('.pdf', ''));
    } catch (e) {
      console.warn('Universal download fallback to direct pdf.save', e);
      pdf.save(cleanFileName);
    }

    return {
      success: true,
      fileName: cleanFileName,
      blobUrl,
      blob: pdfBlob,
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
