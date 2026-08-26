import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  QrCode, 
  X, 
  Camera, 
  Sparkles, 
  AlertTriangle, 
  ShieldAlert, 
  Upload, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw, 
  Zap, 
  Image as ImageIcon, 
  Check,
  RotateCcw,
  Info
} from 'lucide-react';
import jsQR from 'jsqr';
import { BawmCategory, Campaign } from '../types';
import { BAWM_CONFIG } from '../data/initialData';

export interface ScannedQRResult {
  type: BawmCategory | 'general-upi' | 'pending';
  campaign?: Campaign;
  rawText?: string;
}

/**
 * Robust parser for all RonPay QR formats (UPI URLs, Web portal links, JSON strings, Plain IDs)
 */
export function parseScannedPayload(rawText: string, campaigns: Campaign[]): ScannedQRResult {
  const cleanText = (rawText || '').trim();
  if (!cleanText) {
    return { type: 'general-upi', rawText: '' };
  }

  // 1. JSON String parsing (from RonPay Creator or Applet export)
  try {
    if (cleanText.startsWith('{') && cleanText.endsWith('}')) {
      const parsed = JSON.parse(cleanText);
      const campId = parsed.campaignId || parsed.id || parsed.campaign;
      if (campId) {
        const found = campaigns.find(c => c.id.toLowerCase() === String(campId).toLowerCase());
        if (found) {
          return {
            type: found.status === 'pending_approval' ? 'pending' : found.category,
            campaign: found,
            rawText: cleanText
          };
        }
        // If not found in current memory, construct new dynamic campaign object
        const dynamicCamp: Campaign = {
          id: String(campId),
          category: parsed.category || 'ralna',
          title: parsed.title || 'Scanned Community Bawm',
          location: parsed.location || 'Mizoram',
          gpsCoords: parsed.gps || '23.7271, 92.7176',
          upiId: parsed.upi || parsed.upiId || 'ronpay@axl',
          validityDate: parsed.validity || '2027-12-31',
          status: parsed.status || 'active',
          createdAt: new Date().toISOString(),
        };
        return {
          type: dynamicCamp.status === 'pending_approval' ? 'pending' : dynamicCamp.category,
          campaign: dynamicCamp,
          rawText: cleanText
        };
      }
    }
  } catch {
    // Ignore JSON parse error and proceed
  }

  // 2. Web Portal URL parsing (e.g. https://...?campaign=cmp-123 or ?c=cmp-123 or ?id=cmp-123)
  if (cleanText.startsWith('http://') || cleanText.startsWith('https://')) {
    try {
      const url = new URL(cleanText);
      const campId = url.searchParams.get('campaign') || 
                     url.searchParams.get('cmp') || 
                     url.searchParams.get('c') || 
                     url.searchParams.get('id') || 
                     url.searchParams.get('bawm');
      if (campId) {
        const matched = campaigns.find(c => c.id.toLowerCase() === campId.toLowerCase());
        if (matched) {
          return {
            type: matched.status === 'pending_approval' ? 'pending' : matched.category,
            campaign: matched,
            rawText: cleanText
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  // 3. UPI Payment URI parsing (e.g. upi://pay?pa=...&pn=...&tn=RonPay:cmp-123&am=500)
  if (cleanText.startsWith('upi://pay')) {
    try {
      const queryString = cleanText.includes('?') ? cleanText.split('?')[1] : cleanText.replace('upi://pay', '');
      const params = new URLSearchParams(queryString);
      const pa = (params.get('pa') || '').trim();
      const pn = (params.get('pn') || '').trim();
      const tn = (params.get('tn') || '').trim();
      const am = params.get('am');

      // Check if tn contains explicit RonPay campaign ID (e.g. "RonPay:cmp-xxx" or "cmp-xxx")
      let targetId = '';
      if (tn.startsWith('RonPay:')) {
        targetId = tn.replace('RonPay:', '').trim();
      } else if (tn.startsWith('cmp-')) {
        targetId = tn.trim();
      }

      if (targetId) {
        const found = campaigns.find(c => c.id.toLowerCase() === targetId.toLowerCase());
        if (found) {
          return {
            type: found.status === 'pending_approval' ? 'pending' : found.category,
            campaign: found,
            rawText: cleanText
          };
        }
      }

      // If it is a standard/generic UPI QR (without explicit RonPay campaign reference in tn),
      // treat it cleanly as an External UPI Payment (category: 'others')
      const externalCamp: Campaign = {
        id: `ext-${Date.now()}`,
        category: 'others',
        title: pn ? decodeURIComponent(pn) : (pa ? pa.split('@')[0] : 'External UPI Merchant'),
        location: 'Standard Direct UPI',
        gpsCoords: '23.7271, 92.7176',
        upiId: pa || 'direct@upi',
        validityDate: '2027-12-31',
        status: 'active',
        createdAt: new Date().toISOString(),
        targetAmount: am ? Number(am) : undefined,
      };

      return {
        type: 'general-upi',
        campaign: externalCamp,
        rawText: cleanText
      };
    } catch {
      // Fallback
    }
  }

  // 4. Exact Campaign ID match
  const foundById = campaigns.find(c => c.id.toLowerCase() === cleanText.toLowerCase());
  if (foundById) {
    return {
      type: foundById.status === 'pending_approval' ? 'pending' : foundById.category,
      campaign: foundById,
      rawText: cleanText
    };
  }

  // 5. Match by Campaign Title or ID inclusion (only if explicitly matching a known campaign)
  const foundByTitle = campaigns.find(c => 
    c.id.toLowerCase() === cleanText.toLowerCase() ||
    (cleanText.length > 5 && c.title.toLowerCase() === cleanText.toLowerCase())
  );
  if (foundByTitle) {
    return {
      type: foundByTitle.status === 'pending_approval' ? 'pending' : foundByTitle.category,
      campaign: foundByTitle,
      rawText: cleanText
    };
  }

  // 6. Direct UPI address format (e.g. name@okhdfcbank or merchant@axl)
  if (cleanText.includes('@') && !cleanText.includes(' ')) {
    const directUpiCamp: Campaign = {
      id: `upi-${Date.now()}`,
      category: 'others',
      title: cleanText.split('@')[0],
      location: 'Standard Direct UPI VPA',
      gpsCoords: '23.7271, 92.7176',
      upiId: cleanText,
      validityDate: '2027-12-31',
      status: 'active',
      createdAt: new Date().toISOString()
    };
    return {
      type: 'general-upi',
      campaign: directUpiCamp,
      rawText: cleanText
    };
  }

  // 7. General fallback
  return {
    type: 'general-upi',
    rawText: cleanText
  };
}

interface QRScannerModalProps {
  isOpen: boolean;
  targetCategory: BawmCategory | 'any';
  campaigns: Campaign[];
  onClose: () => void;
  onScanResult: (scannedPayload: ScannedQRResult) => void;
  onApproveCampaign?: (campaignId: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  targetCategory,
  campaigns,
  onClose,
  onScanResult,
  onApproveCampaign,
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [lastScannedText, setLastScannedText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    isScanningRef.current = false;
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsStartingCamera(false);
  }, []);

  // Process decoded QR text cleanly and freshly
  const handleRawDecodedData = useCallback((rawText: string) => {
    if (!rawText || !rawText.trim()) return;
    
    // Stop camera immediately upon detection
    stopCamera();
    setLastScannedText(rawText);

    // Parse payload with fresh context
    const result = parseScannedPayload(rawText, campaigns);
    
    // Reset file inputs so subsequent uploads start fresh
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraCaptureInputRef.current) cameraCaptureInputRef.current.value = '';

    onScanResult(result);
  }, [campaigns, onScanResult, stopCamera]);

  // Continuous QR scan loop using jsQR
  const tickScan = useCallback(() => {
    if (!isScanningRef.current) return;

    if (!videoRef.current || videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      animFrameIdRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      // Downscale if camera resolution is huge (e.g. 1920x1080 -> 640x360) for fast 60fps processing
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && code.data.trim()) {
        handleRawDecodedData(code.data);
        return;
      }
    }

    if (isScanningRef.current) {
      animFrameIdRef.current = requestAnimationFrame(tickScan);
    }
  }, [handleRawDecodedData]);

  // Start Camera Stream with Progressive Fallbacks
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);
    setIsStartingCamera(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access is not supported in this browser/frame. Khawngaihin "Snap Photo" emaw "Gallery Upload" hmang rawh le.');
      setIsStartingCamera(false);
      return;
    }

    const constraintList: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      },
      {
        video: {
          facingMode: { ideal: mode }
        },
        audio: false
      },
      {
        video: {
          facingMode: mode
        },
        audio: false
      },
      {
        video: true,
        audio: false
      }
    ];

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    for (const constraints of constraintList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err: any) {
        lastErr = err;
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          break;
        }
      }
    }

    if (!stream) {
      console.warn('Camera constraints failed:', lastErr);
      setCameraError(
        lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError'
          ? 'Camera permission pe a ni lo. Khawngaihin browser setting-ah camera phal la, emaw "Snap Photo" hmang rawh le.'
          : 'Camera stream a in hawng thei lo. "Snap Photo" emaw "Gallery Upload" hmang rawh le.'
      );
      setCameraActive(false);
      setIsStartingCamera(false);
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');

      try {
        await video.play();
        setCameraActive(true);
        setIsStartingCamera(false);
        isScanningRef.current = true;

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }

        // Start scanning loop
        animFrameIdRef.current = requestAnimationFrame(tickScan);
      } catch (playErr) {
        console.warn('Video play attempt error, retrying:', playErr);
        setTimeout(async () => {
          try {
            if (videoRef.current && streamRef.current) {
              await videoRef.current.play();
              setCameraActive(true);
              setIsStartingCamera(false);
              isScanningRef.current = true;
              animFrameIdRef.current = requestAnimationFrame(tickScan);
            }
          } catch (e) {
            setCameraError('Camera playback failed. Khawngaihin "Snap Photo" emaw Gallery hmang rawh le.');
            setCameraActive(false);
            setIsStartingCamera(false);
          }
        }, 150);
      }
    }
  }, [stopCamera, tickScan]);

  // Toggle Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      const newStatus = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newStatus }]
      });
      setTorchOn(newStatus);
    } catch (e) {
      console.warn('Torch toggle failed', e);
    }
  };

  // Flip Camera
  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Helper to decode image using BarcodeDetector if available, otherwise multi-pass jsQR
  const decodeImageElement = async (img: HTMLImageElement): Promise<string | null> => {
    // 1. Try native BarcodeDetector API (fastest on modern Chrome/Android)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(img);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          return barcodes[0].rawValue;
        }
      } catch (e) {
        // Fallback to jsQR
      }
    }

    // 2. jsQR Multi-resolution pass
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Resolutions to try (Original, 1000px, 600px)
    const targetSizes = [
      { w: img.width, h: img.height },
      { w: Math.min(1000, img.width), h: Math.round(img.height * (Math.min(1000, img.width) / img.width)) },
      { w: Math.min(600, img.width), h: Math.round(img.height * (Math.min(600, img.width) / img.width)) }
    ];

    for (const size of targetSizes) {
      canvas.width = size.w;
      canvas.height = size.h;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (code && code.data && code.data.trim()) {
        return code.data.trim();
      }
    }

    return null;
  };

  // File Upload QR Decode (with auto input reset for fresh uploads)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear input value immediately so re-selecting same or new file works every time
    const inputElement = e.target;
    
    setIsProcessingFile(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const decodedText = await decodeImageElement(img);
          setIsProcessingFile(false);
          inputElement.value = '';

          if (decodedText) {
            handleRawDecodedData(decodedText);
          } else {
            alert('⚠️ QR Code hmuh a ni lo. Thlalak dang fiah zawk han thlang leh chhin rawh le.');
          }
        } catch (err) {
          console.error('QR decode error:', err);
          setIsProcessingFile(false);
          inputElement.value = '';
          alert('⚠️ Thlalak chhiar theih a ni lo. A dang han thlang leh chhin rawh le.');
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        inputElement.value = '';
        alert('⚠️ Thlalak load theih a ni lo.');
      };
      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessingFile(false);
      inputElement.value = '';
      alert('⚠️ File chhiar theih a ni lo.');
    };

    reader.readAsDataURL(file);
  };

  // Reset scanner state completely
  const handleResetScanner = () => {
    stopCamera();
    setLastScannedText(null);
    setCameraError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraCaptureInputRef.current) cameraCaptureInputRef.current.value = '';
    setTimeout(() => {
      startCamera(facingMode);
    }, 100);
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setLastScannedText(null);
      const timer = setTimeout(() => {
        startCamera(facingMode);
      }, 80);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, startCamera, stopCamera, facingMode]);

  if (!isOpen) return null;

  const targetTitle = targetCategory === 'any' 
    ? 'Scanning Any UPI / RonPay QR' 
    : `Scanning for ${BAWM_CONFIG[targetCategory]?.name || targetCategory}`;

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col justify-between p-3 sm:p-4 backdrop-blur-md animate-fadeIn text-white overflow-y-auto">
      {/* Hidden file input from gallery */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Hidden native direct camera capture input (100% Mobile & WebView compatible) */}
      <input 
        type="file" 
        ref={cameraCaptureInputRef} 
        accept="image/*" 
        capture="environment"
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Top bar */}
      <div className="flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-amber-400" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-100">
            {targetTitle}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2 rounded-full transition cursor-pointer ${torchOn ? 'bg-amber-400 text-slate-950' : 'bg-white/20 text-white'}`}
              title="Toggle Flashlight"
            >
              <Zap className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={flipCamera}
            className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition cursor-pointer"
            title="Flip Camera (Front/Back)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Central Viewfinder Area */}
      <div className="relative my-auto flex flex-col items-center justify-center py-2 shrink-0">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-amber-400/80 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.35)] bg-slate-900 flex items-center justify-center">
          {/* Live Camera Video (always mounted to prevent mobile autoplay blocks) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              if (videoRef.current) {
                videoRef.current.play().catch(console.warn);
              }
            }}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              cameraActive ? 'opacity-100' : 'opacity-0 absolute inset-0'
            }`}
          />

          {/* Loading / Fallback Overlay */}
          {!cameraActive && (
            <div className="text-center p-4 space-y-2.5 z-10">
              <Camera className="w-10 h-10 mx-auto text-amber-400/80 animate-pulse" />
              <p className="text-xs font-bold text-slate-200 max-w-[210px] mx-auto leading-tight">
                {cameraError || (isStartingCamera ? 'Camera stream in hawng mek a ni...' : 'Camera stream nghah mek a ni')}
              </p>
              
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-1.5 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-start Camera
                </button>
                <button
                  type="button"
                  onClick={() => cameraCaptureInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <Camera className="w-3.5 h-3.5" /> Snap Photo (Camera pangaia la)
                </button>
              </div>
            </div>
          )}

          {/* Processing Upload Indicator */}
          {isProcessingFile && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-20">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-2" />
              <span className="text-xs font-bold text-amber-200">QR Code chhiar mek a ni...</span>
            </div>
          )}

          {/* Animated Laser Scanning Line */}
          {cameraActive && (
            <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent scan-line" />
          )}

          {/* Corner Guides */}
          <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-amber-300 rounded-tl-lg pointer-events-none" />
          <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-amber-300 rounded-tr-lg pointer-events-none" />
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-amber-300 rounded-bl-lg pointer-events-none" />
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-amber-300 rounded-br-lg pointer-events-none" />
        </div>

        {/* Upload Buttons under viewfinder */}
        <div className="mt-3 flex items-center gap-2 flex-wrap justify-center">
          <button
            type="button"
            onClick={() => cameraCaptureInputRef.current?.click()}
            className="text-xs text-emerald-300 font-bold bg-emerald-950/70 border border-emerald-500/40 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-emerald-900/80 transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400" /> Snap Photo
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-amber-300 font-bold bg-amber-950/60 border border-amber-500/40 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-amber-900/80 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Gallery Upload
          </button>
          <button
            type="button"
            onClick={handleResetScanner}
            className="text-xs text-slate-300 font-bold bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-slate-700 transition cursor-pointer"
            title="Reset Scanner"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" /> Clear / Reset
          </button>
        </div>
      </div>

      {/* Interactive Scan Simulator & Admin Approval Trigger Section */}
      <div className="space-y-2 z-10 bg-slate-900/95 p-3 rounded-2xl border border-slate-800 shadow-2xl max-w-sm mx-auto w-full">
        <p className="text-[9.5px] text-slate-400 font-extrabold uppercase text-center tracking-wider flex items-center justify-center gap-1">
          <Info className="w-3 h-3 text-indigo-400" /> Quick Test & Bawm Simulators:
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleRawDecodedData('upi://pay?pa=mizopay@axl&pn=Mizo%20Merchant&am=100')}
            className="col-span-2 bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] py-1.5 px-2 rounded-xl font-bold border border-indigo-500 flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-300" />
            Scan Any External UPI QR (GPay / PhonePe / Paytm)
          </button>

          <button
            type="button"
            onClick={() => {
              const c = campaigns.find(i => i.category === 'ralna' && i.status === 'active');
              if (c) handleRawDecodedData(c.id);
              else onScanResult({ type: 'ralna', campaign: c });
            }}
            className="bg-purple-950 hover:bg-purple-900 text-purple-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-purple-700/60 transition cursor-pointer text-center"
          >
            Scan Ralna QR
          </button>

          <button
            type="button"
            onClick={() => {
              const c = campaigns.find(i => i.category === 'khawlsak' && i.status === 'active');
              if (c) handleRawDecodedData(c.id);
              else onScanResult({ type: 'khawlsak', campaign: c });
            }}
            className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-emerald-700/60 transition cursor-pointer text-center"
          >
            Scan Khawlsak QR
          </button>

          <button
            type="button"
            onClick={() => {
              const c = campaigns.find(i => i.category === 'rikrum' && i.status === 'active');
              if (c) handleRawDecodedData(c.id);
              else onScanResult({ type: 'rikrum', campaign: c });
            }}
            className="bg-rose-950 hover:bg-rose-900 text-rose-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-rose-700/60 transition cursor-pointer text-center"
          >
            Scan Rikrum QR
          </button>

          <button
            type="button"
            onClick={() => {
              const c = campaigns.find(i => i.category === 'kumtluang' && i.status === 'active');
              if (c) handleRawDecodedData(c.id);
              else onScanResult({ type: 'kumtluang', campaign: c });
            }}
            className="bg-blue-950 hover:bg-blue-900 text-blue-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-blue-700/60 transition cursor-pointer text-center"
          >
            Scan Kumtluang QR
          </button>

          {/* Pending Approval Test Button */}
          <button
            type="button"
            onClick={() => {
              const pendingC = campaigns.find(i => i.status === 'pending_approval') || {
                id: 'cmp-pending-demo',
                category: 'ralna',
                title: 'Pi Liani Ralna (Demo Pending)',
                location: 'Dawrpui, Aizawl',
                gpsCoords: '23.7271, 92.7176',
                upiId: 'liani@axl',
                validityDate: '2026-12-31',
                status: 'pending_approval',
                createdAt: new Date().toISOString(),
              } as Campaign;

              onScanResult({ type: 'pending', campaign: pendingC, rawText: pendingC.id });
            }}
            className="col-span-2 bg-amber-950 hover:bg-amber-900 text-amber-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-amber-700/60 transition cursor-pointer flex items-center justify-center gap-1"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            Scan Creator QR (Waiting for Admin Approval)
          </button>
        </div>
      </div>
    </div>
  );
};
