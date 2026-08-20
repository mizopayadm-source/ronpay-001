import React, { useState, useEffect, useRef } from 'react';
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
  Check
} from 'lucide-react';
import jsQR from 'jsqr';
import { BawmCategory, Campaign } from '../types';
import { BAWM_CONFIG } from '../data/initialData';

interface QRScannerModalProps {
  isOpen: boolean;
  targetCategory: BawmCategory | 'any';
  campaigns: Campaign[];
  onClose: () => void;
  onScanResult: (scannedPayload: {
    type: BawmCategory | 'general-upi' | 'pending';
    campaign?: Campaign;
    rawText?: string;
  }) => void;
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start Camera Stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Camera access is not supported by your browser or inside this frame.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }

        // Start scanning loop
        requestAnimationFrame(tickScan);
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Camera permission was denied. Please allow camera access or use File Upload.'
          : 'Could not access camera hardware. You can upload a QR image instead.'
      );
      setCameraActive(false);
    }
  };

  // Continuous QR scan loop using jsQR
  const tickScan = () => {
    if (!videoRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
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
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        handleRawDecodedData(code.data);
        return;
      }
    }

    animFrameIdRef.current = requestAnimationFrame(tickScan);
  };

  // Process decoded QR text
  const handleRawDecodedData = (rawText: string) => {
    stopCamera();

    // 1. Try parsing JSON payload from RonPay creator
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.platform === 'RonPay' || parsed.campaignId) {
        // Find existing campaign
        const matched = campaigns.find(c => c.id === parsed.campaignId) || {
          id: parsed.campaignId || 'cmp-scanned',
          category: parsed.category || 'ralna',
          title: parsed.title || 'Scanned Community Bawm',
          location: parsed.location || 'Aizawl, Mizoram',
          gpsCoords: '23.7271, 92.7176',
          upiId: parsed.upi || 'ronpay@axl',
          validityDate: parsed.validity || '2026-12-31',
          status: parsed.status || 'active',
          createdAt: new Date().toISOString(),
        } as Campaign;

        if (matched.status === 'pending_approval') {
          onScanResult({ type: 'pending', campaign: matched, rawText });
        } else {
          onScanResult({ type: matched.category, campaign: matched, rawText });
        }
        return;
      }
    } catch {
      // Not JSON
    }

    // 2. UPI String handling
    if (rawText.startsWith('upi://pay')) {
      onScanResult({ type: 'general-upi', rawText });
      return;
    }

    // 3. Match campaign by title or id
    const foundCampaign = campaigns.find(c => 
      c.id === rawText || 
      c.title.toLowerCase() === rawText.toLowerCase() ||
      rawText.toLowerCase().includes(c.title.toLowerCase())
    );

    if (foundCampaign) {
      if (foundCampaign.status === 'pending_approval') {
        onScanResult({ type: 'pending', campaign: foundCampaign, rawText });
      } else {
        onScanResult({ type: foundCampaign.category, campaign: foundCampaign, rawText });
      }
      return;
    }

    // Default fallback to general UPI
    onScanResult({ type: 'general-upi', rawText });
  };

  // Toggle Torch/Flashlight
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

  // File Upload QR Decode
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          setIsProcessingFile(false);
          if (code && code.data) {
            handleRawDecodedData(code.data);
          } else {
            alert('⚠️ QR Code hmuh a ni lo. Thlalak dang han thlang leh chhin rawh le.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const targetTitle = targetCategory === 'any' 
    ? 'Scanning Any UPI / RonPay QR' 
    : `Scanning for ${BAWM_CONFIG[targetCategory].name}`;

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col justify-between p-3 sm:p-4 backdrop-blur-md animate-fadeIn text-white">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept="image/*" 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      {/* Top bar */}
      <div className="flex justify-between items-center z-20">
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
      <div className="relative my-auto flex flex-col items-center justify-center">
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-amber-400/80 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(251,191,36,0.35)] bg-slate-900 flex items-center justify-center">
          {/* Live Camera Video */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
          />

          {/* Fallback if camera permission error or initializing */}
          {!cameraActive && (
            <div className="text-center p-4 space-y-2">
              <Camera className="w-10 h-10 mx-auto text-amber-400/80 animate-pulse" />
              <p className="text-xs font-bold text-slate-200">
                {cameraError || 'Camera On mek a ni...'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl inline-flex items-center gap-1.5 cursor-pointer mt-1"
              >
                <ImageIcon className="w-3.5 h-3.5" /> Upload QR Image
              </button>
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

        {/* Upload Button under viewfinder */}
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-amber-300 font-bold bg-amber-950/60 border border-amber-500/40 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-amber-900/80 transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" /> Upload QR from Gallery
          </button>
        </div>
      </div>

      {/* Interactive Scan Simulator & Admin Approval Trigger Section */}
      <div className="space-y-2 z-10 bg-slate-900/95 p-3 rounded-2xl border border-slate-800 shadow-2xl max-w-sm mx-auto w-full">
        <p className="text-[9.5px] text-slate-400 font-extrabold uppercase text-center tracking-wider">
          Quick Test & Bawm Simulators:
        </p>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => onScanResult({ type: 'general-upi' })}
            className="col-span-2 bg-indigo-700 hover:bg-indigo-600 text-white text-[10px] py-1.5 px-2 rounded-xl font-bold border border-indigo-500 flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-300" />
            Scan Any External UPI QR (GPay / PhonePe / Paytm)
          </button>

          <button
            onClick={() => {
              const c = campaigns.find(i => i.category === 'ralna' && i.status === 'active');
              onScanResult({ type: 'ralna', campaign: c });
            }}
            className="bg-purple-950 hover:bg-purple-900 text-purple-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-purple-700/60 transition cursor-pointer text-center"
          >
            Scan Ralna QR
          </button>

          <button
            onClick={() => {
              const c = campaigns.find(i => i.category === 'khawlsak' && i.status === 'active');
              onScanResult({ type: 'khawlsak', campaign: c });
            }}
            className="bg-emerald-950 hover:bg-emerald-900 text-emerald-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-emerald-700/60 transition cursor-pointer text-center"
          >
            Scan Khawlsak QR
          </button>

          <button
            onClick={() => {
              const c = campaigns.find(i => i.category === 'rikrum' && i.status === 'active');
              onScanResult({ type: 'rikrum', campaign: c });
            }}
            className="bg-rose-950 hover:bg-rose-900 text-rose-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-rose-700/60 transition cursor-pointer text-center"
          >
            Scan Rikrum QR
          </button>

          <button
            onClick={() => {
              const c = campaigns.find(i => i.category === 'kumtluang' && i.status === 'active');
              onScanResult({ type: 'kumtluang', campaign: c });
            }}
            className="bg-blue-950 hover:bg-blue-900 text-blue-200 text-[10px] py-1.5 px-2 rounded-xl font-bold border border-blue-700/60 transition cursor-pointer text-center"
          >
            Scan Kumtluang QR
          </button>

          {/* Pending Approval Test Button */}
          <button
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

              onScanResult({ type: 'pending', campaign: pendingC });
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
