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
  ExternalLink,
  FolderDown,
  Sparkles
} from 'lucide-react';
import { downloadFileUniversal } from '../utils/export';
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
  const [fitMode, setFitMode] = useState<'fit-width' | 'actual' | 'custom'>('fit-width');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  
  // PDF Generation & Print states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfStatusText, setPdfStatusText] = useState<string>('');
  const [pdfSuccessResult, setPdfSuccessResult] = useState<PDFExportResult | null>(null);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  
  // Container & Sheet Dimensions for responsive scaling
  const A4_BASE_WIDTH = 794; // Standard A4 base width in px
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [measuredPaperHeight, setMeasuredPaperHeight] = useState<number>(1123);
  
  const contentContainerRef = useRef<HTMLDivElement>(null);
  const printableRootRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{ initialDist: number; initialScale: number } | null>(null);

  // Sync prop changes
  useEffect(() => {
    if (propIsOpen && propHtml) {
      setModalData({
        html: propHtml,
        docTitle: propDocTitle || 'Financial Statement',
      });
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
        setModalData({
          html: customEvent.detail.html,
          docTitle: customEvent.detail.docTitle || 'RonPay Financial Statement',
        });
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
  }, [modalData]);

  // Calculate scales
  const autoFitScale = useMemo(() => {
    if (!containerWidth) return 1.0;
    const padding = window.innerWidth < 640 ? 16 : 32;
    const avail = Math.max(260, containerWidth - padding);
    return Math.min(1.0, Number((avail / A4_BASE_WIDTH).toFixed(3)));
  }, [containerWidth]);

  const currentScale = useMemo(() => {
    if (fitMode === 'fit-width') return autoFitScale;
    if (fitMode === 'actual') return 1.0;
    return Number((zoomLevel / 100).toFixed(3));
  }, [fitMode, autoFitScale, zoomLevel]);

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

  // Direct Client-Side Real PDF (.pdf) Generator & Downloader
  const handleSaveAsPDF = async () => {
    const rootElement = printableRootRef.current || document.getElementById('ronpay-printable-preview-root');
    if (!rootElement || !modalData) return;

    setIsGeneratingPdf(true);
    setPdfSuccessResult(null);

    const cleanTitle = (modalData.docTitle || 'RonPay_Statement')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
      const result = await exportElementToPDF(
        rootElement,
        fileName,
        (status) => setPdfStatusText(status)
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
    if (pdfSuccessResult?.blobUrl) {
      // 1. Trigger direct anchor download to ensure it lands in Downloads
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

  // Direct Mobile Share to WhatsApp / Android Apps
  const handleSharePdfToApps = async () => {
    const title = modalData?.docTitle || 'RonPay Statement PDF';
    const cleanDate = new Date().toLocaleDateString('en-GB');
    const summaryText = `*RonPay Financial Statement*\n📄 Document: ${title}\n📅 Ni thla: ${cleanDate}\n\n_Statement PDF hi i phone Downloads folder-ah a in-save fel tawh e._`;

    // Copy summary text to clipboard for convenience
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(summaryText);
      }
    } catch {}

    // 1. Try Native Web Share with file or text
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
        console.warn('Native file share error, trying text share', err);
      }
    }

    // 2. Try Native text share
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: summaryText,
        });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // 3. Direct Universal WhatsApp Link (wa.me works on Android, iOS, & Web without 404 errors)
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

  // Mobile Web Share
  const handleShare = async () => {
    if (!modalData?.html) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: modalData.docTitle,
          text: `RonPay Official Statement - ${modalData.docTitle}`,
        });
      } catch (e) {
        handleSaveAsPDF();
      }
    } else {
      handleSaveAsPDF();
    }
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
      `}</style>

      {/* Embedded Document Internal Styles */}
      {renderedContent.styles && (
        <style dangerouslySetInnerHTML={{ __html: renderedContent.styles }} />
      )}

      {/* 1. TOP NAVIGATION / ACTION BAR (NO-PRINT) */}
      <header className="no-print w-full bg-slate-900/95 border-b border-slate-700/80 px-2.5 sm:px-5 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-lg text-slate-100 z-10">
        
        {/* Left Side: Prominent Back (Hnunglam) Button */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            id="print-preview-back-btn"
            onClick={handleClose}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-white font-black text-xs sm:text-sm rounded-xl border border-slate-600 shadow-xs cursor-pointer transition active:scale-95 shrink-0"
            title="Kirleh / Hnunglam"
          >
            <ArrowLeft className="w-4 h-4 text-indigo-400" />
            <span className="font-extrabold">Kirleh</span>
          </button>

          <div className="min-w-0 flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 hidden sm:flex items-center justify-center text-indigo-400 shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-white truncate max-w-[120px] xs:max-w-[180px] sm:max-w-[280px] md:max-w-[380px]">
                {modalData.docTitle}
              </h1>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Print & PDF Statement</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: View Controls & Primary Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
          
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={() => {
                setFitMode('fit-width');
                setZoomLevel(Math.round(autoFitScale * 100));
              }}
              className={`px-2 py-1 sm:py-1.5 rounded-lg text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                fitMode === 'fit-width'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Fit to mobile screen (Phek khat lan dan)"
            >
              <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Fit</span>
            </button>

            <button
              onClick={() => {
                setFitMode('actual');
                setZoomLevel(100);
              }}
              className={`px-2 py-1 sm:py-1.5 rounded-lg text-[10.5px] sm:text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                fitMode === 'actual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Standard A4 100%"
            >
              <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>100%</span>
            </button>
          </div>

          {/* Zoom Buttons with live dynamic percentage */}
          <div className="flex items-center bg-slate-950/80 rounded-xl border border-slate-700 p-0.5">
            <button
              onClick={() => {
                const nextZoom = Math.max(30, (fitMode === 'custom' ? zoomLevel : displayPercent) - 15);
                setFitMode('custom');
                setZoomLevel(nextZoom);
              }}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
            <span className="text-[9.5px] sm:text-[10px] font-mono font-bold px-1 text-slate-300 min-w-[32px] text-center">
              {displayPercent}%
            </span>
            <button
              onClick={() => {
                const nextZoom = Math.min(220, (fitMode === 'custom' ? zoomLevel : displayPercent) + 15);
                setFitMode('custom');
                setZoomLevel(nextZoom);
              }}
              className="p-1 sm:p-1.5 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>

          {/* Copy Text Button (Desktop) */}
          <button
            onClick={handleCopyText}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
            title="Copy text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-300" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* 1. PRIMARY SAVE AS REAL PDF BUTTON */}
          <button
            id="save-as-pdf-btn"
            onClick={handleSaveAsPDF}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/30 cursor-pointer transition active:scale-95 shrink-0"
            title="Download direct .PDF file"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                <span className="text-[11px] sm:text-xs">Siam mek...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-white" />
                <span>PDF Save</span>
              </>
            )}
          </button>

          {/* 2. SYSTEM PRINT BUTTON */}
          <button
            id="execute-modal-print-command-btn"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-indigo-600/30 cursor-pointer transition active:scale-95 shrink-0"
            title="System Print / Android Print Spooler"
          >
            <Printer className="w-3.5 h-3.5 text-white" />
            <span className="hidden xs:inline">{isPrinting ? '...' : 'Print'}</span>
          </button>

          {/* Close X */}
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </header>

      {/* 2. SUB-BANNER / STATUS & HOW-TO GUIDE (NO-PRINT) */}
      <div className="no-print w-full bg-slate-900 border-b border-slate-800 px-3 py-1.5 text-[10.5px] sm:text-xs text-slate-300 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="truncate">
            <b>Phek Khat Lan Dan (Fit Screen):</b> Mobile-ah a lang kim vek e. <b>Zoom (+) / (-)</b> emaw kut zungtang 2-in pinch zoom rawh le.
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 shrink-0">
          <span>Mode: <strong className="text-slate-200">{fitMode === 'fit-width' ? 'Fit Screen' : 'A4 Normal'}</strong></span>
        </div>
      </div>

      {/* 3. MAIN PREVIEW CANVAS / VIEWPORT */}
      <main 
        ref={contentContainerRef}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            touchStateRef.current = { initialDist: dist, initialScale: currentScale };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && touchStateRef.current && touchStateRef.current.initialDist > 10) {
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
        {/* Sizing Box to ensure proper scrolling boundary without blank margin */}
        <div 
          className="relative transition-all duration-100 ease-out origin-top flex justify-center shrink-0"
          style={{
            width: `${Math.round(A4_BASE_WIDTH * currentScale)}px`,
            height: measuredPaperHeight ? `${Math.round(measuredPaperHeight * currentScale)}px` : 'auto',
            minHeight: `${Math.round(750 * currentScale)}px`,
            margin: '0 auto',
          }}
        >
          {/* Physical Paper Container */}
          <div 
            ref={printableRootRef}
            id="ronpay-printable-preview-root"
            className="print-sheet bg-white text-slate-900 rounded-xl shadow-2xl origin-top-left absolute top-0 left-0 p-4 sm:p-7 md:p-8"
            style={{
              width: `${A4_BASE_WIDTH}px`,
              minHeight: '1000px',
              transform: `scale(${currentScale})`,
              transformOrigin: 'top left',
              boxSizing: 'border-box',
            }}
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
                I phone <b>Downloads / Files</b> folder-ah a in-save e.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {pdfSuccessResult.blobUrl && (
              <button
                onClick={handleOpenPdfBlob}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1 bg-white hover:bg-slate-100 text-slate-900 font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-md transition cursor-pointer"
                title="Download another copy"
              >
                <FolderDown className="w-3.5 h-3.5 text-indigo-600" />
                <span>Download Nawn</span>
              </button>
            )}

            <button
              onClick={handleSharePdfToApps}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs shadow-md shadow-emerald-900/50 transition cursor-pointer"
              title="Share report summary and status to WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5 text-white" />
              <span>WhatsApp Share</span>
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
      <footer className="no-print w-full bg-slate-900/95 border-t border-slate-800 px-3 py-2 sm:py-2.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 text-slate-200 hover:text-white font-extrabold cursor-pointer py-1.5 px-2.5 sm:px-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition active:scale-95 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kirleh</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={handleDownloadHTML}
            className="hidden sm:flex text-slate-300 hover:text-white font-bold items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-slate-800 transition cursor-pointer text-xs"
            title="Download offline HTML file"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>HTML Save</span>
          </button>

          <button
            onClick={handleSaveAsPDF}
            disabled={isGeneratingPdf}
            className="bg-rose-600 hover:bg-rose-500 text-white font-black px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition cursor-pointer active:scale-95 text-xs sm:text-sm"
          >
            {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            <span>Save as PDF (.pdf)</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-3 sm:px-4 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition cursor-pointer active:scale-95 text-xs sm:text-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </footer>

    </div>
  );
};
