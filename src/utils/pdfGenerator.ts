import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { downloadFileUniversal } from './export';

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

    // Generate Blob & Data URI for universal multi-channel handling
    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const dataUri = pdf.output('datauristring');

    // Extract raw base64 string
    const base64Data = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

    // Prepare real HTTPS download endpoint so Android WebView DownloadManager does not fail on blob:
    let serverDownloadUrl: string | undefined;
    try {
      if (typeof fetch !== 'undefined') {
        const prepareResp = await fetch('/api/download/prepare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: base64Data,
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
      console.warn('Server download relay error, falling back to client URL:', relayErr);
    }

    // Determine target URL for download: prefer genuine HTTPS URL, fallback to blobUrl
    const effectiveDownloadUrl = serverDownloadUrl || blobUrl;

    // Multi-tier download execution for Android WebViews and mobile browsers
    try {
      const a = document.createElement('a');
      a.href = effectiveDownloadUrl;
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
    } catch (e) {
      console.warn('Anchor download failed, trying dataUri and pdf.save', e);
      try {
        pdf.save(cleanFileName);
      } catch (saveErr) {
        console.warn('pdf.save failed', saveErr);
      }
    }

    return {
      success: true,
      fileName: cleanFileName,
      downloadUrl: serverDownloadUrl,
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
