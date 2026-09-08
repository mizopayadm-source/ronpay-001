import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  ZoomIn, 
  ZoomOut, 
  FileText, 
  Share2, 
  ArrowLeft, 
  Smartphone, 
  Layers, 
  Eye,
  Loader2,
  CheckCircle2,
  FileDown,
  FolderDown,
  MessageCircle,
  Sparkles,
  Maximize2,
  RotateCcw,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { downloadFileUniversal, shareFileToWhatsAppUniversal } from '../utils/export';
import { exportElementToPDF, executePrintSafely, PDFExportResult } from '../utils/pdfGenerator';

export interface PrintModalData {
  html: string;
  docTitle: string;
}

interface PrintPreviewModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  html?: string;
  docTitle?: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  html: propHtml,
  docTitle: propDocTitle,
}) => {
  const [modalData, setModalData] = useState<PrintModalData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'phone-flow' | 'a4-sheet'>('phone-flow');
  const [fitMode, setFitMode] = useState<'fit-width' | 'actual' | 'custom'>('fit-width');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  // PDF Generation & Print states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfStatusText, setPdfStatusText] = useState<string>('');
  const [pdfSuccessResult, setPdfSuccessResult] = useState<PDFExportResult | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [waToast, setWaToast] = useState<string>('');
  const [showHintBanner, setShowHintBanner] = useState<boolean>(true);

  // Clean, smart parsing of document title & subtitle for mobile headers
  const parsedTitle = useMemo(() => {
    if (!modalData?.docTitle) {
      return { main: 'RonPay Statement', sub: 'Print & PDF Statement' };
    }
    const parts = modalData.docTitle.split(/\s*[-•–]\s*/);
    if (parts.length >= 2) {
      return {
        main: parts[0].trim(),
        sub: parts.slice(1).join(' • ').trim(),
      };
    }
    return {
      main: modalData.docTitle,
      sub: 'Print & PDF Statement',
    };
  }, [modalData?.docTitle]);
  
  // Container & Sheet Dimensions for responsive scaling
  // Standard A4 base width: Portrait = 794px, Landscape = 1123px
  const A4_BASE_WIDTH = pageOrientation === 'landscape' ? 1123 : 794;
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [measuredPaperHeight, setMeasuredPaperHeight] = useState<number>(1123);
  
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const printableRootRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{ initialDist: number; initialScale: number } | null>(null);

  const detectOrientation = (htmlContent: string): 'portrait' | 'landscape' => {
    if (!htmlContent) return 'portrait';
    if (
      htmlContent.includes('data-default-orientation="landscape"') ||
      htmlContent.includes('size: A4 landscape') ||
      htmlContent.includes('size: landscape') ||
      htmlContent.includes('x-report-orientation" content="landscape"') ||
      htmlContent.includes('report-orientation-landscape') ||
      htmlContent.includes('orientation: landscape')
    ) {
      return 'landscape';
    }
    if (
      htmlContent.includes('data-default-orientation="portrait"') ||
      htmlContent.includes('size: A4 portrait') ||
      htmlContent.includes('x-report-orientation" content="portrait"')
    ) {
      return 'portrait';
    }
    // Column count heuristic: 7+ table header columns (e.g. multi-category ledger) => Landscape
    const thMatches = htmlContent.match(/<th\b[^>]*>/gi) || [];
    if (thMatches.length >= 7) {
      return 'landscape';
    }
    return 'portrait';
  };

  // Sync prop changes
  useEffect(() => {
    if (propIsOpen && propHtml) {
      const detected = detectOrientation(propHtml);
      setModalData({
        html: propHtml,
        docTitle: propDocTitle || 'Financial Statement',
      });
      setPageOrientation(detected);
      // Landscape reports display best in A4 Paper view with fit-width
      setViewMode(detected === 'landscape' ? 'a4-sheet' : (window.innerWidth < 768 ? 'phone-flow' : 'a4-sheet'));
      setFitMode('fit-width');
      setZoomLevel(100);
      setPdfSuccessResult(null);
    } else if (propIsOpen === false) {
      setModalData(null);
    }
  }, [propIsOpen, propHtml, propDocTitle]);

  // Listen to global window event 'ronpay-open-print-modal'
  useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PrintModalData>;
      if (customEvent.detail && customEvent.detail.html) {
        const detected = detectOrientation(customEvent.detail.html);
        setModalData({
          html: customEvent.detail.html,
          docTitle: customEvent.detail.docTitle || 'RonPay Financial Statement',
        });
        setPageOrientation(detected);
        setViewMode(detected === 'landscape' ? 'a4-sheet' : (window.innerWidth < 768 ? 'phone-flow' : 'a4-sheet'));
        setFitMode('fit-width');
        setZoomLevel(100);
        setPdfSuccessResult(null);
      }
    };

    window.addEventListener('ronpay-open-print-modal', handleOpenEvent as EventListener);
    return () => {
      window.removeEventListener('ronpay-open-print-modal', handleOpenEvent as EventListener);
    };
  }, []);

  // Responsive container measurement
  useEffect(() => {
    if (!modalData?.html) return;

    const measure = () => {
      if (contentContainerRef.current) {
        setContainerWidth(contentContainerRef.current.clientWidth);
      }
      if (printableRootRef.current) {
        const h = printableRootRef.current.scrollHeight || printableRootRef.current.offsetHeight;
        if (h > 100) setMeasuredPaperHeight(h);
      }
    };

    measure();
    const timer = setTimeout(measure, 150);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && contentContainerRef.current) {
      observer = new ResizeObserver(() => measure());
      observer.observe(contentContainerRef.current);
      if (printableRootRef.current) {
        observer.observe(printableRootRef.current);
      }
    }

    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [modalData, viewMode]);

  // Calculate scales for A4 sheet mode
  const autoFitScale = useMemo(() => {
    if (!containerWidth) return 1.0;
    const padding = window.innerWidth < 640 ? 12 : 24;
    const avail = Math.max(260, containerWidth - padding);
    return Math.min(1.0, Number((avail / A4_BASE_WIDTH).toFixed(3)));
  }, [containerWidth, A4_BASE_WIDTH]);

  const currentScale = useMemo(() => {
    if (viewMode === 'phone-flow') return 1.0;
    if (fitMode === 'fit-width') return autoFitScale;
    if (fitMode === 'actual') return 1.0;
    return Number((zoomLevel / 100).toFixed(3));
  }, [viewMode, fitMode, autoFitScale, zoomLevel]);

  const displayPercent = Math.round(currentScale * 100);

  // Handle ESC key to go back / close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalData) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalData]);

  const isVisible = Boolean(modalData && modalData.html);

  const handleClose = () => {
    setModalData(null);
    setPdfSuccessResult(null);
    if (propOnClose) propOnClose();
  };

  // Extract Summary Details from Document HTML for WhatsApp / Sharing
  const documentSummary = useMemo(() => {
    if (!modalData?.html) return { title: 'Financial Statement', total: '', count: '' };
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(modalData.html, 'text/html');
      const title = doc.querySelector('title')?.innerText || modalData.docTitle || 'RonPay Statement';
      const h1 = doc.querySelector('h1')?.innerText || '';
      
      // Look for total
      const text = doc.body.innerText || '';
      const totalMatch = text.match(/₹[\d,]+(\.\d{2})?/);
      const total = totalMatch ? totalMatch[0] : '';
      
      return { title: h1 || title, total, rawTitle: title };
    } catch {
      return { title: modalData.docTitle, total: '', rawTitle: modalData.docTitle };
    }
  }, [modalData]);

  // Direct Client-Side Real PDF (.pdf) Generator & Downloader
  const handleSaveAsPDF = async () => {
    const rootElement = printableRootRef.current || document.getElementById('ronpay-printable-preview-root');
    if (!rootElement || !modalData) return;

    setIsGeneratingPdf(true);
    setPdfStatusText('PDF snapshot siam mek a ni...');
    setPdfSuccessResult(null);

    const cleanTitle = (modalData.docTitle || 'RonPay_Statement')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
      const result = await exportElementToPDF(
        rootElement,
        fileName,
        (status) => setPdfStatusText(status),
        { orientation: pageOrientation }
      );

      if (result.success) {
        setPdfSuccessResult(result);
      } else {
        // Fallback to HTML document download
        handleDownloadHTML();
      }
    } catch (err) {
      console.error('PDF export error', err);
      handleDownloadHTML();
    } finally {
      setIsGeneratingPdf(false);
      setPdfStatusText('');
    }
  };

  // Open generated PDF or re-download on mobile
  const handleOpenPdfBlob = () => {
    if (pdfSuccessResult?.blob) {
      downloadFileUniversal(
        pdfSuccessResult.blob,
        pdfSuccessResult.fileName,
        'application/pdf',
        modalData?.docTitle || 'RonPay Statement PDF'
      );
    } else if (pdfSuccessResult?.blobUrl) {
      try {
        window.open(pdfSuccessResult.blobUrl, '_blank');
      } catch {}
      const a = document.createElement('a');
      a.href = pdfSuccessResult.blobUrl;
      a.download = pdfSuccessResult.fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 1000);
    }
  };

  // Universal WhatsApp Share Trigger (Direct Android Bridge -> Web Share -> Fallback)
  const handleShareToWhatsApp = async () => {
    const rootElement = printableRootRef.current || document.getElementById('ronpay-printable-preview-root');
    const title = documentSummary.title || modalData?.docTitle || 'RonPay Statement PDF';
    const cleanDate = new Date().toLocaleDateString('en-GB');
    const totalText = documentSummary.total ? `\n💰 Total: *${documentSummary.total}*` : '';
    const cleanTitle = (modalData?.docTitle || 'RonPay_Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    const summaryText = `*RonPay Financial Report*\n📄 Document: *${title}*${totalText}\n📅 Ni thla: ${cleanDate}\n\n_RonPay Community & Church Portal atanga generate a ni e._`;

    // 1. Ensure PDF is generated if not yet ready
    let currentPdfResult = pdfSuccessResult;
    if (!currentPdfResult?.dataUri && !currentPdfResult?.blob && rootElement) {
      setIsGeneratingPdf(true);
      setPdfStatusText('WhatsApp-a share turin PDF snapshot lak mek a ni...');
      try {
        const result = await exportElementToPDF(
          rootElement,
          fileName,
          (status) => setPdfStatusText(status),
          { orientation: pageOrientation, autoDownload: false }
        );
        if (result.success) {
          currentPdfResult = result;
          setPdfSuccessResult(result);
        }
      } catch (genErr) {
        console.warn('Auto PDF generation before WhatsApp share failed:', genErr);
      } finally {
        setIsGeneratingPdf(false);
        setPdfStatusText('');
      }
    }

    setWaToast('WhatsApp share buatsaih mek a ni...');

    // 2. Universal WhatsApp Share (Checks Android Native Bridge window.RonPayBridge.shareFileToWhatsApp)
    const shareResult = await shareFileToWhatsAppUniversal({
      content: currentPdfResult?.blob,
      base64Data: currentPdfResult?.dataUri,
      fileName,
      mimeType: 'application/pdf',
      summaryText,
      title,
    });

    if (shareResult.method === 'native_bridge') {
      setWaToast('Android App: WhatsApp-ah PDF Document a in thawn fel e!');
    } else if (shareResult.method === 'web_share') {
      setWaToast('Share dialog a in hawng e!');
    } else {
      setWaToast('PDF download a ni e! WhatsApp-ah attachment telh rawh le.');
    }

    setTimeout(() => {
      setWaToast('');
    }, 4000);
  };

  // Native Android / Mobile Apps Share
  const handleShareNative = async () => {
    // If running in Android App with native bridge, invoke WhatsApp/native direct share
    const w = typeof window !== 'undefined' ? (window as any) : null;
    const nativeBridge = w?.RonPayBridge || w?.AndroidBlobDownloader;
    if (nativeBridge && typeof nativeBridge.shareFileToWhatsApp === 'function') {
      await handleShareToWhatsApp();
      return;
    }

    const title = documentSummary.title || modalData?.docTitle || 'RonPay Statement';
    const cleanDate = new Date().toLocaleDateString('en-GB');
    const summaryText = `*${title}*\n📅 Date: ${cleanDate}\n${documentSummary.total ? `💰 Total: ${documentSummary.total}` : ''}`;

    if (pdfSuccessResult?.blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([pdfSuccessResult.blob], pdfSuccessResult.fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text: summaryText,
            files: [file],
          });
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: summaryText,
        });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
      }
    }

    // Fallback: trigger PDF generate & WhatsApp share
    handleShareToWhatsApp();
  };

  // Direct print command executed via multi-channel printer
  const handlePrint = () => {
    if (!modalData) return;
    setIsPrinting(true);
    
    try {
      executePrintSafely(modalData.html, modalData.docTitle, pageOrientation);
    } catch (err) {
      console.warn('Print command fallback', err);
      window.print();
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
    }
  };

  // Download statement as offline HTML / Printable PDF source
  const handleDownloadHTML = () => {
    if (!modalData?.html) return;
    const cleanTitle = (modalData.docTitle || 'RonPay_Statement').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.html`;
    downloadFileUniversal(modalData.html, fileName, 'text/html;charset=utf-8', modalData.docTitle);
  };

  const handleCopyText = async () => {
    if (!modalData?.html) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(modalData.html, 'text/html');
      const textContent = doc.body.innerText || doc.body.textContent || '';
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Copy error', e);
    }
  };

  // Clean HTML content for Native In-App Rendering
  const renderedContent = useMemo(() => {
    if (!modalData?.html) return { styles: '', body: '' };

    const rawHtml = modalData.html;
    
    // Extract all <style> tags
    const styleMatches = rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const styles = styleMatches.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');

    // Extract body content or take full html
    let body = rawHtml;
    const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1]) {
      body = bodyMatch[1];
    } else {
      body = rawHtml
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<\/?html[^>]*>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<\/?body[^>]*>/gi, '');
    }

    return { styles, body };
  }, [modalData?.html]);

  if (!isVisible || !modalData) return null;

  return (
    <div 
      id="ronpay-print-preview-modal" 
      className="print-modal-exempt fixed inset-0 z-[150] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-between overflow-hidden animate-fadeIn select-auto"
    >
      
      {/* Dynamic Native Print CSS to ensure physical print only prints the document */}
      <style>{`
        @page {
          size: ${pageOrientation === 'landscape' ? 'landscape' : 'portrait'};
          margin: ${pageOrientation === 'landscape' ? '8mm' : '10mm'};
        }
        @media print {
          /* 1. Global Multi-Page Paging Reset for Android WebView & Chromium */
          html, body, #root {
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            overflow-x: visible !important;
            overflow-y: visible !important;
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            display: block !important;
          }

          /* Hide all UI elements without breaking DOM layout */
          .no-print,
          header.no-print,
          footer.no-print {
            display: none !important;
            height: 0 !important;
            visibility: hidden !important;
          }

          /* Unset modal fixed viewport box so it flows naturally across Page 1, Page 2, etc. */
          #ronpay-print-preview-modal {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            inset: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: auto !important;
          }

          #ronpay-print-preview-modal > main {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          #ronpay-print-preview-modal > main > div {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: none !important;
          }

          /* Printable Root in in-flow normal block layout (NEVER absolute in @media print) */
          #ronpay-printable-preview-root {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            transform: none !important;
          }

          /* Table and Page Break Pagination Rules */
          table {
            display: table !important;
            width: 100% !important;
            max-width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            break-inside: auto !important;
          }

          thead {
            display: table-header-group !important;
          }

          tbody {
            display: table-row-group !important;
          }

          tfoot {
            display: table-footer-group !important;
          }

          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          th, td {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .header-banner {
            page-break-after: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .summary-bar,
          .target-bar {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .sign-grid,
          .footer,
          .report-footer {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .page-break,
          .break-before-page,
          .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
        }

        /* Phone Flow View Mode Enhancements */
        .mobile-phone-flow {
          width: 100% !important;
          max-width: 100% !important;
          padding: 12px !important;
          box-sizing: border-box !important;
          border-radius: 12px !important;
        }
        .mobile-phone-flow table {
          display: block !important;
          width: 100% !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          border-collapse: collapse !important;
          margin-top: 10px !important;
        }
        .mobile-phone-flow table th,
        .mobile-phone-flow table td {
          white-space: nowrap !important;
          padding: 8px 10px !important;
          font-size: 12px !important;
        }
        .mobile-phone-flow .header,
        .mobile-phone-flow .header-banner,
        .mobile-phone-flow .card {
          padding: 12px !important;
          border-radius: 12px !important;
        }
        .mobile-phone-flow h1 {
          font-size: 17px !important;
        }
      `}</style>

      {/* Embedded Document Internal Styles */}
      {renderedContent.styles && (
        <style dangerouslySetInnerHTML={{ __html: renderedContent.styles }} />
      )}

      {/* 1. TOP NAVIGATION / ACTION BAR (NO-PRINT) */}
      <header className="no-print w-full bg-slate-900 border-b border-slate-800 px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shrink-0 shadow-md text-slate-100 z-20">
        
        {/* Left Side: Prominent Back (Kirleh) Button */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            id="print-preview-back-btn"
            onClick={handleClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-black text-xs rounded-xl border border-slate-700 shadow-xs cursor-pointer transition shrink-0"
            title="Kirleh / Hnunglam"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span>Kirleh</span>
          </button>

          {/* Document Identity: Name & Subtitle */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm font-black text-white truncate leading-snug" title={modalData.docTitle}>
              {parsedTitle.main}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
              <span className="truncate">{parsedTitle.sub}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Actions + Always-Visible Kharna / Close Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Desktop-only Action Buttons */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={handleShareToWhatsApp}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs cursor-pointer transition active:scale-95"
              title="Share document details & statement to WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-white" />
              <span>WhatsApp</span>
            </button>

            <button
              id="save-as-pdf-btn-header"
              onClick={handleSaveAsPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer transition active:scale-95"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
              <span>PDF Save</span>
            </button>

            <button
              id="execute-modal-print-header-btn"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer transition active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>

          {/* Close X (Kharna) Button - High contrast, clearly visible on all screen sizes */}
          <button
            onClick={handleClose}
            className="flex items-center gap-1 px-2.5 py-1.5 text-slate-200 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700/90 shadow-xs transition cursor-pointer active:scale-95 text-xs font-bold shrink-0"
            title="Kharna (Close Preview)"
            aria-label="Kharna (Close Preview)"
          >
            <X className="w-4 h-4 text-rose-400" />
            <span className="hidden xs:inline">Kharna</span>
          </button>
        </div>
      </header>

      {/* 2. FORMAT & VIEW CONTROLS TOOLBAR (NO-PRINT): Perfectly proportioned for mobile, no overflow */}
      <div className="no-print w-full bg-slate-950/95 border-b border-slate-800/80 px-2 sm:px-4 py-1.5 flex items-center justify-between gap-1.5 shrink-0 z-10 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap shrink-0">
          
          {/* View Mode Switcher: Phone vs A4 Paper */}
          <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700/90 p-0.5 shadow-xs shrink-0">
            <button
              onClick={() => setViewMode('phone-flow')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-black flex items-center gap-1 sm:gap-1.5 transition cursor-pointer whitespace-nowrap ${
                viewMode === 'phone-flow'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Phone View: Responsive easy reading mode for mobile screens"
            >
              <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-300" />
              <span>Phone</span>
            </button>

            <button
              onClick={() => setViewMode('a4-sheet')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10.5px] sm:text-[11px] font-black flex items-center gap-1 sm:gap-1.5 transition cursor-pointer whitespace-nowrap ${
                viewMode === 'a4-sheet'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="A4 Paper View: Exact printable sheet with zoom controls"
            >
              <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" />
              <span>A4 Paper</span>
            </button>
          </div>

          {/* In A4 Paper Mode: Orientation & Compact Zoom Controls (Fits comfortably without cutting off) */}
          {viewMode === 'a4-sheet' && (
            <>
              {/* Orientation Switcher: Ding (Portrait) vs Phek (Landscape) */}
              <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700/90 p-0.5 shadow-xs shrink-0">
                <button
                  onClick={() => setPageOrientation('portrait')}
                  className={`px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                    pageOrientation === 'portrait'
                      ? 'bg-slate-800 text-indigo-300 shadow-xs border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Ding (Portrait A4)"
                >
                  <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
                  <span>Ding</span>
                </button>

                <button
                  onClick={() => setPageOrientation('landscape')}
                  className={`px-1.5 sm:px-2 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                    pageOrientation === 'landscape'
                      ? 'bg-emerald-700 text-white shadow-xs border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Phek (Landscape A4)"
                >
                  <SlidersHorizontal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-300" />
                  <span>Phek</span>
                </button>
              </div>

              {/* Compact Zoom Controls */}
              <div className="flex items-center bg-slate-900 rounded-xl border border-slate-700/90 p-0.5 shadow-xs shrink-0">
                <button
                  onClick={() => {
                    const nextZoom = Math.max(30, (fitMode === 'custom' ? zoomLevel : displayPercent) - 15);
                    setFitMode('custom');
                    setZoomLevel(nextZoom);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono font-bold px-1 text-slate-300 min-w-[32px] text-center">
                  {displayPercent}%
                </span>
                <button
                  onClick={() => {
                    const nextZoom = Math.min(220, (fitMode === 'custom' ? zoomLevel : displayPercent) + 15);
                    setFitMode('custom');
                    setZoomLevel(nextZoom);
                  }}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
              </div>
            </>
          )}

          {/* In Phone Flow Mode: Informational Badge */}
          {viewMode === 'phone-flow' && (
            <div className="flex items-center gap-1 px-2 py-1 bg-indigo-950/60 border border-indigo-500/30 rounded-lg text-[10px] text-indigo-300 font-bold shrink-0">
              <Smartphone className="w-3 h-3 text-indigo-400" />
              <span>Mobile Reading Mode</span>
            </div>
          )}
        </div>

        {/* Right side toast message */}
        {waToast && (
          <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40 text-[10px] animate-fadeIn shrink-0">
            {waToast}
          </span>
        )}
      </div>

      {/* 3. SUB-BANNER / HOW-TO GUIDE (NO-PRINT): Slim, clear & dismissible */}
      {showHintBanner && (
        <div className="no-print w-full bg-slate-900/95 border-b border-slate-800 px-2.5 sm:px-4 py-1 text-[10px] sm:text-xs text-slate-300 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Eye className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="truncate">
              {viewMode === 'phone-flow' ? (
                <span><b>📱 Phone View:</b> Mobile screen-ah a lang rem chang vek e. Table scroll phei theih a ni.</span>
              ) : (
                <span><b>📄 A4 Paper View:</b> Exact print preview. Zoom (+) / (-) emaw pinch-zoom hmang rawh.</span>
              )}
            </span>
          </div>

          <button
            onClick={() => setShowHintBanner(false)}
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer shrink-0"
            title="Hide hint"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 3. MAIN PREVIEW CANVAS / VIEWPORT */}
      <main 
        ref={contentContainerRef}
        onTouchStart={(e) => {
          if (viewMode === 'a4-sheet' && e.touches.length === 2) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            touchStateRef.current = { initialDist: dist, initialScale: currentScale };
          }
        }}
        onTouchMove={(e) => {
          if (viewMode === 'a4-sheet' && e.touches.length === 2 && touchStateRef.current && touchStateRef.current.initialDist > 10) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const factor = dist / touchStateRef.current.initialDist;
            const newScale = Math.min(2.2, Math.max(0.3, touchStateRef.current.initialScale * factor));
            setFitMode('custom');
            setZoomLevel(Math.round(newScale * 100));
          }
        }}
        onTouchEnd={() => {
          touchStateRef.current = null;
        }}
        className="flex-1 w-full bg-slate-950 p-2 sm:p-4 md:p-6 overflow-y-auto overflow-x-auto flex justify-center items-start scroll-smooth"
      >
        {/* Sizing Container */}
        <div 
          className={`relative transition-all duration-100 ease-out origin-top flex justify-center shrink-0 ${
            viewMode === 'phone-flow' ? 'w-full max-w-3xl' : ''
          }`}
          style={viewMode === 'a4-sheet' ? {
            width: `${Math.round(A4_BASE_WIDTH * currentScale)}px`,
            height: measuredPaperHeight ? `${Math.round(measuredPaperHeight * currentScale)}px` : 'auto',
            minHeight: `${Math.round(750 * currentScale)}px`,
            margin: '0 auto',
          } : undefined}
        >
          {/* Paper Container (adapts dynamically to phone-flow or a4-sheet) */}
          <div 
            ref={printableRootRef}
            id="ronpay-printable-preview-root"
            className={`print-sheet bg-white text-slate-900 rounded-xl shadow-2xl ${
              viewMode === 'phone-flow' 
                ? 'mobile-phone-flow w-full p-3 sm:p-6' 
                : 'origin-top-left absolute top-0 left-0 p-4 sm:p-7 md:p-8'
            }`}
            style={viewMode === 'a4-sheet' ? {
              width: `${A4_BASE_WIDTH}px`,
              minHeight: '1000px',
              transform: `scale(${currentScale})`,
              transformOrigin: 'top left',
              boxSizing: 'border-box',
            } : undefined}
          >
            {/* NATIVE RENDERED STATEMENT CONTENT */}
            <div 
              className="ronpay-rendered-statement-body w-full"
              dangerouslySetInnerHTML={{ __html: renderedContent.body }}
            />
          </div>
        </div>
      </main>

      {/* 4. SUCCESS / DIRECT PDF ACTION BOTTOM SHEET (IF DOWNLOADED) */}
      {pdfSuccessResult && (
        <div className="no-print w-full bg-emerald-950 border-t border-emerald-500/50 p-3 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 shadow-2xl animate-slideUp z-20">
          <div className="flex items-center gap-2.5 min-w-0 text-left w-full md:w-auto">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black text-white flex items-center gap-1.5 flex-wrap">
                <span>PDF Download Fel Ta!</span>
                <span className="text-emerald-300 font-bold truncate max-w-[200px]">({pdfSuccessResult.fileName})</span>
              </p>
              <p className="text-[10.5px] text-emerald-200/90 flex items-center gap-1">
                <FolderDown className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>I phone <b>Downloads / Files</b> folder-ah a in-save e. A lo awm loh chuan a hnuaia button te hi hmet rawh le:</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto justify-end flex-wrap">
            {/* Native Android / Mobile File Save */}
            <button
              onClick={handleShareNative}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer active:scale-95"
              title="Save to Phone Storage or Share"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-950" />
              <span>Phone-ah Save / Share</span>
            </button>

            {/* Direct Open PDF in Browser Tab */}
            {pdfSuccessResult.blobUrl && (
              <button
                onClick={handleOpenPdfBlob}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 text-slate-900 font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer active:scale-95"
                title="Open PDF Viewer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                <span>PDF Hawng Rawh</span>
              </button>
            )}

            {/* WhatsApp Share */}
            <button
              onClick={handleShareToWhatsApp}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer active:scale-95"
              title="Share report summary and status to WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-white" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={() => setPdfSuccessResult(null)}
              className="p-1.5 text-emerald-300 hover:text-white rounded-lg cursor-pointer"
              title="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 5. BOTTOM ACTION BAR (NO-PRINT): Clean, comfortable on narrow mobile screens */}
      <footer className="no-print w-full bg-slate-900 border-t border-slate-800 px-2.5 sm:px-4 py-2 flex items-center justify-between gap-1.5 text-xs text-slate-400 shrink-0 z-20">
        <div className="flex items-center">
          <button
            onClick={handleClose}
            className="flex items-center gap-1 text-slate-200 hover:text-white font-black cursor-pointer py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition active:scale-95 text-xs shrink-0 whitespace-nowrap"
            title="Kirleh / Hnunglam"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kirleh</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* WhatsApp Direct Share Button */}
          <button
            onClick={handleShareToWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-md shadow-emerald-950/40 transition cursor-pointer active:scale-95 text-xs shrink-0 whitespace-nowrap"
            title="Share via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          {/* Save as PDF */}
          <button
            onClick={handleSaveAsPDF}
            disabled={isGeneratingPdf}
            className="bg-rose-600 hover:bg-rose-500 text-white font-black px-2.5 sm:px-3.5 py-1.5 rounded-xl flex items-center gap-1 shadow-md shadow-rose-950/40 transition cursor-pointer active:scale-95 text-xs shrink-0 whitespace-nowrap"
            title="Download PDF File"
          >
            {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>Save PDF</span>
          </button>

          {/* System Print */}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-2.5 sm:px-3.5 py-1.5 rounded-xl flex items-center gap-1 shadow-md shadow-indigo-950/40 transition cursor-pointer active:scale-95 text-xs shrink-0 whitespace-nowrap"
            title="System Print / Spooler"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </footer>

    </div>
  );
};
