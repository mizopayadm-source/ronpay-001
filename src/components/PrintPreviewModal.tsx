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
  ExternalLink
} from 'lucide-react';
import { downloadFileUniversal } from '../utils/export';
import { formatDateDDMMYYYY } from '../utils/date';
import { exportElementToPDF, exportHTMLToPDF, executePrintSafely, PDFExportResult } from '../utils/pdfGenerator';

export interface PrintModalData {
  html: string;
  docTitle: string;
  fileName?: string;
}

interface PrintPreviewModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  html?: string;
  docTitle?: string;
  fileName?: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  html: propHtml,
  docTitle: propDocTitle,
  fileName: propFileName,
}) => {
  const [modalData, setModalData] = useState<PrintModalData | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'phone-flow' | 'a4-sheet'>('phone-flow');
  const [fitMode, setFitMode] = useState<'fit-width' | 'actual' | 'custom'>('fit-width');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  
  // PDF Generation & Print states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfStatusText, setPdfStatusText] = useState<string>('');
  const [pdfSuccessResult, setPdfSuccessResult] = useState<PDFExportResult | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [waToast, setWaToast] = useState<string>('');
  
  // Container & Sheet Dimensions for responsive scaling
  const A4_BASE_WIDTH = 794; // Standard A4 base width in px
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [measuredPaperHeight, setMeasuredPaperHeight] = useState<number>(1123);
  
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const printableRootRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{ initialDist: number; initialScale: number } | null>(null);
  const wasOpenedViaProps = useRef(false);

  // Sync prop changes
  useEffect(() => {
    if (propIsOpen && propHtml) {
      wasOpenedViaProps.current = true;
      setModalData({
        html: propHtml,
        docTitle: propDocTitle || 'RonPay Statement',
        fileName: propFileName,
      });
      // Default to phone-flow on smaller screens, a4-sheet on desktop
      setViewMode(window.innerWidth < 768 ? 'phone-flow' : 'a4-sheet');
      setFitMode('fit-width');
      setZoomLevel(100);
      setPdfSuccessResult(null);
    } else if (propIsOpen === false && wasOpenedViaProps.current) {
      wasOpenedViaProps.current = false;
      setModalData(null);
      setPdfSuccessResult(null);
    }
  }, [propIsOpen, propHtml, propDocTitle, propFileName]);

  // Listen to global window event 'ronpay-open-print-modal'
  useEffect(() => {
    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PrintModalData>;
      if (customEvent.detail && customEvent.detail.html) {
        setModalData({
          html: customEvent.detail.html,
          docTitle: customEvent.detail.docTitle || 'RonPay Statement',
          fileName: customEvent.detail.fileName,
        });
        setViewMode(window.innerWidth < 768 ? 'phone-flow' : 'a4-sheet');
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
  }, [containerWidth]);

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

  // Android Phone Hardware Back Button & Popstate support
  useEffect(() => {
    if (!isVisible) return;

    try {
      window.history.pushState({ modal: 'ronpay-print-preview' }, '');
    } catch {}

    const handlePopState = () => {
      setModalData(null);
      setPdfSuccessResult(null);
      if (propOnClose) propOnClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isVisible]);

  const handleClose = (popHistory: boolean = true) => {
    setModalData(null);
    setPdfSuccessResult(null);
    if (propOnClose) propOnClose();
    if (popHistory !== false) {
      try {
        if (window.history.state?.modal === 'ronpay-print-preview') {
          window.history.back();
        }
      } catch {}
    }
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
    setPdfStatusText('Document buatsaih mek a ni...');
    setPdfSuccessResult(null);

    // Requirement: PDF filename must be 'RonPay-Bawm/Pawisa Thawhchhan' rather than transaction ID
    const fileName = (() => {
      if (modalData.fileName) {
        const raw = modalData.fileName.replace(/\.pdf$/i, '');
        return `${raw}.pdf`;
      }
      let rawName = (modalData.docTitle || '')
        .replace(/^RonPay\s*[-–—:]*\s*/i, '')
        .replace(/^(Official\s+)?Receipt\s*[-–—:]*\s*/i, '')
        .replace(/^(Transaction\s+)?Slip\s*[-–—:]*\s*/i, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .trim();

      if (!rawName || rawName.startsWith('RPAY_TXN_') || rawName.startsWith('TXN_') || rawName.toLowerCase() === 'receipt' || rawName.toLowerCase() === 'slip') {
        rawName = 'Pawisa_Thawhchhan';
      }

      const cleanBawmName = rawName.replace(/\s+/g, '_');
      return `RonPay-${cleanBawmName}.pdf`;
    })();

    try {
      // 1. Generate real PDF using isolated iframe from complete HTML template
      let result = await exportHTMLToPDF(
        modalData.html,
        fileName,
        (status) => setPdfStatusText(status)
      );

      // 2. Fallback to direct element capture if needed
      if (!result.success && rootElement) {
        result = await exportElementToPDF(
          rootElement,
          fileName,
          (status) => setPdfStatusText(status)
        );
      }

      if (result.success) {
        setPdfSuccessResult(result);
      } else {
        console.error('PDF export failed:', result.error);
        setWaToast('PDF download theih rih lo: ' + (result.error || ''));
        setTimeout(() => setWaToast(''), 4000);
      }
    } catch (err: any) {
      console.error('PDF export error', err);
      setWaToast('PDF download theih rih lo: ' + (err?.message || ''));
      setTimeout(() => setWaToast(''), 4000);
    } finally {
      setIsGeneratingPdf(false);
      setPdfStatusText('');
    }
  };

  // Open generated PDF or re-download on mobile / desktop
  const handleOpenPdfBlob = () => {
    const targetUrl = pdfSuccessResult?.downloadUrl || pdfSuccessResult?.blobUrl;
    if (targetUrl) {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.download = pdfSuccessResult.fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try {
          document.body.removeChild(a);
        } catch {}
      }, 1000);
    }
  };

  // Mobile Phone Share / Save File option (Only for genuine mobile devices)
  const handleShareToPhone = async () => {
    if (!pdfSuccessResult?.blob) return;
    const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobileDevice && navigator.canShare) {
      try {
        const file = new File([pdfSuccessResult.blob], pdfSuccessResult.fileName, { type: 'application/pdf' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: pdfSuccessResult.fileName,
            text: `RonPay Receipt PDF: ${pdfSuccessResult.fileName}`,
            files: [file],
          });
          return;
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Share error, downloading instead', err);
      }
    }
    handleOpenPdfBlob();
  };

  // Open in external browser or system viewer (works especially well with RonPayBridge)
  const handleOpenInBrowser = () => {
    const targetUrl = pdfSuccessResult?.downloadUrl || pdfSuccessResult?.blobUrl;
    if (!targetUrl) return;

    if ((window as any).RonPayBridge?.openInExternalBrowser && pdfSuccessResult?.downloadUrl) {
      (window as any).RonPayBridge.openInExternalBrowser(pdfSuccessResult.downloadUrl);
      return;
    }

    window.open(targetUrl, '_blank');
  };

  // Universal WhatsApp Share Trigger (Always available)
  const handleShareToWhatsApp = async () => {
    const title = documentSummary.title || modalData?.docTitle || 'RonPay Statement PDF';
    const cleanDate = formatDateDDMMYYYY(new Date());
    const totalText = documentSummary.total ? `\n💰 Total: *${documentSummary.total}*` : '';
    
    const summaryText = `*RonPay Financial Report*\n📄 Document: *${title}*${totalText}\n📅 Ni thla: ${cleanDate}\n\n_RonPay Community & Church Portal atanga generate a ni e._`;

    // 1. Copy summary text to clipboard
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(summaryText);
        setWaToast('Summary text copy a ni e! WhatsApp a in hawng mek...');
        setTimeout(() => setWaToast(''), 3000);
      }
    } catch {}

    // 2. Try Native Web Share with file if PDF is ready
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

    // 3. Direct WhatsApp URI (works across Android WhatsApp app, iOS, and WhatsApp Web)
    try {
      const encoded = encodeURIComponent(summaryText);
      const waUrl = `https://wa.me/?text=${encoded}`;
      const waLink = document.createElement('a');
      waLink.href = waUrl;
      waLink.target = '_blank';
      waLink.rel = 'noopener noreferrer';
      document.body.appendChild(waLink);
      waLink.click();
      setTimeout(() => {
        try {
          document.body.removeChild(waLink);
        } catch {}
      }, 1000);
    } catch (e) {
      console.warn('WhatsApp launch error', e);
    }
  };

  // Native Android / Mobile Apps Share
  const handleShareNative = async () => {
    const title = documentSummary.title || modalData?.docTitle || 'RonPay Statement';
    const cleanDate = formatDateDDMMYYYY(new Date());
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
      executePrintSafely(modalData.html, modalData.docTitle);
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
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #ronpay-printable-preview-root, #ronpay-printable-preview-root * {
            visibility: visible !important;
          }
          #ronpay-printable-preview-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
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
      <header className="no-print w-full bg-slate-900/95 border-b border-slate-700/80 px-2.5 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-lg text-slate-100 z-10">
        
        {/* Left Side: Prominent Back (Kirleh) Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            id="print-preview-back-btn"
            onClick={() => handleClose()}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-black text-xs sm:text-sm rounded-xl border border-slate-600 shadow-xs cursor-pointer transition active:scale-95 shrink-0 touch-manipulation min-h-[38px]"
            title="Kirleh / Hnunglam"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="font-extrabold">Kirleh</span>
          </button>

          <div className="min-w-0 flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 hidden sm:flex items-center justify-center text-indigo-400 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[130px] xs:max-w-[190px] sm:max-w-[280px]">
                {modalData.docTitle}
              </h1>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Print & PDF Statement</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right: View Mode Toggle & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto flex-wrap">
          
          {/* View Mode Switcher: Phone vs A4 Paper */}
          <div className="flex items-center bg-slate-950/90 rounded-xl border border-slate-700 p-0.5 shadow-xs">
            <button
              onClick={() => setViewMode('phone-flow')}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'phone-flow'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Phone View: Responsive easy reading mode for mobile screens"
            >
              <Smartphone className="w-3 h-3 text-indigo-300" />
              <span>Phone</span>
            </button>

            <button
              onClick={() => setViewMode('a4-sheet')}
              className={`px-2 py-1 rounded-lg text-[10.5px] font-extrabold flex items-center gap-1 transition cursor-pointer ${
                viewMode === 'a4-sheet'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="A4 Paper View: Exact printable sheet with zoom controls"
            >
              <Layers className="w-3 h-3 text-emerald-300" />
              <span>A4 Paper</span>
            </button>
          </div>

          {/* Zoom Controls (Active in A4 Sheet mode) */}
          {viewMode === 'a4-sheet' && (
            <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-700 p-0.5">
              <button
                onClick={() => {
                  const nextZoom = Math.max(30, (fitMode === 'custom' ? zoomLevel : displayPercent) - 15);
                  setFitMode('custom');
                  setZoomLevel(nextZoom);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
              <span className="text-[9.5px] font-mono font-bold px-1 text-slate-300 min-w-[32px] text-center">
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
                <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          )}

          {/* WhatsApp Direct Share Button */}
          <button
            onClick={handleShareToWhatsApp}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/40 cursor-pointer transition active:scale-95 shrink-0"
            title="Share document details & statement to WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5 text-white" />
            <span className="hidden xs:inline">WhatsApp</span>
          </button>

          {/* Save as PDF Button */}
          <button
            id="save-as-pdf-btn"
            onClick={handleSaveAsPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs rounded-xl shadow-md shadow-rose-600/30 cursor-pointer transition active:scale-95 shrink-0"
            title="Download direct .PDF file to phone storage"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="text-[11px]">Siam mek...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-white" />
                <span>PDF Save</span>
              </>
            )}
          </button>

          {/* Print Button */}
          <button
            id="execute-modal-print-command-btn"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow-md shadow-indigo-600/30 cursor-pointer transition active:scale-95 shrink-0"
            title="System Print / Android Print Spooler"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">{isPrinting ? '...' : 'Print'}</span>
          </button>

          {/* Close X */}
          <button
            onClick={() => handleClose()}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer touch-manipulation"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. SUB-BANNER / WHATSAPP TOAST & HOW-TO GUIDE (NO-PRINT) */}
      <div className="no-print w-full bg-slate-900 border-b border-slate-800 px-3 py-1.5 text-[10.5px] sm:text-xs text-slate-300 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">
            {viewMode === 'phone-flow' ? (
              <span><b>📱 Phone View:</b> Mobile screen-ah a lang rem chang vek e. Table scroll phei theih a ni.</span>
            ) : (
              <span><b>📄 A4 Paper View:</b> Exact print preview. Zoom (+) / (-) emaw pinch-zoom hmang rawh.</span>
            )}
          </span>
        </div>

        {waToast && (
          <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/40 text-[10px] animate-fadeIn shrink-0">
            {waToast}
          </span>
        )}
      </div>

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
        <div className="no-print w-full bg-emerald-950 border-t border-emerald-500/50 p-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-2xl animate-slideUp z-20">
          <div className="flex items-center gap-2 min-w-0 text-left">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-black text-white">
                PDF Download Fel Ta! <span className="text-emerald-300 font-bold">({pdfSuccessResult.fileName})</span>
              </p>
              <p className="text-[10px] text-emerald-200/90 flex items-center gap-1">
                <FolderDown className="w-3 h-3 text-emerald-400 shrink-0" />
                I device <b>Downloads</b> folder-ah a in-save e.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
            {(pdfSuccessResult.downloadUrl || pdfSuccessResult.blobUrl) && (
              <>
                <button
                  onClick={handleOpenPdfBlob}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-slate-900 font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                  title="Download another copy"
                >
                  <FolderDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Download Nawn</span>
                </button>

                <button
                  onClick={handleOpenInBrowser}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-indigo-700 hover:bg-indigo-600 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                  title="Open in external browser / PDF viewer"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Browser-ah Hawng</span>
                </button>
              </>
            )}

            {/* Mobile Native Share (Restricted to mobile devices) */}
            {pdfSuccessResult.blob && typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && 'share' in navigator && (
              <button
                onClick={handleShareToPhone}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                title="Phone-ah save / share rawh"
              >
                <Share2 className="w-3.5 h-3.5 text-white" />
                <span>Phone Share</span>
              </button>
            )}

            <button
              onClick={handleShareToWhatsApp}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-900/50 transition cursor-pointer"
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

      {/* 5. BOTTOM ACTION BAR (NO-PRINT) */}
      <footer className="no-print w-full bg-slate-900/95 border-t border-slate-800 px-3 py-2 sm:py-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            id="print-preview-footer-back-btn"
            onClick={() => handleClose()}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleClose();
            }}
            className="flex items-center gap-1.5 text-white font-black cursor-pointer py-2 px-3 sm:px-4 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-600 rounded-xl transition active:scale-95 text-xs sm:text-sm min-h-[38px] touch-manipulation shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Kirleh</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* WhatsApp Direct Share Button */}
          <button
            onClick={handleShareToWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition cursor-pointer active:scale-95 text-xs"
            title="Share via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>

          {/* Save as PDF */}
          <button
            onClick={handleSaveAsPDF}
            disabled={isGeneratingPdf}
            className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer active:scale-95 text-xs"
          >
            {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>Save PDF (.pdf)</span>
          </button>

          {/* System Print */}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer active:scale-95 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </footer>

    </div>
  );
};
