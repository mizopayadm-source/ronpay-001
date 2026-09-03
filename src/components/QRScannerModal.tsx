import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  QrCode, 
  X, 
  Camera, 
  AlertTriangle, 
  Upload, 
  RefreshCw, 
  Zap, 
  Image as ImageIcon, 
  RotateCcw,
  Smartphone,
  ShieldAlert
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
 * Robust parser for all RonPay QR formats (UPI URLs, Web portal links, JSON strings, Plain IDs, VPAs)
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

  // 2. Web Portal URL parsing (e.g. https://...?campaign=cmp-123 or ?cat=ralna&title=...)
  if (cleanText.startsWith('http://') || cleanText.startsWith('https://') || cleanText.includes('/?') || cleanText.includes('campaign=')) {
    try {
      const urlString = (cleanText.startsWith('http://') || cleanText.startsWith('https://')) 
        ? cleanText 
        : `https://dummy-portal.com/${cleanText.startsWith('?') ? cleanText : '?' + cleanText}`;
      const url = new URL(urlString);
      const campId = url.searchParams.get('campaign') || 
                     url.searchParams.get('cmp') || 
                     url.searchParams.get('c') || 
                     url.searchParams.get('id') || 
                     url.searchParams.get('bawm');
      const cat = url.searchParams.get('cat') as BawmCategory;
      const title = url.searchParams.get('title');
      const upi = url.searchParams.get('upi');
      const loc = url.searchParams.get('loc');
      const org = url.searchParams.get('org');
      const target = url.searchParams.get('target');

      if (campId) {
        const matched = campaigns.find(c => c.id.toLowerCase() === campId.toLowerCase());
        if (matched) {
          return {
            type: matched.status === 'pending_approval' ? 'pending' : matched.category,
            campaign: matched,
            rawText: cleanText
          };
        }

        // Reconstruct from URL parameters if available
        const reconstructedCamp: Campaign = {
          id: campId,
          category: (cat || (campId.startsWith('cmp-k') ? 'kumtluang' : campId.startsWith('cmp-r') ? 'ralna' : 'others')) as BawmCategory,
          title: title ? decodeURIComponent(title) : 'Scanned Bawm Portal',
          location: loc ? decodeURIComponent(loc) : 'Mizoram',
          gpsCoords: '23.7271, 92.7176',
          upiId: upi ? decodeURIComponent(upi) : 'ronpay@axl',
          orgCode: org ? decodeURIComponent(org) : undefined,
          targetAmount: target ? Number(target) : undefined,
          validityDate: '2027-12-31',
          status: 'active',
          createdAt: new Date().toISOString()
        };

        return {
          type: reconstructedCamp.category,
          campaign: reconstructedCamp,
          rawText: cleanText
        };
      }
    } catch {
      // Fallback
    }
  }

  // 3. UPI Payment URI parsing (e.g. upi://pay?pa=...&pn=...&tn=RonPay:cmp-123&am=500)
  if (cleanText.toLowerCase().startsWith('upi://pay')) {
    try {
      const queryString = cleanText.includes('?') ? cleanText.split('?')[1] : cleanText.replace(/upi:\/\/pay\??/i, '');
      const params = new URLSearchParams(queryString);
      const pa = (params.get('pa') || '').trim();
      const pn = (params.get('pn') || '').trim();
      const tn = (params.get('tn') || '').trim();
      const am = params.get('am');

      // Check if tn or note contains explicit RonPay campaign ID (e.g. "RonPay:cmp-xxx", "cmp-xxx", etc.)
      let targetId = '';
      const decodedTn = decodeURIComponent(tn);
      if (decodedTn.includes('RonPay:')) {
        const afterRonPay = decodedTn.split('RonPay:')[1]?.trim() || '';
        targetId = afterRonPay.split(':')[0]?.split(' ')[0]?.split('&')[0]?.trim() || '';
      } else if (decodedTn.startsWith('cmp-')) {
        targetId = decodedTn.trim();
      } else if (decodedTn.toLowerCase().includes('cmp-')) {
        const match = decodedTn.match(/cmp-[a-zA-Z0-9_-]+/i);
        if (match) targetId = match[0];
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

      // Check if pa (VPA) matches a known campaign UPI ID
      if (pa) {
        const foundByUpi = campaigns.find(c => c.upiId && c.upiId.toLowerCase() === pa.toLowerCase());
        if (foundByUpi) {
          return {
            type: foundByUpi.status === 'pending_approval' ? 'pending' : foundByUpi.category,
            campaign: foundByUpi,
            rawText: cleanText
          };
        }
      }

      // Standard / Generic External UPI QR (Google Pay, PhonePe, Paytm, BharatPe, Merchant QR)
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

  // 4. Exact Campaign ID match (e.g. cmp-174065321)
  const foundById = campaigns.find(c => c.id.toLowerCase() === cleanText.toLowerCase());
  if (foundById) {
    return {
      type: foundById.status === 'pending_approval' ? 'pending' : foundById.category,
      campaign: foundById,
      rawText: cleanText
    };
  }

  // 5. Match by Campaign Title
  const foundByTitle = campaigns.find(c => 
    c.id.toLowerCase() === cleanText.toLowerCase() ||
    (cleanText.length > 3 && c.title.toLowerCase().trim() === cleanText.toLowerCase().trim())
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
  const fallbackCamp: Campaign = {
    id: `scan-${Date.now()}`,
    category: 'others',
    title: cleanText.length > 25 ? `${cleanText.substring(0, 25)}...` : cleanText,
    location: 'Scanned Payment Target',
    gpsCoords: '23.7271, 92.7176',
    upiId: 'ronpay@axl',
    validityDate: '2027-12-31',
    status: 'active',
    createdAt: new Date().toISOString()
  };

  return {
    type: 'general-upi',
    campaign: fallbackCamp,
    rawText: cleanText
  };
}

interface QRScannerModalProps {
  isOpen: boolean;
  targetCategory?: BawmCategory | 'any';
  categoryFilter?: BawmCategory | 'any';
  campaigns: Campaign[];
  onClose: () => void;
  onScanResult?: (scannedPayload: ScannedQRResult) => void;
  onSelectCampaign?: (campaign: Campaign) => void;
  onOpenExternalLanding?: (campaign: Campaign) => void;
  onMismatchDetected?: (category: BawmCategory) => void;
  onApproveCampaign?: (campaignId: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  targetCategory,
  categoryFilter,
  campaigns,
  onClose,
  onScanResult,
  onSelectCampaign,
  onOpenExternalLanding,
  onMismatchDetected,
  onApproveCampaign,
}) => {
  const propsRef = useRef({
    campaigns,
    targetCategory,
    categoryFilter,
    onClose,
    onScanResult,
    onSelectCampaign,
    onOpenExternalLanding,
    onMismatchDetected,
    onApproveCampaign,
  });
  propsRef.current = {
    campaigns,
    targetCategory,
    categoryFilter,
    onClose,
    onScanResult,
    onSelectCampaign,
    onOpenExternalLanding,
    onMismatchDetected,
    onApproveCampaign,
  };

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [, setLastScannedText] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef<boolean>(false);

  // Check Android environment & bridge
  const isAndroidApp = typeof window !== 'undefined' && (
    !!(window as any).RonPayBridge ||
    !!(window as any).AndroidBlobDownloader ||
    !!(window as any).AndroidDownloader ||
    /wv|Android.*Version\/[0-9.]+/i.test(navigator.userAgent)
  );

  const androidBridge = typeof window !== 'undefined' ? (
    (window as any).RonPayBridge ||
    (window as any).AndroidBlobDownloader ||
    (window as any).AndroidDownloader
  ) : null;

  const hasNativeScannerBridge = !!(
    androidBridge && (
      typeof androidBridge.openQrScanner === 'function' ||
      typeof androidBridge.scanQRCode === 'function' ||
      typeof androidBridge.openCamera === 'function' ||
      typeof androidBridge.scanQr === 'function'
    )
  );

  // Trigger Native Android APK Scanner if available
  const handleNativeAndroidScan = () => {
    if (!androidBridge) return;
    try {
      if (typeof androidBridge.openQrScanner === 'function') {
        androidBridge.openQrScanner();
      } else if (typeof androidBridge.scanQRCode === 'function') {
        androidBridge.scanQRCode();
      } else if (typeof androidBridge.openCamera === 'function') {
        androidBridge.openCamera();
      } else if (typeof androidBridge.scanQr === 'function') {
        androidBridge.scanQr();
      }
    } catch (e) {
      console.warn('Android bridge scan error:', e);
    }
  };

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

  // Process decoded QR text cleanly and route appropriately
  const handleRawDecodedData = useCallback((rawText: string) => {
    if (!rawText || !rawText.trim()) return;
    
    // Stop camera immediately upon detection
    stopCamera();
    setLastScannedText(rawText);

    // Reset file inputs so subsequent uploads start fresh
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraCaptureInputRef.current) cameraCaptureInputRef.current.value = '';

    const {
      campaigns: curCampaigns,
      onClose: curOnClose,
      onScanResult: curOnScanResult,
      onSelectCampaign: curOnSelectCampaign,
      onOpenExternalLanding: curOnOpenExternalLanding,
      onMismatchDetected: curOnMismatchDetected,
      targetCategory: curTargetCategory,
      categoryFilter: curCategoryFilter,
    } = propsRef.current;

    // Parse payload
    const result = parseScannedPayload(rawText, curCampaigns);

    // Close the scanner modal
    curOnClose();

    // 1. If explicit onScanResult callback is provided, invoke it
    if (curOnScanResult) {
      curOnScanResult(result);
    }

    // 2. If standard App.tsx modal props are provided
    if (result.type === 'pending' && result.campaign) {
      if (curOnSelectCampaign) {
        curOnSelectCampaign(result.campaign);
      }
    } else if (result.type === 'general-upi' && result.campaign) {
      if (curOnOpenExternalLanding) {
        curOnOpenExternalLanding(result.campaign);
      } else if (curOnSelectCampaign) {
        curOnSelectCampaign(result.campaign);
      }
    } else if (result.campaign) {
      const activeFilter = curTargetCategory || curCategoryFilter || 'any';
      if (activeFilter !== 'any' && activeFilter !== result.campaign.category) {
        if (curOnMismatchDetected) {
          curOnMismatchDetected(result.campaign.category);
        } else if (curOnSelectCampaign) {
          curOnSelectCampaign(result.campaign);
        }
      } else {
        if (curOnSelectCampaign) {
          curOnSelectCampaign(result.campaign);
        }
      }
    }
  }, [stopCamera]);

  // BarcodeDetector instance if available
  const barcodeDetectorRef = useRef<any>(null);
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        barcodeDetectorRef.current = null;
      }
    }
  }, []);

  // Continuous QR scan loop using BarcodeDetector + jsQR
  const tickScan = useCallback(async () => {
    if (!isScanningRef.current) return;

    if (!videoRef.current || videoRef.current.readyState < 2 || videoRef.current.videoWidth === 0) {
      animFrameIdRef.current = requestAnimationFrame(tickScan);
      return;
    }

    const video = videoRef.current;

    // 1. Try Hardware-Accelerated Native BarcodeDetector directly on Video element
    if (barcodeDetectorRef.current) {
      try {
        const barcodes = await barcodeDetectorRef.current.detect(video);
        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
          handleRawDecodedData(barcodes[0].rawValue);
          return;
        }
      } catch (e) {
        // Fallback to canvas/jsQR
      }
    }

    // 2. High performance Canvas + jsQR pass
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
      // Optimal resolution for jsQR (around 640-800px width for fast decoding)
      const scale = Math.min(1, 800 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code && code.data && code.data.trim()) {
        handleRawDecodedData(code.data);
        return;
      }

      // If full frame didn't find, try center-box crop (zoomed center 70%)
      const cropW = Math.round(canvas.width * 0.7);
      const cropH = Math.round(canvas.height * 0.7);
      const cropX = Math.round((canvas.width - cropW) / 2);
      const cropY = Math.round((canvas.height - cropH) / 2);
      const cropData = ctx.getImageData(cropX, cropY, cropW, cropH);
      const cropCode = jsQR(cropData.data, cropData.width, cropData.height, {
        inversionAttempts: 'attemptBoth'
      });

      if (cropCode && cropCode.data && cropCode.data.trim()) {
        handleRawDecodedData(cropCode.data);
        return;
      }
    }

    if (isScanningRef.current) {
      animFrameIdRef.current = requestAnimationFrame(tickScan);
    }
  }, [handleRawDecodedData]);

  // Start Camera Stream with Progressive Fallbacks and robust playback triggers
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    // 1. Teardown any prior stream before starting fresh
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
      streamRef.current = null;
    }

    setCameraError(null);
    setIsStartingCamera(true);

    // 2. Security Check: Modern browsers and WebViews block getUserMedia on insecure HTTP
    const isSecure = typeof window !== 'undefined' && (
      window.isSecureContext ||
      location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1'
    );

    if (!isSecure) {
      setCameraError(
        "Browser-in HTTP-ah live camera a block a ni. Website hi HTTPS (https://...) ah deploy rawh le, emaw 'Snap Photo' / 'Gallery Upload' hmang rawh le."
      );
      setCameraActive(false);
      setIsStartingCamera(false);
      return;
    }

    // Progressive browser media access helper
    const getMedia = (
      navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
      (navigator as any).getUserMedia?.bind(navigator) ||
      (navigator as any).webkitGetUserMedia?.bind(navigator) ||
      (navigator as any).mozGetUserMedia?.bind(navigator)
    );

    if (!getMedia) {
      setCameraError('Browser / WebView-ah camera stream a in-block a ni. "Snap Photo" emaw "Gallery Upload" hmang rawh le.');
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

    const getMediaWithTimeout = (constraints: MediaStreamConstraints, timeoutMs = 4500): Promise<MediaStream | null> => {
      return new Promise((resolve) => {
        let finished = false;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            console.warn('Camera request timed out after', timeoutMs, 'ms');
            resolve(null);
          }
        }, timeoutMs);

        try {
          getMedia(constraints)
            .then((s: MediaStream) => {
              if (!finished) {
                finished = true;
                clearTimeout(timer);
                resolve(s);
              }
            })
            .catch((err: any) => {
              if (!finished) {
                finished = true;
                clearTimeout(timer);
                lastErr = err;
                console.warn('Camera constraint attempt failed:', constraints, err);
                resolve(null);
              }
            });
        } catch (syncErr: any) {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            lastErr = syncErr;
            resolve(null);
          }
        }
      });
    };

    for (const constraints of constraintList) {
      stream = await getMediaWithTimeout(constraints, 4000);
      if (stream) break;
      if (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError') {
        break;
      }
    }

    if (!stream) {
      console.warn('Camera stream could not be acquired:', lastErr);
      let errorMsg = 'Camera a in hawng thei lo. "Snap Photo" emaw "Gallery Upload" hmang rawh le.';
      if (lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission pe a ni lo (Permission Denied). Browser / Android app settings-ah camera phal la, emaw "Snap Photo" hmang rawh le.';
      } else if (lastErr?.name === 'NotFoundError' || lastErr?.name === 'DevicesNotFoundError') {
        errorMsg = 'Camera hardware hmuh a ni lo. "Snap Photo" emaw "Gallery Upload" hmang rawh le.';
      } else if (lastErr?.name === 'NotReadableError' || lastErr?.name === 'TrackStartError') {
        errorMsg = 'Camera hi app dangin an hmang mek a nih hmel. App dang khar la, ti nawn leh rawh le.';
      }
      setCameraError(errorMsg);
      setCameraActive(false);
      setIsStartingCamera(false);
      return;
    }

    streamRef.current = stream;

    // Check torch capability
    try {
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as any;
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }
    } catch {
      setHasTorch(false);
    }

    const video = videoRef.current;
    if (!video) {
      setIsStartingCamera(false);
      return;
    }

    // Set DOM attributes and properties for mobile autoplay & inline playback
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.srcObject = stream;

    const activatePlayback = async () => {
      try {
        await video.play();
        setCameraActive(true);
        setIsStartingCamera(false);
        setCameraError(null);
        isScanningRef.current = true;
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = requestAnimationFrame(tickScan);
      } catch (playErr) {
        console.warn('Direct video.play() error (user interaction might be needed):', playErr);
        // Autoplay policy waiting for user gesture
        setCameraActive(false);
        setIsStartingCamera(false);
        setCameraError('Camera stream in peih e. Viewfinder-ah hmet la emaw "Start Stream" click rawh le.');
      }
    };

    if (video.readyState >= 2) {
      activatePlayback();
    } else {
      video.onloadedmetadata = () => {
        activatePlayback();
      };
      setTimeout(() => {
        if (!isScanningRef.current && videoRef.current?.srcObject) {
          activatePlayback();
        }
      }, 350);
      setTimeout(() => {
        if (!isScanningRef.current) {
          setIsStartingCamera(false);
        }
      }, 3000);
    }
  }, [tickScan]);

  // Tap viewfinder or button to force play if mobile browser blocked initial autoplay
  const handleUserTapToPlay = async () => {
    if (videoRef.current && streamRef.current) {
      try {
        await videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
        isScanningRef.current = true;
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = requestAnimationFrame(tickScan);
        return;
      } catch (e) {
        console.warn('Tap play error, restarting camera:', e);
      }
    }
    startCamera(facingMode);
  };

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

  // Helper to decode image using BarcodeDetector if available, otherwise multi-pass jsQR with thresholding & cropping
  const decodeImageElement = async (img: HTMLImageElement): Promise<string | null> => {
    // 1. Try native BarcodeDetector API (fastest on modern Chrome/Android)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
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

    // 2. jsQR Multi-resolution & Multi-pass
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Resolutions to try (Original, 1200px, 800px, 500px)
    const targetSizes = [
      { w: img.width, h: img.height },
      { w: Math.min(1200, img.width), h: Math.round(img.height * (Math.min(1200, img.width) / img.width)) },
      { w: Math.min(800, img.width), h: Math.round(img.height * (Math.min(800, img.width) / img.width)) },
      { w: Math.min(500, img.width), h: Math.round(img.height * (Math.min(500, img.width) / img.width)) }
    ];

    for (const size of targetSizes) {
      canvas.width = size.w;
      canvas.height = size.h;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Pass A: Normal image
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const codeA = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (codeA && codeA.data && codeA.data.trim()) {
        return codeA.data.trim();
      }

      // Pass B: Center Crop (Zoomed 70%)
      const cropW = Math.round(canvas.width * 0.7);
      const cropH = Math.round(canvas.height * 0.7);
      const cropX = Math.round((canvas.width - cropW) / 2);
      const cropY = Math.round((canvas.height - cropH) / 2);
      const cropData = ctx.getImageData(cropX, cropY, cropW, cropH);
      const cropCode = jsQR(cropData.data, cropData.width, cropData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (cropCode && cropCode.data && cropCode.data.trim()) {
        return cropCode.data.trim();
      }

      // Pass C: High Contrast / Binarization (Otsu-like thresholding for low light or glare photos)
      const binaryData = ctx.createImageData(canvas.width, canvas.height);
      let sum = 0;
      const count = imgData.width * imgData.height;
      for (let i = 0; i < imgData.data.length; i += 4) {
        const gray = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
        sum += gray;
      }
      const avgBrightness = sum / count;
      for (let i = 0; i < imgData.data.length; i += 4) {
        const gray = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
        const val = gray > avgBrightness ? 255 : 0;
        binaryData.data[i] = val;
        binaryData.data[i + 1] = val;
        binaryData.data[i + 2] = val;
        binaryData.data[i + 3] = 255;
      }
      const codeC = jsQR(binaryData.data, binaryData.width, binaryData.height, {
        inversionAttempts: 'attemptBoth'
      });
      if (codeC && codeC.data && codeC.data.trim()) {
        return codeC.data.trim();
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
    setUploadToast(null);
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
            setUploadToast('⚠️ QR Code hmuh a ni lo. Thlalak fiah zawk thlang leh chhin rawh le.');
            setTimeout(() => setUploadToast(null), 4000);
          }
        } catch (err) {
          console.error('QR decode error:', err);
          setIsProcessingFile(false);
          inputElement.value = '';
          setUploadToast('⚠️ Thlalak chhiar theih a ni lo. A dang han thlang leh chhin rawh le.');
          setTimeout(() => setUploadToast(null), 4000);
        }
      };
      img.onerror = () => {
        setIsProcessingFile(false);
        inputElement.value = '';
        setUploadToast('⚠️ Thlalak load theih a ni lo.');
        setTimeout(() => setUploadToast(null), 4000);
      };
      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      setIsProcessingFile(false);
      inputElement.value = '';
      setUploadToast('⚠️ File chhiar theih a ni lo.');
      setTimeout(() => setUploadToast(null), 4000);
    };

    reader.readAsDataURL(file);
  };

  // Reset scanner state completely
  const handleResetScanner = () => {
    stopCamera();
    setLastScannedText(null);
    setCameraError(null);
    setUploadToast(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraCaptureInputRef.current) cameraCaptureInputRef.current.value = '';
    setTimeout(() => {
      startCamera(facingMode);
    }, 120);
  };

  // Lifecycle: only start camera when modal opens, stop cleanly when modal closes
  useEffect(() => {
    if (isOpen) {
      setLastScannedText(null);
      setCameraError(null);
      setUploadToast(null);

      // Register global handler for Android Native Scanner Bridge (if APK calls back)
      (window as any).onAndroidQrScanned = (scannedText: string) => {
        if (scannedText && typeof scannedText === 'string') {
          handleRawDecodedData(scannedText);
        }
      };

      const timer = setTimeout(() => {
        startCamera(facingMode);
      }, 120);

      return () => {
        clearTimeout(timer);
        stopCamera();
        try {
          delete (window as any).onAndroidQrScanned;
        } catch {}
      };
    } else {
      stopCamera();
    }
  }, [isOpen, facingMode, startCamera, stopCamera, handleRawDecodedData]);

  if (!isOpen) return null;

  const targetTitle = !targetCategory || targetCategory === 'any' 
    ? 'Scan Any UPI / RonPay QR' 
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

      {/* Upload Toast Banner if file decode encounters issue */}
      {uploadToast && (
        <div className="z-30 mx-auto max-w-sm w-full bg-rose-950/90 border border-rose-500/50 text-rose-200 text-xs py-2 px-3 rounded-xl shadow-lg flex items-center justify-between gap-2 animate-bounce">
          <span className="font-semibold">{uploadToast}</span>
          <button onClick={() => setUploadToast(null)} className="text-rose-300 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Central Viewfinder Area */}
      <div className="relative my-auto flex flex-col items-center justify-center py-2 shrink-0">
        <div 
          onClick={!cameraActive ? handleUserTapToPlay : undefined}
          className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-amber-400/80 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.35)] bg-slate-900 flex items-center justify-center cursor-pointer"
          title={!cameraActive ? "Click to start camera" : undefined}
        >
          {/* Live Camera Video (always mounted to prevent mobile autoplay blocks) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onPlaying={() => {
              setCameraActive(true);
              setIsStartingCamera(false);
              setCameraError(null);
            }}
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
            <div className="text-center p-2.5 sm:p-3 space-y-1.5 z-10 w-full max-w-[250px]">
              <Camera className="w-8 h-8 mx-auto text-amber-400/90 animate-pulse" />
              
              {cameraError?.includes('Permission Denied') ? (
                <div className="bg-rose-950/80 border border-rose-500/60 p-2.5 rounded-xl text-left space-y-1.5">
                  <div className="flex items-center gap-1.5 text-rose-300 font-bold text-[11px]">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>Browser-in Camera a Block mek:</span>
                  </div>
                  <div className="text-[10px] text-rose-100 space-y-1 leading-tight">
                    <p>
                      <strong>💻 Laptop-ah:</strong> Chrome URL bula <strong>Tune icon 🎚️</strong> / Lock 🔒 hmet la, <strong>Camera</strong> kha <strong>&quot;Allow / On&quot;</strong> rawh le.
                    </p>
                    <p>
                      <strong>📱 Phone-ah:</strong> URL bula <strong>Lock icon 🔒</strong> hmet la ➔ <em>Permissions</em> ➔ <em>Camera</em> kha <strong>Allow</strong> rawh le.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        startCamera(facingMode);
                      }}
                      className="w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition shadow"
                    >
                      <RefreshCw className="w-3 h-3" /> Re-check / Allow Dil Nawn Rawh
                    </button>
                    {typeof window !== 'undefined' && window.location.hostname.includes('ronpay.app') && (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = 'https://ronpay-001-pi.vercel.app';
                        }}
                        className="w-full py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 cursor-pointer transition shadow"
                      >
                        Vercel Domain-ah Hawng Rawh (ronpay-001-pi...)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-[11.5px] font-bold text-slate-200 leading-tight">
                  {cameraError || (isStartingCamera ? 'Camera stream in hawng mek a ni...' : 'Camera stream nghah mek a ni')}
                </p>
              )}
              
              <div className="flex flex-col gap-1.5 pt-1">
                {hasNativeScannerBridge && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNativeAndroidScan();
                    }}
                    className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs py-2 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Android APK Scanner
                  </button>
                )}

                {!cameraError?.includes('Permission Denied') && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUserTapToPlay();
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs py-1.5 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Start / Re-start Camera
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraCaptureInputRef.current?.click();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <Camera className="w-3.5 h-3.5" /> Snap Photo (Camera)
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

        {/* Upload & Snapshot Action Pills under viewfinder */}
        <div className="mt-3.5 flex items-center gap-2 flex-wrap justify-center">
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

      {/* Clean Scanner Guidance Card (Simulators completely removed as requested) */}
      <div className="z-10 bg-slate-900/80 border border-slate-800/80 p-3 rounded-2xl max-w-sm mx-auto w-full text-center space-y-1 backdrop-blur-sm shadow-xl">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-300">
          <QrCode className="w-3.5 h-3.5" />
          <span>Point Camera at Any QR Code</span>
        </div>
        <p className="text-[10.5px] text-slate-400 leading-relaxed font-medium">
          RonPay Bawm QR, Google Pay, PhonePe, Paytm, leh UPI QR hrim hrim auto-scan theih a ni.
        </p>
      </div>
    </div>
  );
};
