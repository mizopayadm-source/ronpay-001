import React, { useState, useRef, useEffect } from 'react';
import {
  QrCode,
  ShieldCheck,
  Sparkles,
  Smartphone,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  Download,
  Building2,
  HeartHandshake,
  Receipt,
  Zap,
  HelpCircle,
  MessageCircle,
  ExternalLink,
  Volume2,
  Banknote,
  Flame,
  FileText,
  Lock,
  Globe,
  Share2,
  Check,
  Layers,
  Search,
  Printer,
  Mail,
  Copy,
  Phone,
  Send,
  Bot,
  User,
  Tv,
  Droplets,
  Car,
  GraduationCap,
  Landmark,
  ShieldAlert,
  CreditCard,
  X,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { Campaign, BawmCategory } from '../types';
import { askAIHriatpui } from '../services/aiHriatpuiService';

interface RonPayWebsiteProps {
  onLaunchApp: () => void;
  onOpenCreateQR?: () => void;
  onOpenRegister?: () => void;
  onOpenBillPay?: (service?: string) => void;
  onOpenAIKhualchhawn?: () => void;
  initialLanguage?: 'mizo' | 'english';
}

export const RonPayWebsite: React.FC<RonPayWebsiteProps> = ({
  onLaunchApp,
  onOpenCreateQR,
  onOpenRegister,
  onOpenBillPay,
  onOpenAIKhualchhawn,
  initialLanguage = 'mizo',
}) => {
  const [lang, setLang] = useState<'mizo' | 'english'>(initialLanguage);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [soundboxPlaying, setSoundboxPlaying] = useState<boolean>(false);
  const [simulatorCategory, setSimulatorCategory] = useState<BawmCategory>('ralna');
  const [simulatorAmount, setSimulatorAmount] = useState<number>(500);
  const [showSimulatedReceipt, setShowSimulatedReceipt] = useState<boolean>(false);

  // Email copy feedback state
  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);

  // Floating & embedded AI Khualchhawn Chat State
  const [isKhualchhawnOpen, setIsKhualchhawnOpen] = useState<boolean>(false);
  const [khualchhawnInput, setKhualchhawnInput] = useState<string>('');
  const [khualchhawnLoading, setKhualchhawnLoading] = useState<boolean>(false);
  const [khualchhawnMessages, setKhualchhawnMessages] = useState<Array<{ id: string; sender: 'ai' | 'user'; text: string; time: string }>>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'Chibai! RonPay Khualchhawn ka ni e. PhonePe thawhpuina, Bawm chi hrang hrang 7-te, BBPS utility bill pek dan, emaw RonPay kalphung chungchang engpawh min zawt la, ka lo pui zung zung ang che!',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isKhualchhawnOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [khualchhawnMessages, isKhualchhawnOpen]);

  const handleCopyEmail = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('ronpay@gmail.com');
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    }
  };

  const handleSendKhualchhawn = async (overrideQuery?: string) => {
    const q = (overrideQuery || khualchhawnInput).trim();
    if (!q || khualchhawnLoading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg = { id: `user-${Date.now()}`, sender: 'user' as const, text: q, time: timeStr };
    setKhualchhawnMessages(prev => [...prev, userMsg]);
    if (!overrideQuery) setKhualchhawnInput('');
    setKhualchhawnLoading(true);

    try {
      const response = await askAIHriatpui(q);
      const aiText = response?.answer || (lang === 'mizo' 
        ? 'RonPay hi Mizoram Kohhran leh Khawtlang tana Digital Bawm platform a ni a, PhonePe direct integration hmangin sum direct bank account-ah a lut zel a ni.' 
        : 'RonPay is Mizoram community digital bawm platform powered by PhonePe integration with direct bank settlements.');
      
      setKhualchhawnMessages(prev => [
        ...prev,
        { id: `ai-${Date.now()}`, sender: 'ai' as const, text: aiText, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    } catch {
      setKhualchhawnMessages(prev => [
        ...prev,
        { 
          id: `ai-${Date.now()}`, 
          sender: 'ai' as const, 
          text: lang === 'mizo' ? 'Ka lawm e! RonPay chungchang zawhna atan email: ronpay@gmail.com emaw WhatsApp 9862899001-ah biakpawh theih reng kan ni e.' : 'For more assistance, reach us at ronpay@gmail.com or WhatsApp +91 9862899001.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        },
      ]);
    } finally {
      setKhualchhawnLoading(false);
    }
  };

  // Soundbox voice audio synthesis demo
  const playSoundboxDemo = () => {
    try {
      setSoundboxPlaying(true);
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        
        // Pleasant payment chime (E-flat major triad)
        const notes = [587.33, 739.99, 880.0];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
          gain.gain.setValueAtTime(0.2, ctx.currentTime + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.12);
          osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
        });
      }

      // Voice prompt using Web Speech Synthesis if available
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(
          lang === 'mizo' 
            ? `RonPay-ah cheng zanga dawn a ni e` 
            : `Received Rupees five hundred on RonPay`
        );
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        utterance.onend = () => setSoundboxPlaying(false);
        utterance.onerror = () => setSoundboxPlaying(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setTimeout(() => setSoundboxPlaying(false), 2000);
      }
    } catch {
      setSoundboxPlaying(false);
    }
  };

  const isMizo = lang === 'mizo';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-orange-500 selection:text-white relative overflow-x-hidden">
      
      {/* Top Authorized Partner Status Bar */}
      <aside aria-label="Announcement" className="w-full bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border-b border-indigo-900/40 px-3 py-1.5 text-center text-[10px] sm:text-xs font-semibold text-indigo-200 flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1.5 bg-purple-500/25 text-purple-200 px-2.5 py-0.5 rounded-full border border-purple-400/40 text-[9.5px] font-black uppercase tracking-wider">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>{isMizo ? 'PhonePe Co-Working Partner' : 'Official PhonePe PG V2 Partner'}</span>
        </span>
        <span className="hidden sm:inline text-indigo-300/60">•</span>
        <span className="text-slate-300 truncate font-medium">
          {isMizo 
            ? 'India-a Digital Payment Company Lian Ber PhonePe Nen A Hnathawk Dun' 
            : "Working in Partnership with India's Leading Digital Payments Giant PhonePe"}
        </span>
        <span className="hidden md:inline text-indigo-300/60">•</span>
        <span className="hidden md:inline text-amber-300 font-semibold">
          {isMizo ? 'BBPS & All-India Utility Live' : 'BBPS Utility Live'}
        </span>
      </aside>

      {/* Main Sticky Header */}
      <header className="sticky top-0 z-50 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-orange-500 p-0.5 shadow-md shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <span className="font-black text-lg text-transparent bg-clip-text bg-gradient-to-tr from-amber-400 via-orange-500 to-rose-400">
                  R
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-none">
                <span className="font-black text-lg sm:text-xl tracking-tight text-white">
                  Ron<span className="text-orange-500">Pay</span>
                </span>
                <span className="bg-purple-600/30 text-purple-300 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-purple-400/40 uppercase tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-[9.5px] text-slate-400 font-semibold tracking-tight">
                Mizo Community FinTech
              </p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden lg:flex items-center bg-slate-900/90 border border-slate-800/80 rounded-full p-1 text-xs font-semibold text-slate-300 shadow-inner">
            <a href="#hero" className="px-3 py-1.5 rounded-full bg-amber-400 text-slate-950 font-black shadow-xs transition">
              {isMizo ? 'Kawtchhuah' : 'Home'}
            </a>
            <a href="#phonepe" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-slate-800/60 text-purple-300 font-bold transition flex items-center gap-1">
              <span>PhonePe</span>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            </a>
            <a href="#services" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-slate-800/60 transition">
              {isMizo ? 'Services & Bawm' : 'Services & Bawms'}
            </a>
            <a href="#bbps" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-slate-800/60 text-amber-300 transition">
              BBPS BillPay
            </a>
            <a href="#features" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-slate-800/60 transition">
              {isMizo ? 'Hmanruate' : 'Features'}
            </a>
            <a href="#faq" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-slate-800/60 transition">
              FAQ
            </a>
            <a href="#contact" className="px-3 py-1.5 rounded-full hover:text-white hover:bg-slate-800/60 transition">
              {isMizo ? 'Biakpawhna' : 'Contact'}
            </a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher Pill */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setLang('mizo')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer text-[10px] ${
                  lang === 'mizo' 
                    ? 'bg-amber-400 text-slate-950 font-black' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                MZ
              </button>
              <button
                type="button"
                onClick={() => setLang('english')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer text-[10px] ${
                  lang === 'english' 
                    ? 'bg-amber-400 text-slate-950 font-black' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
            </div>

            {/* Launch App Main CTA */}
            <button
              type="button"
              onClick={onLaunchApp}
              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold text-xs sm:text-sm px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 transition cursor-pointer border border-indigo-400/40"
            >
              <Smartphone className="w-4 h-4 text-amber-300" />
              <span>{isMizo ? 'RonPay App Lut Rawh' : 'Launch RonPay App'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Glow ambient backgrounds */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Headlines & Call to Actions */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              {/* Feature Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>PhonePe PG V2 & TSP Certified</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>AI Hriatpui & BBPS Utility Bills</span>
                </div>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.15]">
                {isMizo ? (
                  <>
                    Mizoram <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-amber-300">Kohhran & Khawtlang</span> Tana Digital Payment & AI
                  </>
                ) : (
                  <>
                    Empowering <span className="text-purple-400">Mizo</span> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-orange-400 to-amber-300">Community</span> with Modern Digital Payments & AI
                  </>
                )}
              </h1>

              {/* Sub-headline / Copywriting */}
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl font-normal">
                {isMizo 
                  ? 'Ralna bawm, Kohhran thawhlawm chhungkaw bu, BBPS electric & tui bill, leh bank transfer te hi smart QR code, Mizo tawng soundbox, leh Gemini AI assistant hmanga awlsam leh fel taka enkawlna hmasa ber.' 
                  : 'Manage Ralna condolence funds, church tithes, BBPS electricity/water bills, and bank transfers with smart QR codes, Mizo voice announcements, and Gemini-powered AI Hriatpui assistant.'}
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-black text-base px-7 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition cursor-pointer border border-indigo-400/50"
                >
                  <Smartphone className="w-5 h-5 text-amber-300" />
                  <span>{isMizo ? 'RonPay Web App Hawng Rawh' : 'Launch RonPay Web App'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                {onOpenCreateQR && (
                  <button
                    type="button"
                    onClick={onOpenCreateQR}
                    className="bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-orange-400" />
                    <span>{isMizo ? 'QR Bawm Thar Siam Rawh' : 'Create QR Bawm'}</span>
                  </button>
                )}

                {onOpenRegister && (
                  <button
                    type="button"
                    onClick={onOpenRegister}
                    className="bg-slate-900/80 hover:bg-slate-800 text-indigo-300 font-bold text-sm px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 border border-indigo-900/50 transition cursor-pointer"
                  >
                    <Building2 className="w-4 h-4" />
                    <span>{isMizo ? 'Kohhran / Pawl Register' : 'Register Org'}</span>
                  </button>
                )}
              </div>

              {/* Trust Metric Counters */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-800/80">
                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                  <div className="text-xl sm:text-2xl font-black text-amber-400">₹95L+</div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {isMizo ? 'Sum Lutfai Kim' : 'Handled Securely'}
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                  <div className="text-xl sm:text-2xl font-black text-purple-400">600+</div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {isMizo ? 'Active QR Bawm' : 'Live Bawm QRs'}
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                  <div className="text-xl sm:text-2xl font-black text-emerald-400">120+</div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {isMizo ? 'Kohhran & YMA' : 'Churches & YMAs'}
                  </div>
                </div>

                <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800/60">
                  <div className="text-xl sm:text-2xl font-black text-sky-400">100%</div>
                  <div className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {isMizo ? 'Direct Bank-ah' : 'Direct to Bank'}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: High-Tech Phone & Soundbox Interactive Demo */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm">
                
                {/* Phone Frame Mockup */}
                <div className="relative bg-slate-900 border-4 border-slate-700/80 rounded-[38px] p-4 shadow-2xl shadow-purple-950/40 ring-1 ring-slate-800">
                  
                  {/* Phone Speaker Notch */}
                  <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <div className="w-8 h-1 bg-slate-700 rounded-full" />
                  </div>

                  {/* Card Header inside phone */}
                  <div className="bg-slate-800/90 rounded-2xl p-3 border border-slate-700/70 mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-black flex items-center justify-center text-xs border border-amber-400/30">
                        R
                      </div>
                      <div>
                        <div className="text-xs font-black text-white flex items-center gap-1">
                          <span>Pi Lalhmingliani Ralna</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Mission Veng • Verified
                        </div>
                      </div>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  </div>

                  {/* QR Code Canvas Mockup */}
                  <div className="bg-white p-4 rounded-2xl shadow-inner text-center text-slate-900 space-y-2">
                    <div className="w-48 h-48 mx-auto bg-slate-50 border-2 border-dashed border-indigo-200 rounded-xl p-3 flex flex-col items-center justify-center relative group">
                      <QrCode className="w-36 h-36 text-slate-900" />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-xl bg-orange-500 text-white font-black text-base flex items-center justify-center shadow-md border-2 border-white">
                          R
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
                      UPI / PhonePe Accepted
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 bg-slate-100 py-1 px-2 rounded-md">
                      ronpay.ralna@axl
                    </div>
                  </div>

                  {/* Soundbox Voice Interactive Demo Bar */}
                  <div className="mt-3 bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border border-purple-500/40 p-2.5 rounded-xl flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                        <Volume2 className={`w-4 h-4 ${soundboxPlaying ? 'text-amber-400 animate-bounce' : 'text-purple-300'}`} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-white">
                          Mizo Soundbox Voice
                        </div>
                        <div className="text-[8.5px] text-purple-300">
                          {soundboxPlaying ? 'Playing chime & voice...' : 'Click to hear audio'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={playSoundboxDemo}
                      disabled={soundboxPlaying}
                      className="bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
                    >
                      {soundboxPlaying ? 'Ngaihthlak mek...' : 'Play Demo 🔊'}
                    </button>
                  </div>

                  {/* Floating App Launch Quick Pill */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={onLaunchApp}
                      className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
                    >
                      <span>{isMizo ? 'RonPay App-ah Lut Rawh' : 'Launch RonPay App'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>

                {/* Simulated Floating Receipt badge on side */}
                <div className="hidden sm:flex absolute -bottom-5 -left-6 bg-slate-900 border border-emerald-500/40 p-3 rounded-2xl shadow-xl flex items-center gap-3 backdrop-blur-md">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-black text-white">Instant WhatsApp Receipt</div>
                    <div className="text-[9.5px] text-emerald-400">TXN-RAL-8429 • Verified</div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PhonePe Strategic Co-Working Partnership Section */}
      <section id="phonepe" className="py-16 sm:py-24 bg-gradient-to-b from-slate-950 via-purple-950/30 to-slate-950 border-y border-purple-900/40 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
          
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 text-xs font-black px-4 py-1.5 rounded-full border border-purple-400/40 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{isMizo ? 'Official Strategic Co-Working' : 'Strategic FinTech Alliance'}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              {isMizo ? (
                <>
                  Digital Payment Company Lian Ber <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-amber-300">PhonePe Nen A Hnathawk Dun</span>
                </>
              ) : (
                <>
                  Working in Strategic Partnership with <span className="text-purple-400">PhonePe</span> — India's Leading Digital Payments Giant
                </>
              )}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {isMizo 
                ? 'Mizoram tana digital platform hmasa ber leh rintlak ber RonPay hian India ram payment company lian ber PhonePe nen thawhdunna neiin, 99.9% transaction success rate, instant auto-settlement, leh high-level bank security kan vawng tlat a ni.' 
                : 'RonPay collaborates with PhonePe—India’s largest digital payments infrastructure—to bring 99.9% uptime, seamless multi-UPI intent, and direct bank-to-bank settlements for Mizo churches and institutions.'}
            </p>
          </div>

          {/* PhonePe High-Trust Feature Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1: Multi-App UPI Intent */}
            <div className="bg-slate-900/90 border border-purple-900/50 hover:border-purple-500/80 p-6 rounded-3xl space-y-3 transition duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition">
                <Smartphone className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                1. Unified UPI Intent
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'UPI Apps Zawng Zawng Support' : 'All UPI Apps Supported'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'PhonePe, Google Pay, Paytm, BHIM, Navi, Cred, leh bank UPI apps zawng zawng awlsam takin an thlang thei a, apps-ah direct-in a lut nghal zung zung.' 
                  : 'Payers choose their preferred app: PhonePe, Google Pay, Paytm, BHIM, Cred, Navi, or any banking app with instant direct routing.'}
              </p>
              <div className="pt-2 text-[11px] text-purple-300 font-bold flex items-center gap-1">
                <span>✓ PhonePe, GPay & Paytm Ready</span>
              </div>
            </div>

            {/* Feature 2: 99.9% Success Rate */}
            <div className="bg-slate-900/90 border border-purple-900/50 hover:border-purple-500/80 p-6 rounded-3xl space-y-3 transition duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition">
                <Zap className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                2. Enterprise Reliability
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? '99.9% Payment Success Rate' : '99.9% Uptime & Success'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'PhonePe PG V2 pipeline hmangin server buai leh sum tang a awm ve ngai lo. NPCI guidelines thlapin transaction a kal zung zung zel.' 
                  : 'Powered by enterprise-grade infrastructure to prevent failed transactions, drops, or timeouts even during high-volume Sunday giving.'}
              </p>
              <div className="pt-2 text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                <span>✓ Zero Payment Drops</span>
              </div>
            </div>

            {/* Feature 3: Direct-to-Bank Settlement */}
            <div className="bg-slate-900/90 border border-purple-900/50 hover:border-purple-500/80 p-6 rounded-3xl space-y-3 transition duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-amber-600/20 text-amber-300 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition">
                <Banknote className="w-6 h-6 text-amber-400" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                3. Zero Escrow
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'Direct Bank-to-Bank Luhna' : 'Direct Bank Settlement'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Sum lakkhawm reng reng chu intermediary account-ah vawn a ni lo. I Kohhran emaw Pawl bank account-ah direct-in a lut nghal zel.' 
                  : 'Funds settle straight into your official church or organizational bank account with zero middleman holding or escrow delay.'}
              </p>
              <div className="pt-2 text-[11px] text-amber-300 font-bold flex items-center gap-1">
                <span>✓ Direct IMPS / UPI Settlement</span>
              </div>
            </div>

            {/* Feature 4: Tamper-Proof Audio & Slips */}
            <div className="bg-slate-900/90 border border-purple-900/50 hover:border-purple-500/80 p-6 rounded-3xl space-y-3 transition duration-300 shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-sky-600/20 text-sky-300 flex items-center justify-center border border-sky-500/30 group-hover:scale-110 transition">
                <Volume2 className="w-6 h-6 text-sky-400" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                4. Instant Verification
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'Tamper-Proof & Soundbox' : 'Real-Time Soundbox Slips'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'UPI screenshot der bum theih loh nan server-verified callback leh Mizo tawng soundbox announcement rualin digital receipt a chhuak nghal.' 
                  : 'Instant tamper-proof transaction webhooks trigger authentic Mizo soundbox announcements and verified WhatsApp slips automatically.'}
              </p>
              <div className="pt-2 text-[11px] text-sky-300 font-bold flex items-center gap-1">
                <span>✓ Mizo Voice & Verified Slips</span>
              </div>
            </div>

          </div>

          {/* Co-Branded Trust Banner */}
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border border-purple-500/40 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#5f259f] text-white flex items-center justify-center font-black text-2xl shadow-lg border-2 border-purple-400/40 shrink-0">
                पे
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-white">PhonePe PG V2 Protocol</span>
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase">
                    Verified Partner
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {isMizo 
                    ? 'India rama fin-tech network lian ber nen thawk dunin, security leh customer trust sang ber kan chhawp chhuak e.' 
                    : "Powering Mizoram's leading community giving platform with PhonePe's certified banking grade security."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onLaunchApp}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-2"
              >
                <span>{isMizo ? 'RonPay App-ah Han Chhin Teh' : 'Test in RonPay App'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* RonPay Services / Bawm Hrang Hrang Tawi Fel Deuha Hrilhfiahna */}
      <section id="services" className="py-16 sm:py-24 bg-slate-900/40 border-b border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-300 text-xs font-bold px-3 py-1 rounded-full border border-amber-400/30">
              <Layers className="w-3.5 h-3.5" />
              {isMizo ? 'Bawm Hrang Hrang Hrilhfiahna' : 'Complete Bawm Architecture'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {isMizo ? 'RonPay Services & Bawm Chi Hrang Hrangte' : 'RonPay Specialized Giving Services'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {isMizo 
                ? 'Mizoram kohhran, khawtlang, tlawmngai pawl leh mimal mamawh mil tura duanchhuah bawm chi 7 tawi fel deuha hrilhfiahna:' 
                : 'A concise breakdown of each specialized Bawm category engineered for community clarity, transparency, and reporting:'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Service 1: Kumtluang Bawm */}
            <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition">
                <Building2 className="w-6 h-6 text-purple-300" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                  Kohhran & Tithes
                </span>
                <span className="bg-purple-900/40 text-purple-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-purple-700/50">
                  Quick Entry
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Kumtluang Bawm' : 'Kumtluang Church Bawm'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Kohhran thawhlawm chhungkaw bu enkawlna. Thla tin Pathian Ram, Tualchhung, Ramthim, leh Building Fund 4-digit quick entry hmanga ziah luhna leh Member roll bu fel fai.' 
                  : 'Manage complete church tithes, monthly household rolls, Pathian Ram, and Mission funds with blazing fast 4-digit Quick Entry.'}
              </p>
              <div className="pt-2 text-[11px] text-purple-300 font-semibold">
                • 4-Digit Quick Entry & Chhungkaw Bu Register
              </div>
            </div>

            {/* Service 2: Ralna Bawm */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition">
                <HeartHandshake className="w-6 h-6 text-amber-300" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                  Sunna & Condolence
                </span>
                <span className="bg-amber-900/40 text-amber-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-amber-700/50">
                  Poster Studio
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Ralna Bawm' : 'Ralna Condolence Bawm'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Mitthi sunna sum thawhkhawmna. Mitthi thlalak leh vui hun tarlan theihna QR poster, chhungte hnenah receipt leh ralna bu kimchang print theih nghal.' 
                  : 'Bereavement condolence drives. High-res obituary poster with deceased photo, funeral timing, and instant verified slips for the family.'}
              </p>
              <div className="pt-2 text-[11px] text-amber-300 font-semibold">
                • Obituary Photo Poster & Ralna Bu Print
              </div>
            </div>

            {/* Service 3: Khawlsak Bawm */}
            <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition">
                <Building2 className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Biak In Sak & Projects
                </span>
                <span className="bg-emerald-900/40 text-emerald-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-emerald-700/50">
                  Target Bar
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Khawlsak Bawm' : 'Khawlsak Project Bawm'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Kohhran Biak In sak, Hall sak, emaw khawtlang project lian tana sum thawhkhawmna. Target progress bar leh report fel tak nen.' 
                  : 'Church construction, community hall projects, and capital asset building with real-time target progress tracking.'}
              </p>
              <div className="pt-2 text-[11px] text-emerald-300 font-semibold">
                • Target Goal Meter & Committee Reports
              </div>
            </div>

            {/* Service 4: Rikrum Bawm */}
            <div className="bg-slate-900 border border-slate-800 hover:border-rose-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center border border-rose-500/30 group-hover:scale-110 transition">
                <ShieldAlert className="w-6 h-6 text-rose-400" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                  Damlo & Emergency
                </span>
                <span className="bg-rose-900/40 text-rose-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-rose-700/50">
                  Instant Launch
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Rikrum Bawm' : 'Rikrum Emergency Bawm'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Damlo zual, accident leh chhiatrupna rapthlak tawkte tanpuina puala rang taka sum khawnna. Minute 1 chhungin tanpuina QR a siam theih.' 
                  : 'Emergency medical aid, accident relief, and disaster campaigns launched in 60 seconds with verified community validation.'}
              </p>
              <div className="pt-2 text-[11px] text-rose-300 font-semibold">
                • 1-Minute Fast Deployment & Verification
              </div>
            </div>

            {/* Service 5: Kutdawh Bawm */}
            <div className="bg-slate-900 border border-slate-800 hover:border-sky-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-500/30 group-hover:scale-110 transition">
                <Users className="w-6 h-6 text-sky-300" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                  Reithei & Fahrah
                </span>
                <span className="bg-sky-900/40 text-sky-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-sky-700/50">
                  Compassion
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Kutdawh Bawm' : 'Kutdawh Benevolence Bawm'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Mi harsa, fahrah leh enkawltu neilote puala thawhlawm khawnna. Tlawmngai pawl leh kohhran tan sum thehluhte a fiahin a zahawm.' 
                  : 'Benevolence funds for orphans, the underprivileged, and elderly care. Transparent and dignified community charity.'}
              </p>
              <div className="pt-2 text-[11px] text-sky-300 font-semibold">
                • Transparent Benevolence Allocation
              </div>
            </div>

            {/* Service 6: Chawmhlum Bawm */}
            <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition">
                <Sparkles className="w-6 h-6 text-indigo-300" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                  Missionary & Sponsorship
                </span>
                <span className="bg-indigo-900/40 text-indigo-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-indigo-700/50">
                  Recurring
                </span>
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Chawmhlum Bawm' : 'Chawmhlum Missionary Bawm'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Missionary, Rawngbawltu leh zirlaite regular taka sum thawnna leh sponsor-na fel fai. Thla tin report a in-sync thlap zel.' 
                  : 'Regular sponsorship and support funds for missionaries, church workers, and students with recurring ledger tracking.'}
              </p>
              <div className="pt-2 text-[11px] text-indigo-300 font-semibold">
                • Monthly Roll & Donor Sponsorship Ledger
              </div>
            </div>

            {/* Service 7: Bawm Dangte */}
            <div className="bg-slate-900 border border-slate-800 hover:border-teal-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group lg:col-span-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 shrink-0">
                    <QrCode className="w-6 h-6 text-teal-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">
                        {isMizo ? 'Bawm Dangte (Events, Sports, Jubilee & Picnic)' : 'Custom Community & Event Bawms'}
                      </h3>
                      <span className="bg-teal-900/40 text-teal-300 text-[9px] font-bold px-2 py-0.5 rounded-md border border-teal-700/50 uppercase">
                        Versatile
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mt-1">
                      {isMizo 
                        ? 'Picnic, Jubilee lawmna, infiamna, leh mimal thil pawimawh tana QR Code awlsam taka siam zung zung theihna. Khawi hmun atang pawhin minute 1 chhungin hman theih a ni nghal.' 
                        : 'Custom QR Bawms for sports meets, church jubilees, community picnics, and cultural festivals with instant live QR generation.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
                >
                  <span>{isMizo ? 'Bawm Siam Rawh' : 'Create Custom Bawm'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Bharat BillPay (BBPS) & Mobile Topup Hub */}
      <section id="bbps" className="py-16 sm:py-24 bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950 border-b border-slate-800/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 text-xs font-black px-3.5 py-1 rounded-full border border-emerald-400/30 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              {isMizo ? 'Bharat BillPay & Topup Hub' : 'Bharat BillPay (BBPS) Live'}
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              {isMizo ? (
                <>
                  BBPS Utility Bills & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Mobile Topup Pekna Hmun</span>
                </>
              ) : (
                <>
                  Bharat BillPay (BBPS) & <span className="text-emerald-400">Mobile Topup Hub</span>
                </>
              )}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {isMizo 
                ? 'Power & Electricity (P&ED) electric bill, PHED Tui bill, FASTag, Sikul fee, Municipal Taxes, leh Mobile topup zung zung theihna hmun rintlak ber.' 
                : 'Clear all your daily utility bills seamlessly: P&ED electricity, PHED water, highway FASTag, tuition fees, municipal taxes, and mobile recharges in one unified platform.'}
            </p>
          </div>

          {/* 7 Core BBPS Utility Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* 1. Electricity */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'Power & Electric Bill (E-Bill)' : 'Electricity Bill (E-Bill)'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Mizoram P&ED (Power & Electricity Dept) & India ram pum power boards. Consumer ID chhut luh rualin bill a lo lang nghal (Auto-Fetch).' 
                  : 'Mizoram P&ED & all-India DISCOMs. Auto-fetch bills with Consumer ID with 0% extra convenience fee.'}
              </p>
              <div className="pt-1 text-[11px] font-bold text-amber-400">✓ P&ED Mizoram Auto-Fetch</div>
            </div>

            {/* 2. Water Bill */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-sky-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-500/30">
                <Droplets className="w-5 h-5 text-sky-400" />
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'PHED Tui Bill (Water Bill)' : 'Water Bill (PHED)'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'PHED Mizoram leh municipal water connection bill fel fai taka pekna leh official digital clearance receipt dawn nghalna.' 
                  : 'Public Health Engineering Dept (PHED) Mizoram water dues clearance with instant digital receipt.'}
              </p>
              <div className="pt-1 text-[11px] font-bold text-sky-400">✓ PHED Mizoram Verified</div>
            </div>

            {/* 3. FASTag */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                <Car className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'FASTag Toll Recharge' : 'FASTag Toll Recharge'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'National Highway Toll Plaza tana SBI, ICICI, Paytm, Airtel, Kotak, Axis Bank FASTag instant recharge.' 
                  : 'Instant recharge across all FASTag issuers (SBI, ICICI, Paytm, Airtel, Axis) in under 30 seconds.'}
              </p>
              <div className="pt-1 text-[11px] font-bold text-emerald-400">✓ All Banks FASTag Supported</div>
            </div>

            {/* 4. School Fees */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                <GraduationCap className="w-5 h-5 text-purple-400" />
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'School & College Fees' : 'School & College Fees'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Mizoram sikul leh college hrang hrang admission leh thla tin fee pekna, instant digital verification receipt nen.' 
                  : 'Direct educational fee remittances with automated digital acknowledgement slips for school records.'}
              </p>
              <div className="pt-1 text-[11px] font-bold text-purple-400">✓ Instant Admission & Tuition Slips</div>
            </div>

            {/* 5. Municipal Taxes */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                <Landmark className="w-5 h-5 text-indigo-400" />
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'Municipal Taxes & Property' : 'Municipal & Property Taxes'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Aizawl Municipal Corporation (AMC) chhiah leh municipal property taxes fel fai taka pek felna.' 
                  : 'Aizawl Municipal Corporation (AMC) and property tax settlements with official transaction IDs.'}
              </p>
              <div className="pt-1 text-[11px] font-bold text-indigo-400">✓ AMC Chhiah & Property Tax</div>
            </div>

            {/* 6. Mobile Recharge */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center border border-rose-500/30">
                <Smartphone className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base font-black text-white">
                {isMizo ? 'Mobile Topup (Prepaid/Postpaid)' : 'Mobile Topup & Recharge'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Jio, Airtel, Vodafone Idea (Vi), leh BSNL mobile recharge leh unlimited plan topup zung zung theihna.' 
                  : 'All mobile operators: Jio, Airtel, Vi, and BSNL with instant balance activation and plan selection.'}
              </p>
              <div className="pt-1 text-[11px] font-bold text-rose-400">✓ Jio, Airtel, Vi, BSNL Topup</div>
            </div>

            {/* 7. DTH Cable TV */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/60 p-5 rounded-3xl space-y-3 transition duration-200 shadow-md sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 shrink-0">
                  <Tv className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {isMizo ? 'DTH Cable TV Recharge' : 'DTH Cable TV Recharge'}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1">
                    {isMizo 
                      ? 'Tata Play, Airtel Digital TV, Dish TV, leh Sun Direct topup instant-a tih theih a ni e.' 
                      : 'Recharge Tata Play, Airtel DTH, Dish TV, and Sun Direct with immediate channel resumption.'}
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Interactive BBPS CTA Box */}
          <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-purple-950/50 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-base font-black text-white flex items-center justify-center sm:justify-start gap-2">
                <span>{isMizo ? 'BBPS Bill Pek Chhin I Duh Em?' : 'Ready to Pay Your Utility Bill?'}</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Zero Extra Fee
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {isMizo 
                  ? 'RonPay App chhungah lut la, "Bill Payments" thlangin i Electric emaw Tui bill lo pe chhin rawh le.' 
                  : 'Open RonPay App and select "Bill Payments" to clear your electricity, water, or FASTag bill now.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onOpenBillPay) {
                  onOpenBillPay();
                } else {
                  onLaunchApp();
                }
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs sm:text-sm px-6 py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center gap-2 shrink-0"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isMizo ? 'BBPS Bill Pekna Hawng Rawh' : 'Launch BBPS Bill Pay'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 sm:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-300 text-xs font-bold px-3 py-1 rounded-full border border-purple-400/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {isMizo ? 'RonPay Chanchin & Thiltum' : 'About RonPay Mission'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {isMizo ? 'Mizozia leh FinTech Hmasawnna Thlunzawmtu' : 'Bridging Mizo Community Values with Modern FinTech'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {isMizo 
                ? 'RonPay hi Mizoram Kohhran leh Khawtlang sum thawhkhawm, tithes, condolence contributions, leh utility bills te him leh fel taka enkawl tura kutchhuak ngat a ni.' 
                : 'RonPay is an authorized FinTech platform specifically engineered to digitize, secure, and streamline community collections, church tithes, condolence contributions, and utility bills across Mizoram.'}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Box: Why Traditional Giving Needed an Upgrade */}
            <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-black tracking-widest text-indigo-400 uppercase">
                  {isMizo ? 'ENGVANGA SIAM NGE KAN NIH?' : 'WHY TRADITIONAL GIVING NEEDED AN UPGRADE'}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-2 mb-3">
                  {isMizo ? 'Hmanlai Thawhlawm & Tunlai Mamawh' : 'The Need for Seamless Giving'}
                </h3>
                <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                  <p>
                    {isMizo 
                      ? 'Hmanlai atangin Mizo zia-ah chhiatni-thatni leh kohhranah sum thawhkhawm a ngai thin a. Mahse tunlai khawvelah cash ken a buaithlak a, UPI screenshot der hmanga inbumna a awm fo bawk.' 
                      : 'Traditional cash collections and manual record-keeping often face practical bottlenecks: tracking receipts, cash shortages, and fraudulent payment screenshots.'}
                  </p>
                  <p>
                    {isMizo 
                      ? 'Phai rama awmte leh hla taka awmten awlsam taka Ralna an rawn hlan theih nan leh, Committee-in fiah taka sum lut an hmuh theih nan RonPay hian platform felfai tak a rawn chhawp chhuak a ni.' 
                      : 'RonPay allows donors anywhere in India or abroad to contribute instantly via UPI with tamper-proof digital receipts and instant Mizo sound announcements.'}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isMizo ? 'UPI Screenshot Der A Awm Lo' : 'Zero Fake Screenshots'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isMizo ? 'Mizo Tawng Soundbox' : 'Mizo Voice Soundbox'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isMizo ? '1-Click Audit Report' : '1-Click Audit Reports'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{isMizo ? 'Offline-First Engine' : 'Offline-First Engine'}</span>
                </div>
              </div>
            </div>

            {/* Right Box: Architecture Core Engine */}
            <div className="lg:col-span-6 bg-gradient-to-br from-indigo-950/60 to-purple-950/40 border border-indigo-800/60 rounded-3xl p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                    Platform Architecture
                  </span>
                  <h4 className="text-xl font-black text-white">RonPay Core Engine</h4>
                </div>
                <span className="bg-indigo-600/30 text-indigo-300 text-[10px] font-black px-2.5 py-1 rounded-full border border-indigo-400/40 uppercase">
                  TSP PG V2
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-900/50">
                  <div className="text-[10px] uppercase font-bold text-indigo-300">Partner Settlement</div>
                  <div className="text-base font-black text-white mt-1">Instant IMPS</div>
                  <div className="text-[11px] text-emerald-400 mt-0.5">99% Direct to Beneficiary</div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-900/50">
                  <div className="text-[10px] uppercase font-bold text-purple-300">Voice Synthesis</div>
                  <div className="text-base font-black text-white mt-1">Dual Engine</div>
                  <div className="text-[11px] text-purple-300 mt-0.5">Authentic Mizo & English</div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-900/50">
                  <div className="text-[10px] uppercase font-bold text-amber-300">Accounting Protocol</div>
                  <div className="text-base font-black text-white mt-1">Dual-Ledger</div>
                  <div className="text-[11px] text-amber-300 mt-0.5">Cash + Online Unified</div>
                </div>

                <div className="bg-slate-950/80 p-4 rounded-2xl border border-indigo-900/50">
                  <div className="text-[10px] uppercase font-bold text-sky-300">Resilience</div>
                  <div className="text-base font-black text-white mt-1">Offline-Ready</div>
                  <div className="text-[11px] text-sky-300 mt-0.5">SmartCloud Background Sync</div>
                </div>
              </div>

              <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">
                    {isMizo ? 'RonPay Web App Experience' : 'Experience RonPay Right Now'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isMizo ? 'Install ngai lo, browser atangin a hman theih nghal.' : 'Zero installation required, launches in browser instantly.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLaunchApp}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1 transition shrink-0 cursor-pointer"
                >
                  <span>{isMizo ? 'Lut Rawh' : 'Launch'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Comprehensive Features Section (Bento Grid) */}
      <section id="features" className="py-16 sm:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-300 text-xs font-bold px-3 py-1 rounded-full border border-purple-400/30">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {isMizo ? 'Hmanrua & Feature Kimchang' : 'Complete Feature Suite'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {isMizo ? 'Mizoram Tan Liau Liava Duanchhuah' : 'Engineered for Performance & Community Ease'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {isMizo 
                ? 'Kohhran, Khawtlang, Tlawmngai pawl leh Mimal tana sum thawhkhawm leh enkawlna hmanrua famkim.' 
                : 'Discover the complete suite of payment and accounting tools built specifically for Mizo churches, families, and organizations.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1: Kumtluang Register */}
            <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition">
                <Building2 className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                1. Kohhran & Member Roll
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Kumtluang & Digital Chhungkaw Bu' : 'Kumtluang & Digital Family Register'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Kohhran thawhlawm chhungkaw bu, thla tin Pathian Ram, Tualchhung, Ramthim, leh Building Fund thlengin 4-digit Quick Entry hmangin awlsam takin a ziah luh theih.' 
                  : 'Manage complete church tithes, monthly family rolls, Pathian Ram, and Mission funds with our blazing fast 4-digit Quick Entry mode.'}
              </p>
              <div className="pt-2 text-[11px] text-purple-300 font-bold flex items-center gap-1">
                <span>✓ 4-Digit Quick Entry Ready</span>
              </div>
            </div>

            {/* Feature 2: Dual Mode Cash & Approval */}
            <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30 group-hover:scale-110 transition">
                <Banknote className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                2. Hybrid Cash & UPI
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Pawisa Fai (Cash) & Creator Hmuhpui' : 'Dual-Mode Cash Ledger & Approval'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Pawisa fai (cash) thehluhte pawh fiah taka chhinchhiahin, Creator emaw Admin-in awlsam takin "✓ Hmuhpui (Approve)" an hmet thei a, account a in-mil thlap zel.' 
                  : 'Record both physical cash envelopes and online UPI in one place. Creators easily verify and approve pending cash payments with one click.'}
              </p>
              <div className="pt-2 text-[11px] text-amber-300 font-bold flex items-center gap-1">
                <span>✓ 1-Click Instant Approve</span>
              </div>
            </div>

            {/* Feature 3: Dynamic Mizo QR Studio */}
            <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 group-hover:scale-110 transition">
                <QrCode className="w-5 h-5 text-indigo-300" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                3. Studio Engine
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Dynamic Mizo QR Poster Studio' : 'Dynamic Mizo QR Studio'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Mitthi thlalak, chanchin, vui hun, leh chhungte biakpawhna kimchang chuanna QR poster mawi tak minute 1 chhungin siam la, WhatsApp leh print-ah hmang nghal rawh.' 
                  : 'Generate high-resolution branded QR posters with obituary photo, funeral timing, donor instructions, and direct UPI deep linking.'}
              </p>
              <div className="pt-2 text-[11px] text-indigo-300 font-bold flex items-center gap-1">
                <span>✓ High-Resolution Ready</span>
              </div>
            </div>

            {/* Feature 4: 1-Click Committee & Audit Reports */}
            <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:scale-110 transition">
                <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                4. Financial Governance
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'Committee & Audit Ready Reports' : '1-Click Committee & Audit Reports'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Secretary leh Treasurer-te tan committee thutkhawma thehluh tur PDF leh Excel statement, sign-na hmun kimchang nen download theih nghal a ni.' 
                  : 'Generate official PDF and Excel audit statements complete with Treasurer and Finance Secretary signature blocks ready for review.'}
              </p>
              <div className="pt-2 text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                <span>✓ Official PDF & Excel Export</span>
              </div>
            </div>

            {/* Feature 5: Instant WhatsApp Receipts */}
            <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 group-hover:scale-110 transition">
                <Receipt className="w-5 h-5 text-purple-300" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-purple-400">
                5. Transparency & Trust
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'WhatsApp & SMS Digital Receipt' : 'Instant WhatsApp & SMS Slips'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Pawisa thawhtute tana thlamuanthlak em em, thawh zawh rual ruala official verification slip WhatsApp leh SMS hmanga thawn nghal theihna.' 
                  : 'Automatic verified digital receipts delivered straight to donors via WhatsApp or SMS, eliminating disputes.'}
              </p>
              <div className="pt-2 text-[11px] text-purple-300 font-bold flex items-center gap-1">
                <span>✓ Verified Digital Slips</span>
              </div>
            </div>

            {/* Feature 6: AI Hriatpui Assistant */}
            <div className="bg-slate-900 border border-slate-800 hover:border-sky-500/60 p-6 rounded-3xl space-y-3 transition duration-300 hover:shadow-xl group">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center border border-sky-500/30 group-hover:scale-110 transition">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                6. Gemini AI Powered
              </div>
              <h3 className="text-lg font-black text-white">
                {isMizo ? 'AI Hriatpui Assistant' : 'AI Hriatpui Assistant (Gemini AI)'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Zawhna hrang hrang, bawm category hman dan tur, tithe semzai dan, leh transaction fiah ngai te Mizo tawng ngeia chhang thei Gemini AI thluak.' 
                  : 'Native conversational AI assistant powered by Gemini. Answers regulatory questions, explains donation distributions, and assists with rolls.'}
              </p>
              <div className="pt-2 text-[11px] text-sky-300 font-bold flex items-center gap-1">
                <span>✓ Mizo Voice & Chat Enabled</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* Organizations Section: Who Is It For */}
      <section id="organizations" className="py-16 sm:py-24 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-300 text-xs font-bold px-3 py-1 rounded-full border border-indigo-400/30">
              <Users className="w-3.5 h-3.5" />
              {isMizo ? 'A Hmantu Turte' : 'Solutions by Organization'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {isMizo ? 'Mizoram Khawtlang Mamawh Tinreng Tan' : 'Tailored for Every Mizo Institution'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              {isMizo 
                ? 'Kohhran tualchhung atanga khawtlang thlengin sum lut leh chhuak fel fai taka vawnna.' 
                : 'From village churches to community branches and bereaved families.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Org 1 */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
                🏛️
              </div>
              <h3 className="text-base font-black text-white">Kohhran Tualchhung & Bial</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Pathian Ram, Tualchhung, Ramthim, Biak In sakna, leh Thawhlawm chhungkaw bu fel taka enkawlna.' 
                  : 'Sunday tithes, mission pledges, building funds, and monthly household rolls.'}
              </p>
            </div>

            {/* Org 2 */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                🤝
              </div>
              <h3 className="text-base font-black text-white">YMA, MHIP & KNP</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Ralna, Khawtlang khawlsak, Member thla tin thawh zat, leh chhiatni-thatni fund vawnna.' 
                  : 'Branch condolence drives, member registers, community development funds.'}
              </p>
            </div>

            {/* Org 3 */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                🖤
              </div>
              <h3 className="text-base font-black text-white">Mimal & Chhungkua</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Ralna Bawm pual, damlo tanpuina, inneih lawmpuina, leh sum thawhtu zawng zawng chhinchhiahna.' 
                  : 'Personal bereavement condolence bawms, medical fundraisers, weddings.'}
              </p>
            </div>

            {/* Org 4 */}
            <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-3xl space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                ⚡
              </div>
              <h3 className="text-base font-black text-white">Mizoram BBPS Utility Pay</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isMizo 
                  ? 'Power & Electricity (P&ED) electric bill leh PHED tui bill awlsam taka pek nghal zung zung theihna.' 
                  : 'Electricity & water utility payments with verified digital clearance.'}
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Security & Regulatory Trust Section */}
      <section id="security" className="py-16 sm:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-slate-950 border border-purple-500/30 rounded-3xl p-8 sm:p-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-8 space-y-4">
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-400/30">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  {isMizo ? 'Dan Ang Thlapa Rinngam' : 'Bank-Grade Security & Trust'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {isMizo ? 'I Pawisa Chu I Bank Account-ah Direct-in A Lut Nghal Zel' : 'Zero Middleman Holding. Direct Bank-to-Bank Settlement.'}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                  {isMizo 
                    ? 'RonPay hian sum kan khawl ve ngai lo. Pawisa thawhtu-in QR a scan rualin i kohhran emaw i pawl bank account-ah a lut nghal char char zel a ni. RBI & NPCI UPI guidelines zawm thlap a ni.' 
                    : 'RonPay does not operate an escrow or pool account. Every rupee paid through your dynamic QR code routes directly into your church or organization bank account via NPCI UPI protocol.'}
                </p>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isMizo ? 'NPCI UPI Guidelines' : 'NPCI UPI Compliant'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isMizo ? 'Creator KYC Verified' : 'Creator KYC Checked'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{isMizo ? '256-Bit Cloud Encryption' : '256-Bit SSL Secured'}</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 flex justify-center">
                <div className="bg-slate-900/90 border border-slate-700/80 p-6 rounded-2xl text-center space-y-3 shadow-xl">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-black text-white">100% Direct Settlement</div>
                  <div className="text-xs text-slate-400">
                    {isMizo 
                      ? 'Sum lakkhawm zawng zawng chu i beneficiary account-ah a tlang nghal zel.' 
                      : 'Funds go straight from donor bank to beneficiary account without delay.'}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* Interactive Bawm Simulator Demo */}
      <section className="py-16 sm:py-24 bg-slate-900/30 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-10">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              {isMizo ? 'Live Chhinna' : 'Live Simulator'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {isMizo ? 'RonPay Bawm Thawh Dan Han Chhin Teh' : 'Test How RonPay Bawm Works'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {isMizo ? 'Bawm thlang la, sum zat thlangin a thawh dan en rawh le.' : 'Select a Bawm type and preview the real donor experience.'}
            </p>
          </div>

          <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            
            {/* Category Select tabs */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-2">
                {isMizo ? '1. Bawm Category Thlang Rawh:' : '1. Select Bawm Category:'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'ralna', label: isMizo ? 'Ralna Bawm' : 'Ralna', icon: '🖤' },
                  { key: 'kumtluang', label: isMizo ? 'Kumtluang' : 'Kumtluang', icon: '🏛️' },
                  { key: 'rikrum', label: isMizo ? 'Rikrum' : 'Emergency', icon: '🚨' },
                  { key: 'khawlsak', label: isMizo ? 'Khawlsak' : 'Khawlsak', icon: '🏗️' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSimulatorCategory(item.key as BawmCategory);
                      setShowSimulatedReceipt(false);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                      simulatorCategory === item.key 
                        ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Select buttons */}
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-2">
                {isMizo ? '2. Thawh Zat Tur Thlang Rawh (₹):' : '2. Choose Contribution Amount (₹):'}
              </label>
              <div className="flex items-center gap-2">
                {[100, 200, 500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setSimulatorAmount(amt);
                      setShowSimulatedReceipt(false);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-black transition cursor-pointer border ${
                      simulatorAmount === amt 
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSimulatedReceipt(true);
                  playSoundboxDemo();
                }}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm py-3 rounded-xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <span>{isMizo ? `₹${simulatorAmount} Thawhna Han Chhin Rawh` : `Simulate ₹${simulatorAmount} Contribution`}</span>
                <Sparkles className="w-4 h-4 text-amber-300" />
              </button>
            </div>

            {/* Simulated Receipt Output */}
            {showSimulatedReceipt && (
              <div className="bg-emerald-950/50 border-2 border-emerald-500/50 p-4 rounded-2xl space-y-2.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>{isMizo ? 'Thawhna Hlawhtling (Sample Slip)' : 'Verified Contribution Slip'}</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300">TXN-SIM-9921</span>
                </div>
                <div className="text-xl font-black text-white">₹{simulatorAmount}</div>
                <div className="text-xs text-slate-300">
                  {isMizo ? 'Bawm Hming:' : 'Campaign:'} <strong className="text-white">
                    {simulatorCategory === 'ralna' ? 'Pi Lalhmingliani Ralna' : simulatorCategory === 'kumtluang' ? 'BCM Ebenezer, Zobawk [Kumtluang]' : 'Emergency Relief Fund'}
                  </strong>
                </div>
                <div className="text-[10.5px] text-emerald-300/90 pt-1 border-t border-emerald-800/60">
                  {isMizo ? '✓ WhatsApp receipt donor hnenah thawn a ni a, Mizo voice announcement a ri bawk e.' : '✓ Verified slip delivered to donor phone & audio voice synthesized.'}
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) Section */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              {isMizo ? 'Zawhna Tlanglawn' : 'Got Questions?'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              {isMizo ? 'Zawhna & Chhanna Tlangpui' : 'Frequently Asked Questions'}
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: isMizo 
                  ? '1. RonPay hi engtin nge ka Kohhran / Pawl tan ka hman tan ang?' 
                  : '1. How do I start using RonPay for my church or organization?',
                a: isMizo 
                  ? 'A awlsam lutuk! RonPay Web App-ah hian lut la, "Create QR Bawm" emaw "Register Org" tih hmetin i Kohhran/Pawl hming leh i bank account (UPI ID) i dah lut ang a. Minute 2 chhungin i QR Bawm chu hman theih a ni nghal ang.' 
                  : 'Simply open the RonPay Web App, click "Create QR Bawm" or "Register Org", provide your organization name and bank account UPI ID. Your live QR is generated in under 2 minutes.'
              },
              {
                q: isMizo 
                  ? '2. Sum lutte hi RonPay hian a vawng rih em (Escrow)?' 
                  : '2. Does RonPay hold our money in an escrow account?',
                a: isMizo 
                  ? 'A vawng rih lo. Pawisa thawhtute sum chu NPCI UPI protocol hmangin i Kohhran emaw i Pawl bank account-ah direct-in a lut nghal char char zel a ni.' 
                  : 'No. RonPay never holds your money. Every transaction settles directly into your designated organization bank account instantly.'
              },
              {
                q: isMizo 
                  ? '3. Pawisa fai (Cash) thehluhte hi engtin nge a chhinchhiah theih?' 
                  : '3. How are physical cash contributions recorded?',
                a: isMizo 
                  ? 'Kan Dual-Mode Cash Ledger hmangin, inkhawm thawhlawm emaw ralna-a pawisa fai lut zawng zawng chu Creator/Admin-in a type lut zung zung thei a, "✓ Hmuhpui (Approve)" an hmeh rualin a in-belhkhawm vek thei a ni.' 
                  : 'Our Dual-Mode ledger allows authorized creators to record cash envelopes, and approve them with one click so both cash and online totals match perfectly.'
              },
              {
                q: isMizo 
                  ? '4. Internet a chhiat laiin a hman theih em?' 
                  : '4. Does RonPay work offline in areas with weak signal?',
                a: isMizo 
                  ? 'Aw, thei e! RonPay hi Offline-First Architecture a ni a, internet a awm loh pawhin local phone storage-ah a lo in-save zel a, signal a awm leh rualin cloud-ah a in-sync nghal vek a ni.' 
                  : 'Yes! RonPay is built offline-first. Even without internet, entries are stored securely on the local device and automatically synced once a connection is detected.'
              },
              {
                q: isMizo 
                  ? '5. Committee atan Financial Report a lak chhuah theih em?' 
                  : '5. Can we export financial reports for our committee meetings?',
                a: isMizo 
                  ? 'Aw, theih chiang e! 1-Click Reports hmangin official PDF leh Excel spreadsheet kimchang, Treasurer leh Secretary signature block nen download theih a ni.' 
                  : 'Yes! Generate comprehensive PDF statements and Excel spreadsheets with official headers and signature lines with just one click.'
              }
            ].map((faq, idx) => (
              <div 
                key={idx} 
                className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 text-sm sm:text-base font-black text-white hover:text-amber-300 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${activeFaq === idx ? 'rotate-180 text-amber-400' : 'text-slate-400'}`} />
                </button>
                {activeFaq === idx && (
                  <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/80 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* Biakpawhna & Helpdesk Section */}
      <section id="contact" className="py-16 sm:py-24 bg-gradient-to-br from-purple-950/60 via-slate-950 to-indigo-950/60 border-t border-indigo-900/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 text-xs font-bold px-3.5 py-1 rounded-full border border-purple-400/40 uppercase tracking-wider">
              <Bot className="w-4 h-4 text-emerald-400" />
              {isMizo ? 'Biakpawhna & Puihna' : '24/7 Contact & Support'}
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              {isMizo ? 'Biakpawhna & RonPay Khualchhawn' : 'Get in Touch with RonPay'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
              {isMizo 
                ? 'Zawhna i nei a nih chuan kan AIChat (RonPay Khualchhawn) zawt nghal la, emaw email leh WhatsApp hmangin direct-in kan team-te lo be rawh le.' 
                : 'Have a question? Talk instantly with our 24/7 AI Khualchhawn or reach our official support desk via email and WhatsApp.'}
            </p>
          </div>

          {/* 4 Primary Contact Channel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Channel 1: AIChat (RonPay Khualchhawn) */}
            <div className="bg-gradient-to-b from-purple-900/40 to-slate-900/90 border-2 border-purple-500/50 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between relative overflow-hidden group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600/30 text-purple-300 flex items-center justify-center border border-purple-400/40 group-hover:scale-105 transition">
                    <Bot className="w-6 h-6 text-amber-300" />
                  </div>
                  <span className="bg-purple-500/30 text-purple-200 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-purple-400/40 uppercase animate-pulse">
                    24/7 LIVE
                  </span>
                </div>
                <div>
                  <div className="text-[10.5px] font-black text-purple-300 uppercase tracking-wider">
                    {isMizo ? 'Virtual Receptionist' : 'AI Front Desk'}
                  </div>
                  <h3 className="text-lg font-black text-white mt-0.5">
                    AIChat (RonPay Khualchhawn)
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isMizo 
                    ? 'Bawm chi 7-te hrilhfiahna, PhonePe thawhpui dan, BBPS bill pek dan, leh tithes register dan Mizo tawng ngeiin zawt rawh le.' 
                    : 'Ask anything about Bawms, PhonePe integration, BBPS bills, and account setups in Mizo or English anytime.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsKhualchhawnOpen(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs py-3 rounded-2xl shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isMizo ? 'Khualchhawn Be Rawh' : 'Chat with Khualchhawn'}</span>
              </button>
            </div>

            {/* Channel 2: Official Email */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-indigo-500/60 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30 group-hover:scale-105 transition">
                    <Mail className="w-6 h-6 text-indigo-400" />
                  </div>
                  <span className="bg-indigo-950 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-700/50">
                    Official
                  </span>
                </div>
                <div>
                  <div className="text-[10.5px] font-black text-indigo-400 uppercase tracking-wider">
                    {isMizo ? 'Email Biakpawhna' : 'Direct Support Email'}
                  </div>
                  <h3 className="text-base font-black text-white mt-0.5 break-all">
                    ronpay@gmail.com
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isMizo 
                    ? 'Kohhran in-register, partnership, sum luh dan, leh official enquiry atan darkar 2 chhungin chhanna i dawng ang.' 
                    : 'For church onboardings, institutional queries, and support. Guaranteed response within 2 hours.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <a
                  href="mailto:ronpay@gmail.com?subject=RonPay%20Enquiry%20from%20Website"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isMizo ? 'Email Thawn' : 'Send Email'}</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1 border border-slate-700"
                  title="Copy email address"
                >
                  {copiedEmail ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-[10.5px]">{copiedEmail ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Channel 3: WhatsApp Helpdesk */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30 group-hover:scale-105 transition">
                    <MessageCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="bg-emerald-950 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-700/50">
                    Instant
                  </span>
                </div>
                <div>
                  <div className="text-[10.5px] font-black text-emerald-400 uppercase tracking-wider">
                    {isMizo ? 'WhatsApp Helpdesk' : 'WhatsApp Support'}
                  </div>
                  <h3 className="text-base font-black text-white mt-0.5">
                    +91 9862899001
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isMizo 
                    ? 'Mizo tawng ngeiin kan team-te be rawh. Poster print, Soundbox puihna, leh register dan kan lo pui vek dawn che nia.' 
                    : 'Direct WhatsApp chat with our technical support team in Mizoram for instant troubleshooting and setup assistance.'}
                </p>
              </div>

              <a
                href="https://wa.me/919862899001?text=RonPay%20chungchang%20ka%20hrechiang%20duh%20e"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-2xl transition cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isMizo ? 'WhatsApp-ah Bia Rawh' : 'Chat on WhatsApp'}</span>
              </a>
            </div>

            {/* Channel 4: Headquarters / Location */}
            <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 p-6 rounded-3xl space-y-4 shadow-xl flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-600/20 text-amber-300 flex items-center justify-center border border-amber-500/30 group-hover:scale-105 transition">
                    <Building2 className="w-6 h-6 text-amber-400" />
                  </div>
                  <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                    Mizoram
                  </span>
                </div>
                <div>
                  <div className="text-[10.5px] font-black text-amber-400 uppercase tracking-wider">
                    {isMizo ? 'Headquarters' : 'Corporate Base'}
                  </div>
                  <h3 className="text-base font-black text-white mt-0.5">
                    Aizawl & Lunglei
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isMizo 
                    ? 'RonPay Technologies, Mizoram. PhonePe PG V2 leh NPCI unified network hmanga Mizo mipui tana thawk reng kan ni.' 
                    : 'RonPay Technologies, Mizoram. Operating in partnership with PhonePe and NPCI frameworks.'}
                </p>
              </div>

              <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800 flex items-center justify-between">
                <span>PhonePe Direct Stack</span>
                <span className="text-emerald-400 font-bold">● Active</span>
              </div>
            </div>

          </div>

          {/* Large Final CTA Launch Bar */}
          <div className="bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border border-purple-500/40 rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-2xl sm:text-3xl font-black text-white">
                {isMizo ? 'RonPay Hman Tan I Inpeih Em?' : 'Ready to Get Started with RonPay?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                {isMizo 
                  ? 'App chhungah lut la, Khualmi (Guest) angin engkim han en chhin la, i duh hunah i kohhran leh bawm siam tan ve rawh le.' 
                  : 'Enter the app seamlessly as a guest user to test all features, or create your church bawm in 2 minutes.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onLaunchApp}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xl transition cursor-pointer shrink-0"
            >
              <Smartphone className="w-5 h-5" />
              <span>{isMizo ? 'RonPay App-ah Lut Rawh' : 'Launch RonPay App'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Brand in Footer */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-500 text-white font-black flex items-center justify-center text-xs">
                  R
                </div>
                <span className="text-base font-black text-white">
                  Ron<span className="text-orange-500">Pay</span>
                </span>
                <span className="bg-purple-900/50 text-purple-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-purple-700/50">
                  FinTech
                </span>
                <span className="bg-indigo-900/50 text-indigo-300 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-700/50">
                  PhonePe Partner
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isMizo 
                  ? 'Mizoram Kohhran leh Khawtlang tana Digital Bawm Platform Felfai Ber' 
                  : "Mizoram's premier digital community bawm platform"}
              </p>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
              <a href="#hero" className="hover:text-white transition">{isMizo ? 'Kawtchhuah' : 'Home'}</a>
              <a href="#phonepe" className="hover:text-white transition text-purple-300">PhonePe</a>
              <a href="#services" className="hover:text-white transition">{isMizo ? 'Services' : 'Services'}</a>
              <a href="#bbps" className="hover:text-white transition text-amber-300">BBPS BillPay</a>
              <a href="#features" className="hover:text-white transition">{isMizo ? 'Hmanruate' : 'Features'}</a>
              <a href="#contact" className="hover:text-white transition">{isMizo ? 'Biakpawhna' : 'Contact'}</a>
              <button type="button" onClick={onLaunchApp} className="text-indigo-400 hover:text-indigo-300 font-black cursor-pointer">
                {isMizo ? 'App Lut Rawh →' : 'Launch App →'}
              </button>
            </div>

          </div>

          {/* Copyright line as strictly requested: "Developed & Maintained by © 2026 RonPay Technologies. All rights reserved." */}
          <div className="pt-6 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <div>
              Developed & Maintained by © 2026 RonPay Technologies. All rights reserved. • Email: ronpay@gmail.com
            </div>

            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All Systems Operational
              </span>
              <span>•</span>
              <span className="text-slate-400">PhonePe Direct V2 Stack</span>
            </div>
          </div>

        </div>
      </footer>

      {/* Floating Interactive RonPay Khualchhawn (AI Chat) Widget */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
        {isKhualchhawnOpen ? (
          <div className="w-[92vw] sm:w-[380px] h-[520px] bg-slate-900 border-2 border-purple-500/70 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
            
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-4 border-b border-purple-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-md border border-purple-400/40">
                  <Bot className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-sm font-black text-white flex items-center gap-1.5">
                    <span>RonPay Khualchhawn</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-[10px] text-purple-200">
                    24/7 AI Receptionist & Guide
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsKhualchhawnOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                aria-label="Close Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Prompt Chips */}
            <div className="px-3 py-2 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[10px] font-semibold text-purple-200 no-scrollbar">
              <button
                type="button"
                onClick={() => handleSendKhualchhawn('Bawm 7-te awmzia min hrilhfiah teh')}
                className="bg-purple-950 hover:bg-purple-900 px-2.5 py-1 rounded-full border border-purple-700/60 whitespace-nowrap cursor-pointer transition"
              >
                Bawm 7-te
              </button>
              <button
                type="button"
                onClick={() => handleSendKhualchhawn('PhonePe nen thawhdun dan min hrilh teh')}
                className="bg-purple-950 hover:bg-purple-900 px-2.5 py-1 rounded-full border border-purple-700/60 whitespace-nowrap cursor-pointer transition"
              >
                PhonePe Thawhpuina
              </button>
              <button
                type="button"
                onClick={() => handleSendKhualchhawn('BBPS bill pek dan engtin nge?')}
                className="bg-purple-950 hover:bg-purple-900 px-2.5 py-1 rounded-full border border-purple-700/60 whitespace-nowrap cursor-pointer transition"
              >
                BBPS Bill
              </button>
              <button
                type="button"
                onClick={() => handleSendKhualchhawn('Sum lut hi direct-in bank-ah a lut em?')}
                className="bg-purple-950 hover:bg-purple-900 px-2.5 py-1 rounded-full border border-purple-700/60 whitespace-nowrap cursor-pointer transition"
              >
                Direct Bank
              </button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-900/90 text-xs">
              {khualchhawnMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-bold">
                      R
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] p-3 rounded-2xl leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-purple-600 text-white rounded-br-none'
                        : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-bl-none'
                    }`}
                  >
                    <div>{msg.text}</div>
                    <div
                      className={`text-[9px] mt-1 text-right ${
                        msg.sender === 'user' ? 'text-purple-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </div>
                  </div>
                  {msg.sender === 'user' && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {khualchhawnLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span>Khualchhawn-in a ngaihtuah mek e...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendKhualchhawn();
              }}
              className="p-2.5 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
            >
              <input
                type="text"
                value={khualchhawnInput}
                onChange={(e) => setKhualchhawnInput(e.target.value)}
                placeholder={isMizo ? 'Khualchhawn zawt rawh...' : 'Ask Khualchhawn...'}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                disabled={!khualchhawnInput.trim() || khualchhawnLoading}
                className="w-9 h-9 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white flex items-center justify-center transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsKhualchhawnOpen(true)}
            className="group bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs sm:text-sm px-4 sm:px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 border-2 border-purple-400/50 transition duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <div className="relative">
              <Bot className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5" />
            </div>
            <span>{isMizo ? 'AIChat (RonPay Khualchhawn)' : 'Khualchhawn AI Chat'}</span>
          </button>
        )}
      </div>

    </div>
  );
};
