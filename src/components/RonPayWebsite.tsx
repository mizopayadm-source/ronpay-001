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
  Building2,
  Receipt,
  Zap,
  MessageCircle,
  Volume2,
  Banknote,
  Lock,
  Globe,
  Check,
  Search,
  Mail,
  Copy,
  Phone,
  MapPin,
  ExternalLink,
  Droplets,
  Car,
  GraduationCap,
  Building,
  Send,
  X,
  Bot,
  UserCheck,
  RefreshCw,
  HelpCircle,
  Menu,
  HeartHandshake,
  Share2,
  AlertTriangle,
  CreditCard,
  Tv,
  Flame,
  Shield,
  Sun,
  Moon,
  BookOpen,
  ArrowUp,
  Info
} from 'lucide-react';
import { BawmCategory, BillService } from '../types';
import { askAIHriatpui } from '../services/aiHriatpuiService';
import { PGComplianceModal } from './PGComplianceModal';
import { isAndroidOrMobileApp } from '../utils/urlRouting';

interface RonPayWebsiteProps {
  onLaunchApp: (targetScreen?: string, targetCategory?: BawmCategory) => void;
  onOpenCreateQR?: () => void;
  onOpenRegister?: () => void;
  onOpenBBPS?: (serviceId?: string) => void;
  onOpenPhonePeCheckout?: (amount?: number) => void;
  onOpenPhonePePortal?: () => void;
  initialLanguage?: 'mizo' | 'english';
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

export const RonPayWebsite: React.FC<RonPayWebsiteProps> = ({
  onLaunchApp,
  onOpenCreateQR,
  onOpenRegister,
  onOpenBBPS,
  onOpenPhonePeCheckout,
  onOpenPhonePePortal,
  initialLanguage = 'mizo',
}) => {
  const [lang, setLang] = useState<'mizo' | 'english'>(initialLanguage);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [soundboxPlaying, setSoundboxPlaying] = useState<boolean>(false);
  const [simulatorCategory, setSimulatorCategory] = useState<BawmCategory>('ralna');
  const [simulatorAmount, setSimulatorAmount] = useState<number>(500);
  const [phonePeUatAmount, setPhonePeUatAmount] = useState<number>(100);
  const [copiedPhonePeLink, setCopiedPhonePeLink] = useState<boolean>(false);
  const [showSimulatedReceipt, setShowSimulatedReceipt] = useState<boolean>(false);

  // Direct PhonePe Official PG UAT Portal Launch Helper (mercury-uat.phonepe.com)
  const openPhonePeUatPortal = (amount: number = 100) => {
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://ronpay.app';
    const launchUrl = `/api/phonepe/launch-pay?amt=${amount}&origin=${encodeURIComponent(origin)}`;
    if (isAndroidOrMobileApp()) {
      window.location.href = launchUrl;
      return;
    }
    try {
      const paymentWindow = window.open(launchUrl, '_blank');
      if (!paymentWindow || paymentWindow.closed || typeof paymentWindow.closed === 'undefined') {
        window.location.href = launchUrl;
      }
    } catch (e) {
      window.location.href = launchUrl;
    }
  };

  const copyPhonePeUatLink = (amount: number = 100) => {
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://ronpay.app';
    const link = `${origin}/api/phonepe/launch-pay?amt=${amount}`;
    navigator.clipboard.writeText(link);
    setCopiedPhonePeLink(true);
    setTimeout(() => setCopiedPhonePeLink(false), 2000);
  };
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  // Eye Comfort Theme (Mit Tihahdam Theme) - true = soothing warm light, false = muted dark
  const [eyeComfortMode, setEyeComfortMode] = useState<boolean>(true);

  // User Manual Modal & Tab States for RonPay 4+1 Services
  const [manualModalOpen, setManualModalOpen] = useState<boolean>(false);
  const [manualActiveKey, setManualActiveKey] = useState<'ralna' | 'kumtluang' | 'khawlsak' | 'rikrum' | 'mimal'>('ralna');
  const [quickManualExpanded, setQuickManualExpanded] = useState<boolean>(false);
  
  // Interactive BBPS showcase state
  const [selectedBbpsKey, setSelectedBbpsKey] = useState<string>('ebill');
  const [bbpsInputVal, setBbpsInputVal] = useState<string>('102938475');
  const [bbpsSimResult, setBbpsSimResult] = useState<{ consumerName: string; amount: number; dueDate: string } | null>({
    consumerName: 'Lalramchhana (Bungkawn Veng)',
    amount: 1420,
    dueDate: '15th of this month'
  });

  // Contact section: Email copy feedback & App Link copy feedback
  const [emailCopied, setEmailCopied] = useState<boolean>(false);
  const [appLinkCopied, setAppLinkCopied] = useState<boolean>(false);

  // PG & Merchant Compliance Modal State
  const [complianceModalOpen, setComplianceModalOpen] = useState<boolean>(false);
  const [complianceInitialTab, setComplianceInitialTab] = useState<'architecture' | 'terms' | 'privacy' | 'refund' | 'grievance' | 'sandbox'>('architecture');

  // AIChat (RonPay Khual chhawn) State
  const [isAIChatOpen, setIsAIChatOpen] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'ai',
      text: initialLanguage === 'mizo'
        ? 'Chibai le! Kei hi RonPay Khual Chhawn (AI Assistant) ka ni e. India rama payment company lian ber PhonePe nen kan thawhdun dan te, Bawm hrang hrang 5-te, BBPS EBill, Water bill, Fastag, School fees, Municipal taxes, Mobile topup, emaw www.ronpay.app/app hman dan engpawh min zawt thei e!'
        : 'Welcome! I am RonPay Khual Chhawn, your AI Greeter. Ask me about our official partnership with PhonePe, our 5 Community Bawms, BBPS Utility Bills, Mobile Topup, or how to launch www.ronpay.app/app as Guest User (Khualmi)!',
      time: 'Just now'
    }
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to Top state & handler
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      if (typeof window !== 'undefined') {
        setShowScrollTop(window.scrollY > 250);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    if (isAIChatOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAIChatOpen]);

  // Voice synthesis demo
  const playSoundboxDemo = (customText?: string) => {
    try {
      setSoundboxPlaying(true);
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
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

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(
          customText || (lang === 'mizo' 
            ? `RonPay-ah cheng zanga dawn a ni e` 
            : `Received Rupees five hundred on RonPay`)
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

  // AIChat Message Sender
  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = (presetText || chatInput).trim();
    if (!textToSend || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetText) setChatInput('');
    setIsChatLoading(true);

    try {
      const response = await askAIHriatpui(textToSend, 'Khualmi (Guest User)');
      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.answer || (lang === 'mizo' ? 'Ka hrethiam e! RonPay ah hian engkim a awlsam a ni.' : 'Got it! RonPay makes everything smooth and instant.'),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      const fallbackReply: ChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: 'ai',
        text: lang === 'mizo'
          ? 'RonPay Khual Chhawn: RonPay hi PhonePe partner a ni a, Ralna, Kumtluang, Khawlsak, Rikrum, leh BBPS utilities (EBill, Tui Bill, Fastag, School Fees, Municipal Taxes, Mobile Topup) tan a hman theih vek e. www.ronpay.app/app ah hian Guest User angin a lut nghal theih e!'
          : 'RonPay Khual Chhawn: RonPay partners with PhonePe to provide 5 Community Bawms and complete BBPS utilities (EBill, Water, Fastag, Fees, Municipal Taxes, Mobile Topup). Access www.ronpay.app/app as Guest User anytime!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, fallbackReply]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'email' | 'applink') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'email') {
        setEmailCopied(true);
        setTimeout(() => setEmailCopied(false), 2500);
      } else {
        setAppLinkCopied(true);
        setTimeout(() => setAppLinkCopied(false), 2500);
      }
    }
  };

  const isMizo = lang === 'mizo';

  // BBPS Services Master Definition with prominent EBill, Water, Fastag, School Fees, Municipal Taxes, and Mobile Topup
  const BBPS_UTILITIES = [
    {
      id: 'ebill',
      name: isMizo ? 'EBill (Electric Bill)' : 'EBill (Electricity)',
      provider: 'Power & Electricity Dept, Mizoram (P&ED)',
      icon: Zap,
      color: 'amber',
      accentBg: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
      tag: 'P&ED Mizoram',
      description: isMizo 
        ? 'Consumer No chhut luhin i Electric bill zat leh due date a lo lang nghal a, PhonePe / UPI hmangin second 5 chhungin a pek theih.' 
        : 'Enter 9-digit Consumer ID to fetch official P&ED power bill and clear instantly with UPI.',
      placeholder: 'Consumer Number (e.g. 102938475)',
      sampleDue: '₹1,420',
      sampleConsumer: 'Lalramchhana (Bungkawn Veng)'
    },
    {
      id: 'water',
      name: isMizo ? 'Water Bill (Tui Bill)' : 'Water Bill (PHED)',
      provider: 'Public Health Engineering Dept (PHED Mizoram)',
      icon: Droplets,
      color: 'sky',
      accentBg: 'bg-sky-500/20 border-sky-500/30 text-sky-300',
      tag: 'PHED Mizoram',
      description: isMizo 
        ? 'PHED Mizoram Tui connection bill rang taka check leh pek nghal theihna. Payment receipt PDF download theih nghal.' 
        : 'Instant PHED water supply bill fetching with verified digital clearance receipt.',
      placeholder: 'Consumer ID / RR No (e.g. AZL-98421)',
      sampleDue: '₹480',
      sampleConsumer: 'Zothanpuii (Mission Veng)'
    },
    {
      id: 'fastag',
      name: isMizo ? 'FASTag Recharge' : 'FASTag Toll Recharge',
      provider: 'National Electronic Toll Collection (NETC / NHAI)',
      icon: Car,
      color: 'indigo',
      accentBg: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
      tag: 'Highway Tolls',
      description: isMizo 
        ? 'Motor registration number (e.g. MZ-01-AA-1234) hmangin SBI, ICICI, Airtel, Bank of Baroda FASTag awlsam taka recharge nghal theihna.' 
        : 'Instant FASTag topup for all bank issuers across Indian highway toll plazas.',
      placeholder: 'Vehicle Reg No (e.g. MZ-01-X-4321)',
      sampleDue: '₹1,000',
      sampleConsumer: 'H. Lalmalsawma (Scorpio-N)'
    },
    {
      id: 'school_fees',
      name: isMizo ? 'School & College Fees' : 'School & College Fees',
      provider: 'Mizoram University, PUC, Colleges & Schools',
      icon: GraduationCap,
      color: 'emerald',
      accentBg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
      tag: 'Education BBPS',
      description: isMizo 
        ? 'MZU, Pachhunga University College, Govt Colleges, leh Mizoram school hrang hrang admission, tuition & hostel fees awlsam taka pekna.' 
        : 'Pay tuition, examination, and semester fees for Mizoram universities and schools with official roll verification.',
      placeholder: 'Student Roll No / Enrollment ID',
      sampleDue: '₹3,500',
      sampleConsumer: 'Lalrinzuala (PUC Semester 4)'
    },
    {
      id: 'municipal_taxes',
      name: isMizo ? 'Municipal Taxes (AMC)' : 'Municipal Taxes (AMC)',
      provider: 'Aizawl Municipal Corporation (AMC)',
      icon: Building,
      color: 'purple',
      accentBg: 'bg-purple-500/20 border-purple-500/30 text-purple-300',
      tag: 'AMC Mizoram',
      description: isMizo 
        ? 'AMC Property Tax, Trade License renewal, leh Municipal Ward fees official clearance receipt nen a ruka pek theihna.' 
        : 'Aizawl Municipal Corporation Property Tax, Trade License fees, and urban dues with verified clearance seal.',
      placeholder: 'Holding No / Trade License No (e.g. AMC-PR-8831)',
      sampleDue: '₹850',
      sampleConsumer: 'K. Lalchhandama (Dawrpui Commercial)'
    },
    {
      id: 'mobile_topup',
      name: isMizo ? 'Mobile Topup & Data Recharge' : 'Mobile Recharge & Topup',
      provider: 'Jio, Airtel, Vodafone Idea (Vi), BSNL',
      icon: Smartphone,
      color: 'rose',
      accentBg: 'bg-rose-500/20 border-rose-500/30 text-rose-300',
      tag: 'All Operators',
      description: isMizo 
        ? 'Jio, Airtel, Vi, leh BSNL prepaid recharge leh postpaid bill payment. Unlimited 5G plan leh validity packs a thlan theih nghal.' 
        : 'Instant prepaid recharges and postpaid bill clearance for Jio, Airtel, Vi, and BSNL with real-time plan browser.',
      placeholder: '10-Digit Mobile Number (e.g. 9862899001)',
      sampleDue: '₹299',
      sampleConsumer: 'Jio 5G 28 Days Unlimited'
    },
    {
      id: 'dth_gas',
      name: isMizo ? 'DTH & LPG Cylinder' : 'DTH & LPG Cylinder',
      provider: 'Tata Play, Airtel DTH, Indane / Bharat Gas',
      icon: Tv,
      color: 'teal',
      accentBg: 'bg-teal-500/20 border-teal-500/30 text-teal-300',
      tag: 'Home Utilities',
      description: isMizo 
        ? 'Tata Play, Airtel DTH, Dish TV recharge leh Indane/Bharat Gas cylinder booking rualin bill pek nghal theihna.' 
        : 'DTH subscription renewal and LPG cylinder booking payment with instant SMS confirmation.',
      placeholder: 'Subscriber ID / LPG Consumer ID',
      sampleDue: '₹950',
      sampleConsumer: 'Indane Gas Delivery Lunglei'
    }
  ];

  const currentBbps = BBPS_UTILITIES.find(b => b.id === selectedBbpsKey) || BBPS_UTILITIES[0];

  // User Manual / Hman Dan Kaihhruaina for RonPay 4+1 Core Services
  const SERVICE_MANUALS = {
    ralna: {
      id: 'ralna',
      name: isMizo ? 'Ralna Bawm' : 'Ralna Bawm (Condolence & Bereavement)',
      icon: '🖤',
      badge: isMizo ? 'Chhiatni & YMA Pual' : 'Condolence & YMA',
      color: 'red',
      summary: isMizo 
        ? 'Mitthi ralna sum felfai, rintlak, leh zahawm taka vawnna a ni a. YMA Khawhar In committee leh chhungkua-te tan buaipui a awlsam em em a ni.' 
        : 'Transparent, respectful bereavement condolence management for families and YMA relief committees.',
      steps: [
        {
          step: 1,
          title: isMizo ? 'QR Poster & Bawm Siam (Minute 1-ah Live)' : 'Generate Obituary QR Poster (Live in 1 Min)',
          desc: isMizo 
            ? 'RonPay App-ah lut la, "QR Bawm Thar Siam" thlang rawh. Mitthi hming, kum zat, thlalak, chanchin tawi, leh vui hun/hmun dah lut la. Khawhar In bank account (UPI ID / Account Number) link nghal a ni ang.' 
            : 'Open RonPay App, select "Create Live QR Bawm". Enter deceased person’s name, photo, brief bio, and funeral timing. Link the family or YMA bank account/UPI.'
        },
        {
          step: 2,
          title: isMizo ? 'Khawhar In-ah Print Tar & WhatsApp-ah Share' : 'Print Poster & Share on Social/WhatsApp',
          desc: isMizo 
            ? 'A4 mawi takin poster a in-generate a, Khawhar In luhna, dawhkan, emaw YMA Information Board-ah print chhuah a tar nghal theih. Khualkhua leh ram pawn a mite tan WhatsApp link & QR a thawn nghal theih bawk.' 
            : 'Instantly download printable A4 obituary posters with integrated QR. Share via WhatsApp for distant relatives and community members.'
        },
        {
          step: 3,
          title: isMizo ? 'Thawhtuten Second 5-ah Scan & Pe' : 'Supporters Scan & Pay in 5 Seconds',
          desc: isMizo 
            ? 'Thawhtuten an phone-a PhonePe, GPay, Paytm, emaw banking app engpawh hmangin QR an scan mai ang. Sum pek zat leh ralna chibai bukna thuchah (wishing note) an ziak lut thei.' 
            : 'Supporters scan with PhonePe, Google Pay, Paytm, or any BHIM UPI app. They can leave condolence notes alongside their donation.'
        },
        {
          step: 4,
          title: isMizo ? 'WhatsApp Digital Receipt & Soundbox Mizo Aw' : 'Instant WhatsApp Receipt & Mizo Voice Alert',
          desc: isMizo 
            ? 'Sum thawhtu phone-ah official digital receipt WhatsApp hmangin a thleng nghal zel a. Khawhar In table-ah Mizo aw ngeiin "Lalhmangaiha hnen atangin cheng 500 ralna sum a lo lut e" tiin a puang bawk ang.' 
            : 'Donors immediately receive verified digital WhatsApp receipts, and the Khawhar In table soundbox speaks out receipts in native Mizo voice.'
        },
        {
          step: 5,
          title: isMizo ? 'Chhiatni Zawhah 1-Click Committee Audit Report' : '1-Click Committee Audit & Financial Report',
          desc: isMizo 
            ? 'YMA Treasurer leh Secretary-ten buaina awm miah lovin sum thawhtu zawng zawng hming, veng, phone number, leh pek zat PDF leh Excel-in 1-click-in an download thei nghal vek a ni.' 
            : 'Download complete donor records with names, localities, amounts, and timestamps into PDF and Excel for hassle-free committee auditing.'
        }
      ]
    },
    kumtluang: {
      id: 'kumtluang',
      name: isMizo ? 'Kumtluang Bawm' : 'Kumtluang Bawm (Church & Organization)',
      icon: '🏛️',
      badge: isMizo ? 'Kohhran & Pawl Thla Tin' : 'Church & Monthly Registry',
      color: 'blue',
      summary: isMizo 
        ? 'Kohhran thawhlawm (Pathian Ram, Tualchhung, Ramthim, Building) leh thla tin chhungkaw bu fel taka vawnna a ni.' 
        : 'Complete recurring church tithes, monthly household registers, and mission fund administration.',
      steps: [
        {
          step: 1,
          title: isMizo ? 'Kohhran / Pawl Register & Member Roll Siam' : 'Register Church & Import Member Roll',
          desc: isMizo 
            ? 'Kohhran hming, Kohhran Treasurer bank account, leh Department hrang hrang (KTP, Kohhran Hmeichhia, Pavalai, etc.) thlang la. Chhungkaw bu (Household numbers 001, 002...) a in-set nghal ang.' 
            : 'Register your church/branch, link church bank accounts, and configure departmental funds with designated household roll numbers.'
        },
        {
          step: 2,
          title: isMizo ? 'Bawm Hrang Hrang QR Code Tar' : 'Deploy Multi-Head Dynamic QR Codes',
          desc: isMizo 
            ? 'Biak In chhung, pulpit bul, leh dawhkanah Pathian Ram, Tualchhung, leh Ramthim thawhlawm QR dah niin, member-ten awlsam takin an pe thei.' 
            : 'Mount custom QR placards at the church entrance or altar table for Sunday offerings and departmental thanksgiving envelopes.'
        },
        {
          step: 3,
          title: isMizo ? '4-Digit Quick Entry (Treasurer Tan)' : '4-Digit Fast Entry for Sunday Treasurers',
          desc: isMizo 
            ? 'Sunday thawhlawm chhiar hunah envelope leh pawisa fai a lo luhin, Treasurer-in chhungkaw number (e.g. 042) chhut luh zung zungin sum zat a record theih a, darkar 2 hna kha minute 5-ah a zo hman.' 
            : 'Treasurers use the blazing fast 4-digit keycode system to rapidly log cash envelope offerings alongside online UPI transfers.'
        },
        {
          step: 4,
          title: isMizo ? 'WhatsApp Chhungkaw Thla Tin Statement' : 'Automated Monthly Household Statement via WhatsApp',
          desc: isMizo 
            ? 'Chhungkua-ten an thla tin thawh zat leh thawhlawm hrang hrang kalphung fel fai takin an WhatsApp-ah an dawng zel a, rinhlelhna leh tihsual a awm thei lo.' 
            : 'Households automatically receive transparent monthly contribution statements directly on WhatsApp.'
        },
        {
          step: 5,
          title: isMizo ? 'Kumpuan / Synod / Committee Report Print' : '1-Click Committee Audit & Synod Financial Report',
          desc: isMizo 
            ? 'Kum tawp leh thla tawpa Committee-a pharh tur Audit Report, Balance Sheet, leh Thawhlawm bu PDF & Excel-in fel thlapin a chhuak nghal vek.' 
            : 'Export comprehensive audit reports, balance sheets, and head-wise breakdowns in PDF and Excel for committee tabling.'
        }
      ]
    },
    khawlsak: {
      id: 'khawlsak',
      name: isMizo ? 'Khawlsak Bawm' : 'Khawlsak Bawm (Building & Projects)',
      icon: '🏗️',
      badge: isMizo ? 'Building & Project Pual' : 'Capital Projects',
      color: 'emerald',
      summary: isMizo 
        ? 'Biak In sak, YMA Hall sak, Community Hall, leh Project lian tham puala sum thawhkhawm vawnna fiah fai tak a ni.' 
        : 'Transparent fundraising for church buildings, community halls, and major infrastructure projects.',
      steps: [
        {
          step: 1,
          title: isMizo ? 'Project Goal & Target Amount Siam' : 'Set Project Target & Financial Goals',
          desc: isMizo 
            ? 'Biak In sak nan cheng Nuai 50 (₹50,00,000) mamawh a nih chuan, target zat, project hming, leh hmalak dan thlalak dah lut la.' 
            : 'Define project scope, photo blueprints, target sum (e.g. ₹50 Lakhs), and committee bank account.'
        },
        {
          step: 2,
          title: isMizo ? 'Live Progress Tracker & Target Progress Bar' : 'Live Real-Time Public Progress Bar',
          desc: isMizo 
            ? 'Sum rawn lut zawng zawng chu real-time-in a in-update zel a, 45% thawh a nih chuan progress bar-ah a lang nghal a, thawhtuten an phur phah em em a ni.' 
            : 'Donations instantly increment the public progress bar, showing transparent progress percentage to all supporters.'
        },
        {
          step: 3,
          title: isMizo ? 'Donor Transparency Board & Hming Tarlanna' : 'Donor Transparency Board & Leaderboard',
          desc: isMizo 
            ? 'Thawhtute hming, veng, leh pek zat (duh tan anonymous/a ruka pek theih) fiah fai takin screen-ah leh hall-ah tarlan theih a ni.' 
            : 'Showcase donor appreciation boards with customizable anonymity options for private benefactors.'
        },
        {
          step: 4,
          title: isMizo ? 'Building Fund Official Receipt' : 'Official Building Fund Verified Receipt',
          desc: isMizo 
            ? 'Thawhtu tin tan Building Committee Seal leh Signature chuanna Tax/Deduction eligible official receipt a in-generate nghal zel.' 
            : 'Generates branded project receipts with committee registration details, building seal, and transaction IDs.'
        }
      ]
    },
    rikrum: {
      id: 'rikrum',
      name: isMizo ? 'Rikrum Bawm' : 'Rikrum Bawm (Disaster & Emergency)',
      icon: '🚨',
      badge: isMizo ? 'Emergency • Zero Fee' : 'Disaster Relief • 100% Free',
      color: 'rose',
      summary: isMizo 
        ? 'Kangmei, tuilian, lei tlahmual, leh damlo zual thut tanpuina emergency bawm a ni a. Setup fee leh platform charge a awm lo (100% Free).' 
        : 'Zero-fee rapid disaster relief for fires, landslides, and critical medical emergencies.',
      steps: [
        {
          step: 1,
          title: isMizo ? 'Minute 1 Chhungin Emergency QR Siam' : 'Instant 1-Minute Emergency Activation',
          desc: isMizo 
            ? 'Buaina leh vanduaina a thlen rualin RonPay App-ah Rikrum Bawm thlang la, hming leh hospital/beneficiary account number dah lut rawh. Minute 1 chhungin live nghal vek a ni.' 
            : 'Launch instant relief campaign with patient/victim details and hospital/bank account details in under 60 seconds.'
        },
        {
          step: 2,
          title: isMizo ? 'Zero Platform Setup Charge (A Thlawn / Free)' : 'Zero Platform Fee (100% Free Service)',
          desc: isMizo 
            ? 'Tanpuina sum a nih avangin RonPay chuan hetiang emergency-ah hian service fee engmah a la ve lo (0% platform charge).' 
            : 'RonPay waives all platform setup charges to ensure 100% of compassion funds reach the victims.'
        },
        {
          step: 3,
          title: isMizo ? 'Direct Bank & Hospital Routing' : 'Immediate Direct Bank & Hospital Account Routing',
          desc: isMizo 
            ? 'Sum rawn thawh zawng zawng chu intermediate wallet-a vawn khawm lovin damlo/vanduai tuartu bank account-ah direct-in a lut nghal zel.' 
            : 'Funds credit directly into the beneficiary’s verified bank account without intermediate holding delays.'
        },
        {
          step: 4,
          title: isMizo ? 'Live WhatsApp Broadcast & Solidarity Message' : 'Live WhatsApp Broadcast & Encouragement Notes',
          desc: isMizo 
            ? 'Mizo mipuite tanpuina leh ṭawngṭaipuina thuchah damlo leh chhungkua-ten an hmu thei a, sum zat in-update zung zungin hmalak a awlsam.' 
            : 'Real-time message wall showing heartfelt prayers and financial support from the Mizo community worldwide.'
        }
      ]
    },
    mimal: {
      id: 'mimal',
      name: isMizo ? 'Mimal & Chhungkua Bawm' : 'Mimal & Chhungkua (Personal & Events)',
      icon: '🎁',
      badge: isMizo ? 'Inneih & Piancham' : 'Weddings & Birthdays',
      color: 'purple',
      summary: isMizo 
        ? 'Inneih lawmpuina (Wedding gift envelope), anniversary, piancham thilpek, leh damlo kan sum pekna awlsam tak a ni.' 
        : 'Digital monetary gifts and blessings for weddings, birthdays, anniversaries, and personal visitations.',
      steps: [
        {
          step: 1,
          title: isMizo ? 'Personal Event QR Siam' : 'Create Branded Wedding / Birthday QR',
          desc: isMizo 
            ? 'Mo leh Mopa hming, thlalak, leh lawmpuina thuchah dah lutin wedding QR mawi tak minute 2-ah i nei thei.' 
            : 'Set up custom couple photo, wedding invitation details, and personal bank UPI.'
        },
        {
          step: 2,
          title: isMizo ? 'Invitation Card-ah Print & WhatsApp-ah Thawn' : 'Print on Invitation Cards & Send digitally',
          desc: isMizo 
            ? 'Inneih sawmna lehkha (Invitation Card)-ah QR code dah tel theih a ni a, ram dang leh hmun hla a mite tan WhatsApp-ah a share theih bawk.' 
            : 'Embed sleek QR code directly onto wedding invitation cards or send digitally to friends overseas.'
        },
        {
          step: 3,
          title: isMizo ? 'Digital Envelope & Lawmpuina Thuchah' : 'Digital Shagun Envelope with Custom Greeting',
          desc: isMizo 
            ? 'Sum pek rualin lawmpuina thuchah mawi tak ziak theih a ni a, bank account-ah pawisa a thleng nghal bawk.' 
            : 'Guests attach personal heartfelt blessing notes inside their digital monetary gift.'
        }
      ]
    }
  };

  const activeManual = SERVICE_MANUALS[manualActiveKey] || SERVICE_MANUALS.ralna;

  return (
    <div className={`min-h-screen ${eyeComfortMode ? 'bg-[#f8fafc] text-slate-850' : 'bg-slate-950 text-slate-100'} font-sans selection:bg-orange-500 selection:text-white relative overflow-x-hidden transition-colors duration-150`}>
      
      {/* 1. TOP ANNOUNCEMENT RIBBON: PhonePe Partnership & App URL */}
      <aside aria-label="Partner Announcement" className={`w-full ${eyeComfortMode ? 'bg-indigo-50 border-b border-indigo-100/90 text-indigo-950' : 'bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-950 border-b border-indigo-900/40 text-indigo-200'} px-2 sm:px-3 py-1 sm:py-1.5 text-center text-[10px] sm:text-[11px] font-semibold transition-colors`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2 px-1 sm:px-2">
          {/* PhonePe Partnership Badge */}
          <div className="flex items-center gap-1 sm:gap-1.5 text-left shrink-0">
            <span className={`inline-flex items-center gap-1 ${eyeComfortMode ? 'bg-white text-indigo-900 border-indigo-200 shadow-xs' : 'bg-purple-500/20 text-purple-300 border-purple-400/40'} px-2 py-0.5 rounded-full border text-[9px] sm:text-[9.5px] font-black uppercase tracking-wider`}>
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="hidden xs:inline">Official </span>PhonePe Partner
            </span>
            <span className={`${eyeComfortMode ? 'text-slate-650 font-medium' : 'text-slate-300'} text-[10px] sm:text-[11px] hidden md:inline`}>
              {isMizo 
                ? 'India rama Digital Payment Company lian ber PhonePe nen thawhdun a ni' 
                : "In official partnership with India's leading digital payment giant PhonePe"}
            </span>
          </div>

          {/* Official App Link Pill & Guest User notice */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs shrink-0">
            <span className={`hidden lg:inline ${eyeComfortMode ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              {isMizo ? 'Default in Khualmi (Guest User) ah a lut nghal ang' : 'Defaults to Guest User (Khualmi)'}
            </span>
            <span className="text-slate-400 hidden lg:inline">•</span>
            <div className={`inline-flex items-center gap-1 sm:gap-1.5 ${eyeComfortMode ? 'bg-white border-slate-250 text-slate-800 shadow-xs' : 'bg-slate-900/90 border-slate-700/80 text-amber-300 shadow-xs'} border px-2 sm:px-2.5 py-0.5 rounded-lg text-[9.5px] sm:text-[10px] font-mono font-bold`}>
              <span className={eyeComfortMode ? 'text-slate-600' : 'text-slate-300'}>App Link:</span>
              <button
                type="button"
                onClick={() => onLaunchApp('home')}
                className={`${eyeComfortMode ? 'text-indigo-700 hover:text-indigo-900' : 'text-white hover:text-amber-200'} underline decoration-amber-500/60 transition cursor-pointer font-bold`}
                title="Open www.ronpay.app/app"
              >
                www.ronpay.app/app
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard('https://www.ronpay.app/app', 'applink')}
                className={`p-0.5 ${eyeComfortMode ? 'hover:text-slate-900 text-slate-400' : 'hover:text-white text-slate-400'} transition cursor-pointer`}
                title="Copy App Link"
              >
                {appLinkCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. MAIN STICKY NAVIGATION HEADER */}
      <header className={`sticky top-0 z-50 w-full ${eyeComfortMode ? 'bg-white/95 border-b border-slate-200/90 text-slate-800 shadow-xs' : 'bg-slate-950/95 border-b border-slate-800/80 text-white'} backdrop-blur-md transition-all`}>
        <div className="w-full max-w-[1440px] mx-auto px-2 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-2.5 lg:gap-3">
          
          {/* Brand Logo with FinTech Tag */}
          <div 
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer shrink-0" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl p-[1px] bg-gradient-to-b from-[#1e3a6b] to-[#0d1d38] shadow-md flex items-center justify-center shrink-0 border border-[#2b5191]/50 overflow-hidden">
              <img 
                src="/ronpay-logo.png" 
                alt="RonPay Logo" 
                className="w-full h-full object-cover rounded-[10px]" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="shrink-0">
              <div className="flex items-center gap-1 leading-none">
                <span className={`font-black text-base sm:text-xl tracking-tight ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                  Ron<span className="text-orange-500">Pay</span>
                </span>
                <span className={`hidden sm:inline-block ${eyeComfortMode ? 'bg-purple-100 text-purple-900 border-purple-200' : 'bg-purple-600/30 text-purple-300 border-purple-400/40'} text-[8px] font-black px-1.5 py-0.5 rounded-full border uppercase tracking-wider`}>
                  PhonePe TSP
                </span>
              </div>
              <p className={`hidden md:block text-[9.5px] ${eyeComfortMode ? 'text-slate-500 font-medium' : 'text-slate-400 font-semibold'} tracking-tight`}>
                Mizo FinTech & BBPS Platform
              </p>
            </div>
          </div>

          {/* Center Navigation Links - Inline Row on Laptop / Desktop Monitor (lg+) */}
          <nav className={`hidden lg:flex items-center ${eyeComfortMode ? 'bg-slate-100/90 border-slate-200 text-slate-700' : 'bg-slate-900/90 border-slate-800/80 text-slate-300'} border rounded-full p-0.5 xl:p-1 text-[11px] xl:text-xs font-semibold shadow-xs transition-colors shrink-0`}>
            <a href="#hero" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'hover:text-slate-950 hover:bg-white' : 'hover:text-white hover:bg-slate-800/60'} transition whitespace-nowrap`}>
              {isMizo ? 'Kawtchhuah' : 'Home'}
            </a>
            <a href="#phonepe" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'text-purple-700 hover:text-purple-900 hover:bg-white' : 'text-purple-300 hover:text-purple-200 hover:bg-purple-950/50'} transition flex items-center gap-1 whitespace-nowrap`}>
              <Zap className="w-3 h-3 text-purple-500 shrink-0" />
              <span>PhonePe</span>
            </a>
            <a href="#services" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'hover:text-slate-950 hover:bg-white' : 'hover:text-white hover:bg-slate-800/60'} transition whitespace-nowrap`}>
              {isMizo ? 'Bawm 5' : '5 Bawms'}
            </a>
            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'text-indigo-700 hover:text-indigo-900 hover:bg-white' : 'text-indigo-300 hover:text-indigo-100 hover:bg-slate-800/60'} transition flex items-center gap-1 cursor-pointer whitespace-nowrap`}
            >
              <BookOpen className="w-3 h-3 text-indigo-500 shrink-0" />
              <span>{isMizo ? 'User Manual' : 'Manual'}</span>
            </button>
            <a href="#bbps" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'hover:text-slate-950 hover:bg-white text-slate-700' : 'hover:text-white hover:bg-slate-800/60 text-slate-300'} transition flex items-center gap-1 whitespace-nowrap`}>
              <CreditCard className="w-3 h-3 text-amber-500 shrink-0" />
              <span>BBPS</span>
            </a>
            <a href="#security" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'hover:text-slate-950 hover:bg-white' : 'hover:text-white hover:bg-slate-800/60'} transition whitespace-nowrap`}>
              {isMizo ? 'Rinngamna' : 'Security'}
            </a>
            <a href="#faq" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'hover:text-slate-950 hover:bg-white' : 'hover:text-white hover:bg-slate-800/60'} transition whitespace-nowrap`}>
              FAQ
            </a>
            <a href="#contact" className={`px-2 xl:px-3 py-1.5 rounded-full ${eyeComfortMode ? 'text-emerald-700 hover:text-emerald-900 hover:bg-white' : 'text-emerald-400 hover:text-white hover:bg-slate-800/60'} transition flex items-center gap-1 whitespace-nowrap`}>
              <MessageCircle className="w-3 h-3 shrink-0" />
              <span>{isMizo ? 'Biakpawhna' : 'Contact'}</span>
            </a>
          </nav>

          {/* Right Action Buttons - Cleanly Spaced, Zero Overflow on Mobile */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
            {/* Eye-Comfort Theme Toggle Button (Mit Tihahdam Theme) - Shown on SM+ screens to keep mobile clean */}
            <button
              type="button"
              onClick={() => setEyeComfortMode(!eyeComfortMode)}
              className={`hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0 items-center justify-center ${
                eyeComfortMode 
                  ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 shadow-xs' 
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title={eyeComfortMode ? 'Mit Tihahdam Theme (Active) - Switch to Dark' : 'Switch to Mit Tihahdam Theme'}
              aria-label="Toggle eye comfort theme"
            >
              {eyeComfortMode ? (
                <Sun className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-slate-300 shrink-0" />
              )}
            </button>

            {/* Language Switcher Pill - Shown on SM+ screens */}
            <div className={`hidden sm:flex items-center ${eyeComfortMode ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'} border rounded-lg p-0.5 text-[9.5px] sm:text-xs font-bold shrink-0`}>
              <button
                type="button"
                onClick={() => setLang('mizo')}
                className={`px-1.5 sm:px-2 py-0.5 rounded-md transition cursor-pointer ${
                  lang === 'mizo' 
                    ? 'bg-amber-400 text-slate-950 font-black' 
                    : (eyeComfortMode ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')
                }`}
              >
                MZ
              </button>
              <button
                type="button"
                onClick={() => setLang('english')}
                className={`px-1.5 sm:px-2 py-0.5 rounded-md transition cursor-pointer ${
                  lang === 'english' 
                    ? 'bg-amber-400 text-slate-950 font-black' 
                    : (eyeComfortMode ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')
                }`}
              >
                EN
              </button>
            </div>

            {/* AI Khual Chhawn Trigger Button (Desktop 2XL only) */}
            <button
              type="button"
              onClick={() => setIsAIChatOpen(true)}
              className={`hidden 2xl:flex items-center gap-1.5 ${
                eyeComfortMode 
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200' 
                  : 'bg-gradient-to-r from-indigo-950 to-purple-950 hover:from-indigo-900 hover:to-purple-900 text-indigo-300 hover:text-white border-indigo-700/60'
              } border px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0`}
            >
              <Bot className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">AIChat</span>
            </button>

            {/* PhonePe PG Checkout Direct Button (UAT Review) */}
            <button
              type="button"
              id="website-phonepe-checkout-nav-btn"
              onClick={() => openPhonePeUatPortal(100)}
              className="bg-gradient-to-r from-[#5f259f] to-[#7b2cbf] hover:from-[#511e89] hover:to-[#6a24a6] active:scale-95 text-white font-bold sm:font-black text-[11px] sm:text-xs md:text-sm px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-md transition cursor-pointer border border-purple-400/50 shrink-0 whitespace-nowrap"
              title="Open Official PhonePe PG UAT Portal (mercury-uat.phonepe.com)"
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300 fill-amber-300 shrink-0" />
              <span className="whitespace-nowrap">PhonePe</span>
              <span className="hidden md:inline-block text-[9px] bg-white/20 text-white font-bold px-1 rounded">UAT</span>
            </button>

            {/* Launch App Main CTA ("App Lut Rawh") - 100% visible, fully padded, never clipped on mobile */}
            <button
              type="button"
              id="website-launch-app-nav-btn"
              onClick={() => onLaunchApp('home')}
              className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-[11px] sm:text-xs md:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl flex items-center gap-1 sm:gap-1.5 shadow-xs transition cursor-pointer border border-amber-300 shrink-0 whitespace-nowrap"
              title="Launch www.ronpay.app/app as Guest User"
            >
              <Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 shrink-0" />
              <span className="whitespace-nowrap">{isMizo ? 'App Lut Rawh' : 'Launch App'}</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 hidden sm:inline" />
            </button>

            {/* Mobile/Tablet Hamburger Menu Toggle ("Page luhna thlanna") - ALWAYS visible on mobile without clipping */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={`lg:hidden w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0 flex items-center justify-center transition border cursor-pointer active:scale-95 ${
                eyeComfortMode 
                  ? mobileMenuOpen 
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                    : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200' 
                  : mobileMenuOpen 
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs' 
                    : 'bg-slate-900 border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800'
              }`}
              title={isMizo ? 'Page luhna thlanna (Menu)' : 'Navigation Menu'}
              aria-label={isMizo ? 'Page luhna thlanna (Menu)' : 'Navigation Menu'}
            >
              {mobileMenuOpen ? <X className="w-4 h-4 text-current" /> : <Menu className="w-4 h-4 text-current" />}
            </button>
          </div>
        </div>

        {/* Mobile/Tablet Dropdown Menu ("Page Luhna Thlanna") - Active ONLY on screens under LG */}
        {mobileMenuOpen && (
          <div className={`lg:hidden ${
            eyeComfortMode 
              ? 'bg-white/98 border-b border-slate-200 text-slate-850 shadow-xl' 
              : 'bg-slate-950/98 border-b border-slate-800 text-white'
          } px-3 sm:px-4 py-3.5 space-y-3 animate-fadeIn`}>
            {/* Menu Header with quick controls for Language & Theme on mobile */}
            <div className={`flex items-center justify-between pb-2 border-b ${
              eyeComfortMode ? 'border-slate-200' : 'border-slate-800'
            }`}>
              <div className="flex items-center gap-1.5">
                <Menu className="w-3.5 h-3.5 text-amber-500" />
                <span className={`text-[11px] font-black uppercase tracking-wider ${
                  eyeComfortMode ? 'text-slate-700' : 'text-slate-300'
                }`}>
                  {isMizo ? 'Page Luhna' : 'Menu'}
                </span>
              </div>

              {/* Mobile Quick Controls: Language & Theme */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center ${eyeComfortMode ? 'bg-slate-100 border-slate-250' : 'bg-slate-900 border-slate-700'} border rounded-lg p-0.5 text-[10px] font-bold`}>
                  <button
                    type="button"
                    onClick={() => setLang('mizo')}
                    className={`px-2 py-0.5 rounded-md transition ${lang === 'mizo' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400'}`}
                  >
                    MZ
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('english')}
                    className={`px-2 py-0.5 rounded-md transition ${lang === 'english' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400'}`}
                  >
                    EN
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEyeComfortMode(!eyeComfortMode)}
                  className={`p-1.5 rounded-lg border text-xs ${eyeComfortMode ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                  title="Toggle Theme"
                >
                  {eyeComfortMode ? <Sun className="w-3.5 h-3.5 text-amber-600" /> : <Moon className="w-3.5 h-3.5 text-slate-300" />}
                </button>

                <button 
                  type="button" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition ${
                    eyeComfortMode 
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300' 
                      : 'bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-700'
                  }`}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <a 
                href="#hero" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' 
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-200'
                }`}
              >
                🏠 {isMizo ? 'Kawtchhuah' : 'Home'}
              </a>
              <a 
                href="#phonepe" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900' 
                    : 'bg-purple-950/40 hover:bg-purple-950/60 border-purple-800/50 text-purple-300'
                }`}
              >
                ⚡ PhonePe Thawhdun
              </a>
              <a 
                href="#services" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' 
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-200'
                }`}
              >
                📦 {isMizo ? 'Bawm 5 Services' : '5 Bawm Services'}
              </a>
              <button 
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setManualModalOpen(true);
                }}
                className={`p-2.5 rounded-xl border transition text-left flex items-center gap-1 cursor-pointer ${
                  eyeComfortMode 
                    ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900' 
                    : 'bg-indigo-950/40 hover:bg-indigo-950/60 border-indigo-800/50 text-indigo-300'
                }`}
              >
                📖 <span>{isMizo ? 'User Manual' : 'User Manual'}</span>
              </button>
              <a 
                href="#bbps" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900' 
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-amber-300'
                }`}
              >
                💡 BBPS Bills & Topup
              </a>
              <a 
                href="#security" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' 
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-200'
                }`}
              >
                🛡️ {isMizo ? 'Rinngamna' : 'Security'}
              </a>
              <a 
                href="#contact" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900' 
                    : 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-800/50 text-emerald-300'
                }`}
              >
                📞 {isMizo ? 'Biakpawhna' : 'Contact'}
              </a>
              <a 
                href="#faq" 
                onClick={() => setMobileMenuOpen(false)}
                className={`p-2.5 rounded-xl border transition ${
                  eyeComfortMode 
                    ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800' 
                    : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-200'
                }`}
              >
                ❓ FAQ
              </a>
            </div>

            <div className={`pt-2 border-t ${eyeComfortMode ? 'border-slate-200' : 'border-slate-800/80'} flex flex-col gap-2`}>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsAIChatOpen(true);
                }}
                className="w-full bg-gradient-to-r from-indigo-900 to-purple-900 text-white font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 border border-indigo-700/60"
              >
                <Bot className="w-4 h-4 text-amber-300" />
                <span>AIChat (RonPay Khual Chhawn) Biakna</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLaunchApp('home');
                }}
                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-xs"
              >
                <Smartphone className="w-4 h-4" />
                <span>{isMizo ? 'RonPay App Lut Rawh (Khualmi)' : 'Launch App as Guest User'}</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION: Powerful & Beautiful High-Tech Presentation */}
      <section id="hero" className={`relative pt-10 pb-16 sm:pt-16 sm:pb-24 overflow-hidden ${eyeComfortMode ? 'bg-gradient-to-b from-indigo-50/30 via-slate-50/50 to-white' : ''}`}>
        {/* Ambient background glows */}
        {!eyeComfortMode && (
          <>
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute top-1/3 right-10 w-[450px] h-[450px] bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            
            {/* Left Column: Headlines & Call to Actions */}
            <div className="lg:col-span-7 space-y-5 text-left">
              
              {/* Feature Badges with PhonePe & BBPS */}
              <div className="flex flex-wrap items-center gap-2">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${eyeComfortMode ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-xs' : 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-xs'} border text-xs font-bold`}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PhonePe PG V2 & TSP Official Partner</span>
                </div>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${eyeComfortMode ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-xs' : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-xs'} border text-xs font-bold`}>
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>EBill, Water, Fastag & School Fees BBPS</span>
                </div>
              </div>

              {/* Main Headline */}
              <h1 className={`text-3xl sm:text-5xl lg:text-6xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} tracking-tight leading-[1.12]`}>
                {isMizo ? (
                  <>
                    Mizoram <span className={eyeComfortMode ? 'text-indigo-900' : 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-300 to-amber-300'}>Kohhran & Khawtlang</span> Tana Digital Bawm & BBPS Platform
                  </>
                ) : (
                  <>
                    Empowering <span className={eyeComfortMode ? 'text-indigo-800' : 'text-purple-400'}>Mizo</span> <span className={eyeComfortMode ? 'text-amber-800' : 'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-orange-400 to-amber-300'}>Community</span> with PhonePe Payments & BBPS Utilities
                  </>
                )}
              </h1>

              {/* Sub-headline / Copywriting */}
              <p className={`text-sm sm:text-base ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed max-w-2xl font-normal`}>
                {isMizo 
                  ? 'Digital payment company lian ber PhonePe nen a thawk dunin, Ralna bawm, Kohhran chhungkaw bu, BBPS electric & tui bill, Fastag, School fees, Municipal taxes leh Mobile topup awlsam taka tih theihna platform famkim.' 
                  : "Engineered in partnership with India's largest payment giant PhonePe. Streamline Ralna bereavement funds, church family rolls, and complete BBPS utilities: EBill, Water, FASTag, School Fees, Municipal Taxes, and Mobile Topup."}
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => onLaunchApp('home')}
                  className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-base px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer border border-amber-300"
                >
                  <Smartphone className="w-5 h-5 text-slate-950" />
                  <span>{isMizo ? 'RonPay Web App Hawng Rawh' : 'Launch RonPay App'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  id="hero-phonepe-checkout-btn"
                  onClick={() => openPhonePeUatPortal(100)}
                  className="bg-gradient-to-r from-[#5f259f] via-[#7b2cbf] to-[#511e89] hover:from-[#511e89] hover:to-[#6a24a6] text-white font-black text-sm sm:text-base px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-900/40 transition cursor-pointer border border-purple-400/40 active:scale-95 shrink-0"
                  title="Open Official PhonePe PG UAT Portal (mercury-uat.phonepe.com)"
                >
                  <Zap className="w-5 h-5 text-amber-300 fill-amber-300" />
                  <span>{isMizo ? '⚡ PhonePe PG Checkout En Rawh' : '⚡ Test PhonePe Checkout'}</span>
                  <span className="text-[10px] bg-white/20 text-white font-bold px-1.5 py-0.5 rounded-md">UAT</span>
                </button>

                <a
                  href="#services"
                  className={`${eyeComfortMode ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-250 shadow-xs' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'} font-bold text-sm px-5 py-3.5 rounded-2xl flex items-center justify-center gap-2 border transition cursor-pointer`}
                >
                  <QrCode className="w-4 h-4 text-orange-500" />
                  <span>{isMizo ? 'Bawm 5 En Rawh' : 'Explore 5 Bawms'}</span>
                </a>

                <a
                  href="#bbps"
                  className={`${eyeComfortMode ? 'bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border-indigo-200' : 'bg-slate-900/80 hover:bg-slate-800 text-indigo-300 border-indigo-900/50'} font-bold text-sm px-4 py-3.5 rounded-2xl flex items-center justify-center gap-2 border transition cursor-pointer`}
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>{isMizo ? 'BBPS Bill Pekna' : 'BBPS Utilities'}</span>
                </a>
              </div>

              {/* App URL Copy Bar & Guest Note */}
              <div className={`p-3 ${eyeComfortMode ? 'bg-white border-slate-200 text-slate-700 shadow-xs' : 'bg-slate-900/70 border-slate-800 text-slate-300'} border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs`}>
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className={`${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'} text-[11px] sm:text-xs`}>
                    {isMizo ? 'App chhungah hian default in Khualmi (Guest User) angin i lut nghal ang.' : 'Defaulting to Guest User (Khualmi) upon app launch.'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>Official URL:</span>
                  <code className={`${eyeComfortMode ? 'bg-slate-100 text-indigo-900 border-slate-200' : 'bg-slate-950 text-amber-300 border-slate-800'} px-2 py-0.5 rounded text-[11px] font-mono border`}>
                    www.ronpay.app/app
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('https://www.ronpay.app/app', 'applink')}
                    className={`p-1 ${eyeComfortMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'} rounded transition cursor-pointer`}
                    title="Copy Link"
                  >
                    {appLinkCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Trust Metric Counters */}
              <div className={`pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t ${eyeComfortMode ? 'border-slate-200' : 'border-slate-800/80'}`}>
                <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/40 border-slate-800/60'} p-3 rounded-xl border`}>
                  <div className={`text-xl font-black ${eyeComfortMode ? 'text-amber-800' : 'text-amber-400'}`}>PhonePe PG</div>
                  <div className={`text-[10.5px] ${eyeComfortMode ? 'text-slate-550' : 'text-slate-400'} font-medium mt-0.5`}>
                    {isMizo ? 'TSP V2 Certified' : 'PG V2 Engine'}
                  </div>
                </div>

                <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/40 border-slate-800/60'} p-3 rounded-xl border`}>
                  <div className={`text-xl font-black ${eyeComfortMode ? 'text-purple-800' : 'text-purple-400'}`}>5 Bawm</div>
                  <div className={`text-[10.5px] ${eyeComfortMode ? 'text-slate-550' : 'text-slate-400'} font-medium mt-0.5`}>
                    {isMizo ? 'Community Category' : 'Community Suites'}
                  </div>
                </div>

                <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/40 border-slate-800/60'} p-3 rounded-xl border`}>
                  <div className={`text-xl font-black ${eyeComfortMode ? 'text-emerald-800' : 'text-emerald-400'}`}>100% Direct</div>
                  <div className={`text-[10.5px] ${eyeComfortMode ? 'text-slate-550' : 'text-slate-400'} font-medium mt-0.5`}>
                    {isMizo ? 'Bank-ah Tlang Nghal' : 'Direct IMPS Payout'}
                  </div>
                </div>

                <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/40 border-slate-800/60'} p-3 rounded-xl border`}>
                  <div className={`text-xl font-black ${eyeComfortMode ? 'text-sky-800' : 'text-sky-400'}`}>BBPS Hub</div>
                  <div className={`text-[10.5px] ${eyeComfortMode ? 'text-slate-550' : 'text-slate-400'} font-medium mt-0.5`}>
                    {isMizo ? 'EBill & Topup Kim' : 'All Utilities Live'}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Phone & Soundbox Interactive Demo */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-sm">
                
                {/* Phone Frame Mockup */}
                <div className={`relative ${eyeComfortMode ? 'bg-white border-4 border-slate-200 shadow-lg ring-1 ring-slate-100' : 'bg-slate-900 border-4 border-slate-700/80 shadow-2xl shadow-purple-950/40 ring-1 ring-slate-800'} rounded-[38px] p-4 transition-colors`}>
                  
                  {/* Phone Speaker Notch */}
                  <div className={`w-24 h-3.5 ${eyeComfortMode ? 'bg-slate-100' : 'bg-slate-800'} rounded-full mx-auto mb-3 flex items-center justify-center`}>
                    <div className={`w-8 h-1 ${eyeComfortMode ? 'bg-slate-300' : 'bg-slate-700'} rounded-full`} />
                  </div>

                  {/* Card Header inside phone */}
                  <div className={`${eyeComfortMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/90 border-slate-700/70'} rounded-2xl p-2.5 border mb-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 font-black flex items-center justify-center text-xs border border-amber-400/30">
                        R
                      </div>
                      <div>
                        <div className={`text-xs font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} flex items-center gap-1`}>
                          <span>Pi Lalhmingliani Ralna</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        </div>
                        <div className={`text-[10px] ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Bungkawn YMA • Verified
                        </div>
                      </div>
                    </div>
                    <span className={`text-[9px] ${eyeComfortMode ? 'bg-purple-100 text-purple-900 border-purple-200' : 'bg-purple-900/60 text-purple-300 border-purple-700/50'} font-bold px-2 py-0.5 rounded-md border`}>
                      PhonePe UPI
                    </span>
                  </div>

                  {/* Live Dynamic QR Poster Preview */}
                  <div className={`${eyeComfortMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'} rounded-2xl p-4 border text-center space-y-2.5`}>
                    <div className={`text-[10.5px] font-bold ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'} flex items-center justify-center gap-1`}>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tamper-Proof RonPay Dynamic QR</span>
                    </div>

                    <div className="bg-white p-3 rounded-xl inline-block shadow-sm border border-slate-200/80">
                      <QrCode className="w-28 h-28 text-slate-900" />
                    </div>

                    <div className="space-y-1">
                      <div className={`text-xs font-black ${eyeComfortMode ? 'text-amber-800' : 'text-amber-400'}`}>
                        Scan with PhonePe, GPay, Paytm or any UPI
                      </div>
                      <div className={`text-[10px] ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        100% Direct to Beneficiary Bank Account
                      </div>
                    </div>
                  </div>

                  {/* Mizo Soundbox Voice Audio Demonstration */}
                  <div className={`mt-3 ${eyeComfortMode ? 'bg-indigo-50 border-indigo-200' : 'bg-gradient-to-r from-purple-950/80 to-indigo-950/80 border-purple-700/50'} rounded-2xl p-3 border flex items-center justify-between gap-2`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs ${soundboxPlaying ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-purple-600 text-white'}`}>
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className={`text-xs font-black ${eyeComfortMode ? 'text-indigo-950' : 'text-white'}`}>Mizo Soundbox Chhinna</div>
                        <div className={`text-[10px] ${eyeComfortMode ? 'text-indigo-700' : 'text-purple-300'}`}>
                          {soundboxPlaying ? 'Aw a chhuak mek...' : '"RonPay-ah cheng zanga..."'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => playSoundboxDemo()}
                      disabled={soundboxPlaying}
                      className="bg-amber-400 hover:bg-amber-300 active:scale-95 text-slate-950 font-black text-[10.5px] px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0 shadow-xs"
                    >
                      {soundboxPlaying ? 'Rilawk...' : 'Play Aw'}
                    </button>
                  </div>

                  {/* Open in App Quick Button */}
                  <button
                    type="button"
                    onClick={() => onLaunchApp('home')}
                    className={`w-full mt-3 ${eyeComfortMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200' : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700'} font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 border transition cursor-pointer`}
                  >
                    <span>{isMizo ? 'App Chhungah En Rawh (Khualmi)' : 'Open App as Guest'}</span>
                    <ArrowRight className="w-3 h-3 text-amber-500" />
                  </button>

                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. DEDICATED PHONEPE PARTNERSHIP SHOWCASE SECTION */}
      <section id="phonepe" className={`py-14 sm:py-20 ${eyeComfortMode ? 'bg-purple-50/40 border-y border-purple-100' : 'bg-gradient-to-b from-slate-950 via-purple-950/20 to-slate-950 border-y border-purple-900/30'} relative transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className={`inline-flex items-center gap-1.5 ${eyeComfortMode ? 'bg-purple-100 text-purple-900 border-purple-200' : 'bg-purple-500/20 text-purple-300 border-purple-400/40'} text-xs font-black px-3.5 py-1 rounded-full border uppercase tracking-wider`}>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              {isMizo ? 'Digital Payment Company Lian Ber Nen' : 'National Payment Powerhouse'}
            </span>
            <h2 className={`text-2xl sm:text-4xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} tracking-tight`}>
              {isMizo 
                ? 'PhonePe Nen A Hna Thawk Dunin, Rinngam & Rang Takin' 
                : "Official Partnership with India's #1 Digital Payments Leader PhonePe"}
            </h2>
            <p className={`text-sm sm:text-base ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
              {isMizo 
                ? 'RonPay hi India ram pum huapa digital transaction tam ber khawihtu PhonePe Technology Service Provider (TSP) leh PG V2 architecture hmanga duanchhuah a ni a. Mizo mipuiten hlauthawng miah lova sum thawhkhawm leh utilities kan pek theih nan a him tawk em em a ni.' 
                : 'Built on the robust enterprise rails of PhonePe Payment Gateway V2 and Technology Service Provider (TSP) protocols. Ensuring instant direct IMPS bank payouts and zero fraudulent screenshots.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* PhonePe Advantage 1 */}
            <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm' : 'bg-slate-900/80 border-purple-900/50 hover:border-purple-500/60'} border p-6 rounded-3xl space-y-3 transition group`}>
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-xl shadow-xs border border-purple-400 group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <h3 className={`text-base font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>PhonePe PG V2 Engine</h3>
              <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
                {isMizo 
                  ? '99.9% uptime nei, transaction second 2 chhung zela tling nghal zel thei architecture rintlak ber.' 
                  : 'Blazing fast PG V2 architecture with 99.9% success rate and sub-second payment clearance.'}
              </p>
              <div className={`pt-2 text-[11px] ${eyeComfortMode ? 'text-purple-700' : 'text-purple-300'} font-bold flex items-center gap-1`}>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Sub-Second Clearance</span>
              </div>
            </div>

            {/* PhonePe Advantage 2 */}
            <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm' : 'bg-slate-900/80 border-purple-900/50 hover:border-purple-500/60'} border p-6 rounded-3xl space-y-3 transition group`}>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-xl shadow-xs border border-emerald-400 group-hover:scale-105 transition-transform">
                🏦
              </div>
              <h3 className={`text-base font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>Direct IMPS Bank Settlement</h3>
              <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
                {isMizo 
                  ? 'RonPay hian sum kan khawl ve ngai lo. Pawisa thawhtu-in a scan rualin Kohhran emaw pawl bank account-ah direct-in a lut tlang nghal char char.' 
                  : 'Zero escrow holding. Donated funds route directly into your church or community bank account via IMPS.'}
              </p>
              <div className={`pt-2 text-[11px] ${eyeComfortMode ? 'text-emerald-700' : 'text-emerald-300'} font-bold flex items-center gap-1`}>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Direct to Bank</span>
              </div>
            </div>

            {/* PhonePe Advantage 3 */}
            <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm' : 'bg-slate-900/80 border-purple-900/50 hover:border-purple-500/60'} border p-6 rounded-3xl space-y-3 transition group`}>
              <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center font-black text-xl shadow-xs border border-amber-400 group-hover:scale-105 transition-transform">
                🛡️
              </div>
              <h3 className={`text-base font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>Zero Screenshot Fraud</h3>
              <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
                {isMizo 
                  ? 'UPI screenshot der (fake screenshot) hmanga inbumna a awm tawh lo. Server-level verification leh Mizo soundbox-in a nemnghet nghal thlap.' 
                  : 'Eliminates fraudulent screenshots through real-time server webhooks and instant voice soundbox alerts.'}
              </p>
              <div className={`pt-2 text-[11px] ${eyeComfortMode ? 'text-amber-700' : 'text-amber-300'} font-bold flex items-center gap-1`}>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tamper-Proof Verification</span>
              </div>
            </div>

            {/* PhonePe Advantage 4 */}
            <div className={`${eyeComfortMode ? 'bg-white border-slate-200 shadow-xs hover:border-purple-300 hover:shadow-sm' : 'bg-slate-900/80 border-purple-900/50 hover:border-purple-500/60'} border p-6 rounded-3xl space-y-3 transition group`}>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-xs border border-indigo-400 group-hover:scale-105 transition-transform">
                📱
              </div>
              <h3 className={`text-base font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>Universal UPI Support</h3>
              <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
                {isMizo 
                  ? 'PhonePe, Google Pay, Paytm, BHIM, Cred, leh Bank UPI apps tinreng atangin fiah fai takin a scan theih vek.' 
                  : 'Seamlessly accepts payments from PhonePe, Google Pay, Paytm, BHIM, and all Indian banking UPI apps.'}
              </p>
              <div className={`pt-2 text-[11px] ${eyeComfortMode ? 'text-indigo-700' : 'text-indigo-300'} font-bold flex items-center gap-1`}>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>All UPI Apps Compatible</span>
              </div>
            </div>

          </div>

          {/* UAT & Reviewer Testing Hub: Direct Access to PhonePe PG V2 Checkout Flow */}
          <div className={`mt-10 rounded-3xl border ${eyeComfortMode ? 'bg-white border-purple-200 shadow-md' : 'bg-slate-900/90 border-purple-800/60 shadow-2xl'} p-6 sm:p-8 space-y-6`}>
            
            {/* Header / Intro */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-purple-100 dark:border-purple-900/40">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5f259f] to-[#7b2cbf] text-white flex items-center justify-center shadow-md">
                  <Zap className="w-7 h-7 text-amber-300 fill-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-lg sm:text-xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                      PhonePe PG V2 UAT & End-to-End Testing Portal
                    </h3>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 px-2 py-0.5 rounded-full font-extrabold uppercase">
                      Live Sandbox
                    </span>
                  </div>
                  <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} mt-0.5`}>
                    Dedicated UAT validation interface for PhonePe integration review team (Merchant: <b className="font-mono text-purple-600 dark:text-purple-300">TSPMIZOPAYUAT</b>)
                  </p>
                </div>
              </div>

              {/* Direct Deep Link & Copy */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyPhonePeUatLink(phonePeUatAmount)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                    copiedPhonePeLink
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : eyeComfortMode
                      ? 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
                      : 'bg-slate-800 text-purple-200 border-slate-700 hover:bg-slate-750'
                  }`}
                  title="Copy Official PhonePe PG UAT Direct Link"
                >
                  {copiedPhonePeLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPhonePeLink ? 'Copied Direct UAT Link!' : 'Copy Direct UAT Link'}</span>
                </button>
              </div>
            </div>

            {/* 3 Step Validation Cards (Matching PhonePe Review Checklist) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Point 1: Initiate Test Payments */}
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${eyeComfortMode ? 'bg-purple-50/50 border-purple-200' : 'bg-slate-950/60 border-purple-900/40'}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                      Step 1 • Payment Flow
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">PG V2</span>
                  </div>
                  <h4 className={`text-sm font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                    Initiate Test Transactions
                  </h4>
                  <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                    Validate full end-to-end checkout flow across UPI, Cards, NetBanking, and Wallets on PhonePe official UAT portal.
                  </p>
                  
                  {/* Preset Amount Selectors */}
                  <div className="pt-2">
                    <label className={`block text-[10px] font-extrabold uppercase ${eyeComfortMode ? 'text-slate-700' : 'text-slate-400'} mb-1.5`}>
                      Select Test Amount:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[10, 100, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setPhonePeUatAmount(amt)}
                          className={`py-1 px-1.5 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                            phonePeUatAmount === amt
                              ? 'bg-[#5f259f] text-white border-[#5f259f] shadow-xs'
                              : eyeComfortMode
                              ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => openPhonePeUatPortal(phonePeUatAmount)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-[#5f259f] to-[#7b2cbf] hover:from-[#511e89] hover:to-[#6a24a6] text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                    title="Open Official PhonePe UAT Portal in New Tab"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                    <span>Launch Official PhonePe UAT (₹{phonePeUatAmount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Point 2: TSP Headers & Webhooks */}
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${eyeComfortMode ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-950/60 border-indigo-900/40'}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
                      Step 2 • Technical Spec
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">Headers & S2S</span>
                  </div>
                  <h4 className={`text-sm font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                    TSP Headers & Webhooks
                  </h4>
                  <div className="space-y-1 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                    <p className="flex items-center gap-1">
                      <span className="text-emerald-500">✔</span>
                      <span>Auth: Bearer &lt;TSP Token&gt;</span>
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="text-emerald-500">✔</span>
                      <span>X-MERCHANT-ID: TSPMIZOPAYUAT</span>
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="text-emerald-500">✔</span>
                      <span>X-SOURCE: WEB (v1.0)</span>
                    </p>
                    <p className="flex items-center gap-1">
                      <span className="text-emerald-500">✔</span>
                      <span>Webhook: /api/phonepe/webhook</span>
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={onOpenPhonePePortal}
                    className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Inspect Headers & Logs</span>
                  </button>
                </div>
              </div>

              {/* Point 3: Payment Confirmation */}
              <div className={`p-4 rounded-2xl border flex flex-col justify-between ${eyeComfortMode ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-950/60 border-emerald-900/40'}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                      Step 3 • Verification
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-500">Receipt</span>
                  </div>
                  <h4 className={`text-sm font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                    Payment Confirmation
                  </h4>
                  <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-400'} leading-relaxed`}>
                    Instant server-side status check, UTR generation, and official tamper-proof digital receipt with verified QR watermark.
                  </p>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300">
                    <p>Status API: GET /api/phonepe/status/:id</p>
                    <p>Checksum: SHA256 + Salt Key (Index 1)</p>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => openPhonePeUatPortal(100)}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                    title="Run PhonePe PG Verification Flow in New Tab"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Launch PhonePe UAT (₹100)</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Direct URL Note */}
            <div className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${eyeComfortMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-purple-600 shrink-0" />
                <span className={eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}>
                  <b>PhonePe UAT Direct Link:</b> Use <code className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 font-mono text-purple-900 dark:text-purple-200 font-bold">https://ronpay.app/api/phonepe/launch-pay?amt=100</code> (or <code className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 font-mono text-purple-900 dark:text-purple-200 font-bold">/phonepe</code>) to open the official PhonePe PG UAT portal (mercury-uat.phonepe.com) instantly.
                </span>
              </div>
              <button
                type="button"
                onClick={() => openPhonePeUatPortal(100)}
                className="px-3 py-1.5 bg-[#5f259f] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#511e89] transition cursor-pointer shrink-0"
              >
                Open Official PhonePe UAT Now
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* 5. RONPAY SERVICES SECTION: 5 BAWMS (TAWI FEL DEUHA HRILHFIAH) */}
      <section id="services" className={`py-16 sm:py-24 relative ${eyeComfortMode ? 'bg-[#f8fafc]' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className={`inline-flex items-center gap-1 ${eyeComfortMode ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-amber-500/15 text-amber-300 border-amber-400/30'} text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider`}>
              <QrCode className="w-3.5 h-3.5" />
              {isMizo ? 'RonPay Bawm Hrang Hrang Te' : 'RonPay 5 Community Suites'}
            </span>
            <h2 className={`text-2xl sm:text-4xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} tracking-tight`}>
              {isMizo ? 'Bawm Hrang Hrang Te Tawi Fel Takin' : 'Concise & Structured Community Bawm Categories'}
            </h2>
            <p className={`text-sm sm:text-base ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
              {isMizo 
                ? 'Mizoram mamawh mil liau liava duan Bawm 5 te hi a hman dan leh thiltum tawi fel deuha hrilhfiahna:' 
                : 'Built specifically for the needs of Mizoram churches, communities, and families. Here is each Bawm explained clearly:'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* BAWM 1: RALNA BAWM */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 hover:border-red-400 shadow-sm' : 'bg-slate-900 border-2 border-slate-800 hover:border-red-500/70 shadow-xl'} p-6 rounded-3xl space-y-3 transition duration-300 group flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-red-600/15 text-red-500 flex items-center justify-center border border-red-400/40 text-xl font-black group-hover:scale-105 transition-transform">
                    🖤
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${eyeComfortMode ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-950 text-red-300 border-red-800'} border`}>
                    Chhiatni & YMA Pual
                  </span>
                </div>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900 group-hover:text-red-700' : 'text-white group-hover:text-red-300'} transition`}>
                  1. Ralna Bawm
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Chhiatni-a ralna sum thawhkhawmna felfai. Mitthi thlalak, chanchin kimchang, vui hun chuanna QR poster mawi tak minute 1 chhungin siam la. Thawhtuten an scan rualin WhatsApp receipt an dawng nghal a, Mizo aw (Soundbox)-in a puang nghal bawk.' 
                    : 'Dedicated condolence and bereavement collection. Generate high-resolution obituary QR posters with photos and funeral timings. Instant WhatsApp receipts and Mizo soundbox announcements.'}
                </p>
                <ul className={`mt-3 space-y-1.5 text-[11px] ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-red-500 shrink-0" /> Dynamic Obituary Poster Studio
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-red-500 shrink-0" /> Automatic WhatsApp Digital Receipt
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-red-500 shrink-0" /> Mizo Soundbox Voice Alert
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t ${eyeComfortMode ? 'border-slate-150' : 'border-slate-800/80'} space-y-2`}>
                <button
                  type="button"
                  onClick={() => onLaunchApp('explorer', 'ralna')}
                  className={`w-full ${eyeComfortMode ? 'bg-red-50 hover:bg-red-100 text-red-800 border-red-200' : 'bg-red-950 hover:bg-red-900 text-red-200 border-red-800'} border font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <span>{isMizo ? 'Ralna Bawm En Rawh' : 'Explore Ralna Bawm'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualActiveKey('ralna');
                    setManualModalOpen(true);
                  }}
                  className={`w-full ${eyeComfortMode ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'} border font-semibold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-red-500" />
                  <span>{isMizo ? '📖 Hman Dan / User Manual' : '📖 User Guide & Steps'}</span>
                </button>
              </div>
            </div>

            {/* BAWM 2: KUMTLUANG BAWM */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 hover:border-blue-400 shadow-sm' : 'bg-slate-900 border-2 border-slate-800 hover:border-blue-500/70 shadow-xl'} p-6 rounded-3xl space-y-3 transition duration-300 group flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/15 text-blue-500 flex items-center justify-center border border-blue-400/40 text-xl font-black group-hover:scale-105 transition-transform">
                    🏛️
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${eyeComfortMode ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-950 text-blue-300 border-blue-800'} border`}>
                    Kohhran & Pawl
                  </span>
                </div>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900 group-hover:text-blue-700' : 'text-white group-hover:text-blue-300'} transition`}>
                  2. Kumtluang Bawm
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Kohhran thawhlawm (Pathian Ram, Tualchhung, Ramthim, Building) leh Pawl thla tin chhungkaw bu. 4-digit Quick Entry hmangin awlsam taka ziah luh theih niin, Secretary leh Treasurer tan 1-Click Committee Audit Report (PDF & Excel) a siam nghal zung zung thei.' 
                    : 'Church and institutional recurring giving. Track monthly household registers, tithes, and mission funds with 4-digit Quick Entry and export 1-Click official Committee Audit Reports in PDF/Excel.'}
                </p>
                <ul className={`mt-3 space-y-1.5 text-[11px] ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> Digital Chhungkaw Bu & Member Roll
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 4-Digit Blazing Fast Quick Entry
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" /> 1-Click Committee PDF/Excel Export
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t ${eyeComfortMode ? 'border-slate-150' : 'border-slate-800/80'} space-y-2`}>
                <button
                  type="button"
                  onClick={() => onLaunchApp('explorer', 'kumtluang')}
                  className={`w-full ${eyeComfortMode ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-200' : 'bg-blue-950 hover:bg-blue-900 text-blue-200 border-blue-800'} border font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <span>{isMizo ? 'Kumtluang Bawm En Rawh' : 'Explore Kumtluang'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualActiveKey('kumtluang');
                    setManualModalOpen(true);
                  }}
                  className={`w-full ${eyeComfortMode ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'} border font-semibold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                  <span>{isMizo ? '📖 Hman Dan / User Manual' : '📖 User Guide & Steps'}</span>
                </button>
              </div>
            </div>

            {/* BAWM 3: KHAWLSAK BAWM */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 hover:border-emerald-400 shadow-sm' : 'bg-slate-900 border-2 border-slate-800 hover:border-emerald-500/70 shadow-xl'} p-6 rounded-3xl space-y-3 transition duration-300 group flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600/15 text-emerald-500 flex items-center justify-center border border-emerald-400/40 text-xl font-black group-hover:scale-105 transition-transform">
                    🏗️
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${eyeComfortMode ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950 text-emerald-300 border-emerald-800'} border`}>
                    Building & Projects
                  </span>
                </div>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900 group-hover:text-emerald-700' : 'text-white group-hover:text-emerald-300'} transition`}>
                  3. Khawlsak Bawm
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Biak In sak, YMA Hall sak, Community Hall, leh Project lian tham puala sum thawhkhawm vawnna. Target amount, sum lut zat, leh thawhtute hming fiah fai taka tarlanna Progress Dashboard nen a in-thuam thlap.' 
                    : 'Church construction, hall development, and capital project fundraisers. Complete with real-time target amount progress bars, transparent donor lists, and verified receipts.'}
                </p>
                <ul className={`mt-3 space-y-1.5 text-[11px] ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Target Amount Progress Bar
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Transparent Donor Transparency Board
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Cash & Online Unified Tracker
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t ${eyeComfortMode ? 'border-slate-150' : 'border-slate-800/80'} space-y-2`}>
                <button
                  type="button"
                  onClick={() => onLaunchApp('explorer', 'khawlsak')}
                  className={`w-full ${eyeComfortMode ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-950 hover:bg-emerald-900 text-emerald-200 border-emerald-800'} border font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <span>{isMizo ? 'Khawlsak Bawm En Rawh' : 'Explore Khawlsak'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualActiveKey('khawlsak');
                    setManualModalOpen(true);
                  }}
                  className={`w-full ${eyeComfortMode ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'} border font-semibold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{isMizo ? '📖 Hman Dan / User Manual' : '📖 User Guide & Steps'}</span>
                </button>
              </div>
            </div>

            {/* BAWM 4: RIKRUM BAWM */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 hover:border-rose-400 shadow-sm' : 'bg-slate-900 border-2 border-slate-800 hover:border-rose-500/70 shadow-xl'} p-6 rounded-3xl space-y-3 transition duration-300 group flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-rose-600/15 text-rose-500 flex items-center justify-center border border-rose-400/40 text-xl font-black group-hover:scale-105 transition-transform">
                    🚨
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${eyeComfortMode ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-950 text-rose-300 border-rose-800'} border`}>
                    Free • Emergency Relief
                  </span>
                </div>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900 group-hover:text-rose-700' : 'text-white group-hover:text-rose-300'} transition`}>
                  4. Rikrum Bawm
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Kangmei, tuilian, lei tlahmual, leh damlo zual thut tanpuina emergency bawm. Setup fee a awm lo (100% Free Setup), minute 1 chhungin live nghal theih a ni a, sum lut zawng zawng beneficiary account-ah a tlang nghal zel.' 
                    : 'Zero-fee emergency and disaster relief for house fires, landslides, and urgent medical needs. Activates in under 1 minute with 100% direct hospital/victim bank routing.'}
                </p>
                <ul className={`mt-3 space-y-1.5 text-[11px] ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Zero Platform Setup Charge (Free)
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Minute 1 Instant QR Activation
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-rose-500 shrink-0" /> Emergency Hospital & Relief Dispatch
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t ${eyeComfortMode ? 'border-slate-150' : 'border-slate-800/80'} space-y-2`}>
                <button
                  type="button"
                  onClick={() => onLaunchApp('explorer', 'rikrum')}
                  className={`w-full ${eyeComfortMode ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200' : 'bg-rose-950 hover:bg-rose-900 text-rose-200 border-rose-800'} border font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <span>{isMizo ? 'Rikrum Bawm En Rawh' : 'Explore Emergency Bawm'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualActiveKey('rikrum');
                    setManualModalOpen(true);
                  }}
                  className={`w-full ${eyeComfortMode ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'} border font-semibold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-rose-500" />
                  <span>{isMizo ? '📖 Hman Dan / User Manual' : '📖 User Guide & Steps'}</span>
                </button>
              </div>
            </div>

            {/* BAWM 5: MIMAL & CHHUNGKUA (PERSONAL & OTHERS) */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 hover:border-purple-400 shadow-sm' : 'bg-slate-900 border-2 border-slate-800 hover:border-purple-500/70 shadow-xl'} p-6 rounded-3xl space-y-3 transition duration-300 group flex flex-col justify-between`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-purple-600/15 text-purple-500 flex items-center justify-center border border-purple-400/40 text-xl font-black group-hover:scale-105 transition-transform">
                    🎁
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${eyeComfortMode ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-950 text-purple-300 border-purple-800'} border`}>
                    Personal & Events
                  </span>
                </div>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900 group-hover:text-purple-700' : 'text-white group-hover:text-purple-300'} transition`}>
                  5. Mimal & Chhungkua
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Inneih lawmpuina (Wedding gift envelope), anniversary, piancham thilpek, damlo kan, leh chhungkaw thilpek sum pekna awlsam. Custom invitation card emaw WhatsApp-ah QR code share nghal zung zung theih.' 
                    : 'Digital monetary gifts for weddings, anniversaries, birthdays, and personal hospital visitations. Easy custom QR sharing on wedding invitation cards or WhatsApp.'}
                </p>
                <ul className={`mt-3 space-y-1.5 text-[11px] ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" /> Digital Envelope & Wishing Note
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" /> Wedding QR for Invitation Cards
                  </li>
                  <li className="flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-purple-500 shrink-0" /> Direct Bank Account Credit
                  </li>
                </ul>
              </div>

              <div className={`pt-4 border-t ${eyeComfortMode ? 'border-slate-150' : 'border-slate-800/80'} space-y-2`}>
                <button
                  type="button"
                  onClick={() => onLaunchApp('explorer', 'others')}
                  className={`w-full ${eyeComfortMode ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200' : 'bg-purple-950 hover:bg-purple-900 text-purple-200 border-purple-800'} border font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <span>{isMizo ? 'Mimal Bawm En Rawh' : 'Explore Mimal Bawm'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManualActiveKey('mimal');
                    setManualModalOpen(true);
                  }}
                  className={`w-full ${eyeComfortMode ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'} border font-semibold text-[11px] py-2 rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer`}
                >
                  <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                  <span>{isMizo ? '📖 Hman Dan / User Manual' : '📖 User Guide & Steps'}</span>
                </button>
              </div>
            </div>

            {/* Quick Action Box: Create QR in 2 Minutes */}
            <div className={`${eyeComfortMode ? 'bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80 border-2 border-indigo-200 text-slate-900 shadow-sm' : 'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-2 border-indigo-700/60'} p-6 rounded-3xl space-y-4 flex flex-col justify-between`}>
              <div>
                <span className={`text-[10px] font-black uppercase ${eyeComfortMode ? 'text-indigo-700' : 'text-amber-400'} tracking-wider`}>
                  Quick Launch
                </span>
                <h3 className={`text-xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} mt-1`}>
                  {isMizo ? 'Bawm Thar Siam I Duh Em?' : 'Ready to Create Your Own Bawm?'}
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'I Kohhran emaw i pawl tan minute 2 chhungin QR Bawm thar i siam thei a. Bank account link la, print theih poster leh online payment receipt i nei nghal ang.' 
                    : 'Launch a branded collection QR in under 2 minutes for your local church, branch, or family. Includes print-ready posters and automated receipting.'}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onLaunchApp('create_qr')}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{isMizo ? 'QR Bawm Thar Siam Rawh' : 'Create Live QR Bawm'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLaunchApp('creator_reg')}
                  className={`w-full ${eyeComfortMode ? 'bg-white hover:bg-slate-50 text-indigo-900 border-slate-200 shadow-xs' : 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-slate-700'} font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 border transition cursor-pointer`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>{isMizo ? 'Kohhran / Pawl Register Rawh' : 'Register Organization'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* INTERACTIVE USER MANUAL TAB GUIDE SECTION (Option 2: Inline Quick Guide) */}
          <div className={`mt-10 p-6 sm:p-8 rounded-3xl border ${eyeComfortMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/90 border-slate-800 shadow-xl'} transition duration-300`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-lg">
                  📖
                </div>
                <div>
                  <h3 className={`text-lg sm:text-xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                    {isMizo ? 'RonPay Bawm Hman Dan Kaihhruaina (User Manual)' : 'RonPay Community Bawm User Manual'}
                  </h3>
                  <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-400'} mt-0.5`}>
                    {isMizo 
                      ? 'Bawm hrang hrang 4+1 te hman dan step-by-step a hnuaiah hian thlang la, fiah takin en rawh:' 
                      : 'Step-by-step operating guide for Treasurers, Donors, and Beneficiaries. Click each service tab:'}
                  </p>
                </div>
              </div>

              {/* View Full Manual Button */}
              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto ${
                  eyeComfortMode 
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200' 
                    : 'bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isMizo ? 'Manual Kimchang Pop-up-ah En Rawh' : 'Open Detailed Guide Modal'}</span>
              </button>
            </div>

            {/* Service Selection Tabs */}
            <div className="flex flex-wrap gap-2 pt-6">
              {(['ralna', 'kumtluang', 'khawlsak', 'rikrum', 'mimal'] as const).map((key) => {
                const item = SERVICE_MANUALS[key];
                const isSelected = manualActiveKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setManualActiveKey(key)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? eyeComfortMode
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : eyeComfortMode
                          ? 'bg-slate-100/90 text-slate-700 hover:bg-slate-200 border-slate-200'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name.split(' ')[0]} {item.name.split(' ')[1] || ''}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Service Active Steps & Guide */}
            <div className={`mt-6 p-5 sm:p-6 rounded-2xl border ${eyeComfortMode ? 'bg-slate-50 border-slate-200/90' : 'bg-slate-950/70 border-slate-800/80'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{activeManual.icon}</span>
                  <div>
                    <h4 className={`text-base font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                      {activeManual.name}
                    </h4>
                    <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      {activeManual.summary}
                    </p>
                  </div>
                </div>
                <span className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full ${eyeComfortMode ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-indigo-950 text-indigo-300 border border-indigo-800'}`}>
                  {activeManual.badge}
                </span>
              </div>

              {/* Steps Timeline Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeManual.steps.map((st) => (
                  <div 
                    key={st.step}
                    className={`p-4 rounded-xl border ${eyeComfortMode ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-900 border-slate-800'} space-y-2`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {st.step}
                      </span>
                      <h5 className={`text-xs font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                        {st.title}
                      </h5>
                    </div>
                    <p className={`text-[11px] leading-relaxed ${eyeComfortMode ? 'text-slate-600' : 'text-slate-400'}`}>
                      {st.desc}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bottom Direct CTA */}
              <div className="mt-5 pt-4 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{isMizo ? 'Heng process zawng zawng hi RonPay App chhungah rintlak taka kalpui theih vek a ni.' : 'All features are fully functional inside the RonPay App.'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onLaunchApp('explorer', manualActiveKey === 'mimal' ? 'others' : manualActiveKey)}
                  className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span>{isMizo ? `${activeManual.name.split(' ')[0]} Hmang Tan Rawh` : `Launch ${activeManual.name.split(' ')[0]}`}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 6. BBPS UTILITY BILLS & MOBILE TOPUP SECTION: PROMINENT & INTERACTIVE */}
      <section id="bbps" className={`py-16 sm:py-24 ${eyeComfortMode ? 'bg-[#f1f5f9]/70 border-y border-slate-200' : 'bg-gradient-to-b from-slate-950 via-slate-900/60 to-slate-950 border-y border-slate-800'} relative transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
            <span className={`inline-flex items-center gap-1.5 ${eyeComfortMode ? 'bg-indigo-100 text-indigo-900 border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40'} text-xs font-black px-3.5 py-1 rounded-full border uppercase tracking-wider`}>
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              Bharat Bill Payment System (BBPS)
            </span>
            <h2 className={`text-2xl sm:text-4xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} tracking-tight`}>
              {isMizo 
                ? 'BBPS Bill Hrang Hrang & Mobile Topup Pekna Hmunpui' 
                : 'Complete BBPS Utility Clearinghouse & Mobile Topup'}
            </h2>
            <p className={`text-sm sm:text-base ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
              {isMizo 
                ? 'EBill (Electric Bill), Water Bill (Tui Bill), FASTag Toll, School Fees, Municipal Taxes (AMC), leh Mobile Topup te awlsam leh fiah taka pek theihna hmun a ni tih tarlanna:' 
                : 'Pay all essential utility bills in Mizoram with instant online settlement and verified receipting: EBill, Water, FASTag, School & College fees, Municipal taxes, and Mobile Topup.'}
            </p>
          </div>

          {/* Interactive BBPS Utility Showcase Grid & Live Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left: Interactive Tab Buttons for BBPS Services */}
            <div className="lg:col-span-6 space-y-3">
              <div className={`text-xs font-black uppercase ${eyeComfortMode ? 'text-indigo-900' : 'text-indigo-400'} tracking-wider mb-2`}>
                {isMizo ? 'Bill Service Thlang Rawh:' : 'Select Utility Bill Service:'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {BBPS_UTILITIES.map((service) => {
                  const IconComp = service.icon;
                  const isSelected = selectedBbpsKey === service.id;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedBbpsKey(service.id);
                        if (service.id === 'ebill') {
                          setBbpsInputVal('102938475');
                          setBbpsSimResult({ consumerName: 'Lalramchhana (Bungkawn Veng)', amount: 1420, dueDate: '15th of this month' });
                        } else if (service.id === 'water') {
                          setBbpsInputVal('AZL-98421');
                          setBbpsSimResult({ consumerName: 'Zothanpuii (Mission Veng)', amount: 480, dueDate: '20th of this month' });
                        } else if (service.id === 'fastag') {
                          setBbpsInputVal('MZ-01-X-4321');
                          setBbpsSimResult({ consumerName: 'H. Lalmalsawma (Scorpio-N)', amount: 1000, dueDate: 'Active Tag' });
                        } else if (service.id === 'school_fees') {
                          setBbpsInputVal('PUC-2026-442');
                          setBbpsSimResult({ consumerName: 'Lalrinzuala (PUC Semester 4)', amount: 3500, dueDate: 'Exam Fee Due' });
                        } else if (service.id === 'municipal_taxes') {
                          setBbpsInputVal('AMC-PR-8831');
                          setBbpsSimResult({ consumerName: 'K. Lalchhandama (Dawrpui Commercial)', amount: 850, dueDate: 'Annual Assessment' });
                        } else if (service.id === 'mobile_topup') {
                          setBbpsInputVal('9862899001');
                          setBbpsSimResult({ consumerName: 'Jio 5G 28 Days Unlimited', amount: 299, dueDate: 'Validity Extension' });
                        } else {
                          setBbpsInputVal('SUB-774921');
                          setBbpsSimResult({ consumerName: 'Tata Play HD Annual', amount: 950, dueDate: 'Subscription Due' });
                        }
                      }}
                      className={`p-3.5 rounded-2xl text-left transition flex items-center justify-between gap-3 border cursor-pointer ${
                        isSelected 
                          ? eyeComfortMode
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                            : 'bg-indigo-950/80 border-amber-400 text-white shadow-lg shadow-indigo-950/50 scale-[1.02]' 
                          : eyeComfortMode
                            ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${service.accentBg}`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-black truncate ${isSelected && eyeComfortMode ? 'text-white' : eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
                            {service.name}
                          </div>
                          <div className={`text-[10px] truncate ${isSelected && eyeComfortMode ? 'text-indigo-100' : eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {service.provider}
                          </div>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase shrink-0 ${
                        isSelected 
                          ? eyeComfortMode ? 'bg-amber-300 text-slate-950 font-black' : 'bg-amber-400 text-slate-950 font-black' 
                          : eyeComfortMode ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {service.tag}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Note on Zero Hidden Fees */}
              <div className={`p-3 ${eyeComfortMode ? 'bg-white border-slate-200 text-slate-600 shadow-xs' : 'bg-slate-900/60 border-slate-800/80 text-slate-400'} border rounded-2xl flex items-center gap-2 text-xs`}>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  {isMizo 
                    ? 'BBPS Bill pekna-ah hian extra charge lak a ni lo. Direct NPCI & RBI approved network kaltlanga pek a ni.' 
                    : 'Zero surcharge on BBPS utility bill clearing. Fully backed by NPCI & RBI guidelines.'}
                </span>
              </div>
            </div>

            {/* Right: Live Interactive Bill Preview Card */}
            <div className={`lg:col-span-6 ${eyeComfortMode ? 'bg-white border-2 border-indigo-200 shadow-md' : 'bg-slate-900 border-2 border-indigo-800/80 shadow-2xl'} rounded-3xl p-6 sm:p-7 space-y-5 relative overflow-hidden`}>
              
              <div className={`flex items-center justify-between border-b ${eyeComfortMode ? 'border-slate-150' : 'border-slate-800'} pb-4`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentBbps.accentBg}`}>
                    {React.createElement(currentBbps.icon, { className: "w-5 h-5" })}
                  </div>
                  <div>
                    <h4 className={`text-base font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>{currentBbps.name}</h4>
                    <p className={`text-xs ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>{currentBbps.provider}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase ${eyeComfortMode ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950 text-emerald-300 border-emerald-800'}`}>
                  BBPS LIVE
                </span>
              </div>

              <div className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
                {currentBbps.description}
              </div>

              {/* Input Box Preview */}
              <div className="space-y-1.5">
                <label className={`text-xs font-bold ${eyeComfortMode ? 'text-slate-700' : 'text-slate-400'} flex items-center justify-between`}>
                  <span>{isMizo ? 'Consumer / Account Number:' : 'Consumer / Account Number:'}</span>
                  <span className={`text-[10.5px] font-medium ${eyeComfortMode ? 'text-indigo-600' : 'text-amber-300'}`}>{currentBbps.placeholder}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bbpsInputVal}
                    onChange={(e) => setBbpsInputVal(e.target.value)}
                    className={`flex-1 ${eyeComfortMode ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-600' : 'bg-slate-950 border-slate-700 text-white focus:border-amber-400'} border rounded-xl px-3.5 py-2.5 text-xs font-mono outline-hidden`}
                    placeholder={currentBbps.placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBbpsSimResult({
                        consumerName: 'Verified Account Holder',
                        amount: Math.floor(Math.random() * 2000) + 300,
                        dueDate: '25th of this month'
                      });
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition cursor-pointer shrink-0"
                  >
                    Fetch Bill
                  </button>
                </div>
              </div>

              {/* Bill Details Result Box */}
              {bbpsSimResult && (
                <div className={`${eyeComfortMode ? 'bg-indigo-50/60 border-indigo-200 text-slate-900' : 'bg-slate-950 border-indigo-900/60'} p-4 rounded-2xl border space-y-2 animate-fadeIn`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={eyeComfortMode ? 'text-slate-600' : 'text-slate-400'}>{isMizo ? 'Consumer Hming:' : 'Consumer Name:'}</span>
                    <span className={`font-bold ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>{bbpsSimResult.consumerName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={eyeComfortMode ? 'text-slate-600' : 'text-slate-400'}>{isMizo ? 'Due Date:' : 'Due Date:'}</span>
                    <span className={`font-mono ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>{bbpsSimResult.dueDate}</span>
                  </div>
                  <div className={`flex items-center justify-between pt-2 border-t ${eyeComfortMode ? 'border-indigo-200/80' : 'border-slate-800'}`}>
                    <span className={`text-xs font-bold ${eyeComfortMode ? 'text-slate-700' : 'text-slate-300'}`}>{isMizo ? 'Pek Tur Zat:' : 'Bill Amount:'}</span>
                    <span className={`text-xl font-black ${eyeComfortMode ? 'text-indigo-950' : 'text-amber-400'}`}>₹{bbpsSimResult.amount}</span>
                  </div>
                </div>
              )}

              {/* Launch App to Pay Bill */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => onLaunchApp('home')}
                  className="w-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
                >
                  <CreditCard className="w-4 h-4 text-slate-950" />
                  <span>{isMizo ? `RonPay App-ah ${currentBbps.name} Pe Rawh` : `Pay ${currentBbps.name} in App`}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <p className={`text-[10px] text-center ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isMizo 
                    ? 'Default in Khualmi (Guest User) angin a lut nghal ang a, login kher ngai lovin bill a pek theih e.' 
                    : 'Launches seamlessly as Guest User (Khualmi) without requiring account creation.'}
                </p>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 7. BIAKPAWNA (CONTACT) & AICHAT (RONPAY KHUAL CHHAWN) SECTION */}
      <section id="contact" className={`py-16 sm:py-24 ${eyeComfortMode ? 'bg-[#f8fafc] border-t border-slate-200' : 'bg-gradient-to-br from-purple-950/70 via-indigo-950/80 to-slate-950 border-t border-indigo-900/60'} relative transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <span className={`inline-flex items-center gap-1.5 ${eyeComfortMode ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'} text-xs font-black px-3.5 py-1 rounded-full border uppercase tracking-wider`}>
              <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
              {isMizo ? 'Biakpawhna & Khual Chhawn' : 'Contact & AI Reception'}
            </span>
            <h2 className={`text-2xl sm:text-4xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} tracking-tight`}>
              {isMizo ? 'Kan Hnenah Zawhna I Nei Em? Min Lo Be Pawh Rawh' : 'Get in Touch with RonPay Support & AI Greeter'}
            </h2>
            <p className={`text-sm sm:text-base ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed`}>
              {isMizo 
                ? 'RonPay Khual Chhawn (AI Chat) biain zawhna zawt la, emaw kan official email ronpay.adm@gmail.com leh WhatsApp hmangin min be pawh rawh le.' 
                : 'Interact with AIChat (RonPay Khual chhawn) for instant answers, or reach us directly via ronpay.adm@gmail.com and WhatsApp.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: AIChat (RonPay Khual chhawn) */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-indigo-200 shadow-sm hover:border-indigo-400' : 'bg-slate-900/90 border-2 border-indigo-600/70 shadow-xl hover:border-amber-400'} p-6 rounded-3xl space-y-4 flex flex-col justify-between group transition`}>
              <div>
                <div className={`w-12 h-12 rounded-2xl ${eyeComfortMode ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'} flex items-center justify-center border mb-3 group-hover:scale-110 transition-transform`}>
                  <Bot className={`w-6 h-6 ${eyeComfortMode ? 'text-indigo-600' : 'text-amber-300'}`} />
                </div>
                <span className={`text-[10px] font-black uppercase ${eyeComfortMode ? 'text-indigo-600' : 'text-amber-400'} tracking-wider`}>
                  Mizo AI Assistant
                </span>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} mt-1`}>
                  AIChat (RonPay Khual chhawn)
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'PhonePe nen kan thawhdun dan, Bawm 5 hman dan, BBPS bill pek dan, leh www.ronpay.app/app luh dan Mizo tawng ngeia zawt rawh le.' 
                    : 'Ask instant conversational questions about PhonePe partnership, 5 Bawm suites, BBPS utilities, and how to access the app.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAIChatOpen(true)}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isMizo ? 'Khual Chhawn Biakna Hawng Rawh' : 'Open AI Khual Chhawn'}</span>
              </button>
            </div>

            {/* Card 2: Official Email (ronpay.adm@gmail.com) */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 shadow-sm hover:border-purple-300' : 'bg-slate-900/90 border-2 border-slate-800 shadow-xl hover:border-purple-500/70'} p-6 rounded-3xl space-y-4 flex flex-col justify-between group transition`}>
              <div>
                <div className={`w-12 h-12 rounded-2xl ${eyeComfortMode ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-600/20 text-purple-300 border-purple-500/40'} flex items-center justify-center border mb-3 group-hover:scale-110 transition-transform`}>
                  <Mail className="w-6 h-6 text-purple-500" />
                </div>
                <span className={`text-[10px] font-black uppercase ${eyeComfortMode ? 'text-purple-600' : 'text-purple-400'} tracking-wider`}>
                  Official Email Support
                </span>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} mt-1`}>
                  ronpay.adm@gmail.com
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Kohhran, pawl register emaw technical support mamawh tan email hmangin engtik lai pawhin kan inhawng e.' 
                    : 'Official email correspondence for organization onboarding, partnership queries, and technical support.'}
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard('ronpay.adm@gmail.com', 'email')}
                  className={`w-full ${eyeComfortMode ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200' : 'bg-slate-800 hover:bg-slate-750 text-white border-slate-700'} font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 border transition cursor-pointer`}
                >
                  {emailCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600 font-black">Email Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className={`w-4 h-4 ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'}`} />
                      <span>Copy Email (ronpay.adm@gmail.com)</span>
                    </>
                  )}
                </button>

                <a
                  href="mailto:ronpay.adm@gmail.com?subject=RonPay%20Inquiry"
                  className={`w-full ${eyeComfortMode ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200' : 'bg-purple-950 hover:bg-purple-900 text-purple-200 border-purple-800/80'} font-bold text-xs py-2 rounded-xl flex items-center justify-center gap-1.5 border transition cursor-pointer`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Send Mail</span>
                </a>
              </div>
            </div>

            {/* Card 3: WhatsApp Helpdesk */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 shadow-sm hover:border-emerald-300' : 'bg-slate-900/90 border-2 border-slate-800 shadow-xl hover:border-emerald-500/70'} p-6 rounded-3xl space-y-4 flex flex-col justify-between group transition`}>
              <div>
                <div className={`w-12 h-12 rounded-2xl ${eyeComfortMode ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'} flex items-center justify-center border mb-3 group-hover:scale-110 transition-transform`}>
                  <Phone className="w-6 h-6 text-emerald-500" />
                </div>
                <span className={`text-[10px] font-black uppercase ${eyeComfortMode ? 'text-emerald-700' : 'text-emerald-400'} tracking-wider`}>
                  Live WhatsApp Helpline
                </span>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} mt-1`}>
                  +91 7005153902
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'WhatsApp Helpdesk kaltlangin darkar 24 chhungin puihna i dawng nghal thei a, setup kan lo pui vek dawn che nia.' 
                    : 'Fast-response WhatsApp community desk ready to assist with live Bawm setup and queries.'}
                </p>
              </div>

              <a
                href="https://wa.me/917005153902?text=RonPay%20chungchang%20ka%20hrechiang%20duh%20e"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp-ah Be Rawh</span>
              </a>
            </div>

            {/* Card 4: Office Address & Mizoram Hub */}
            <div className={`${eyeComfortMode ? 'bg-white border-2 border-slate-200 shadow-sm hover:border-amber-300' : 'bg-slate-900/90 border-2 border-slate-800 shadow-xl hover:border-amber-500/70'} p-6 rounded-3xl space-y-4 flex flex-col justify-between group transition`}>
              <div>
                <div className={`w-12 h-12 rounded-2xl ${eyeComfortMode ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-600/20 text-amber-300 border-amber-500/40'} flex items-center justify-center border mb-3 group-hover:scale-110 transition-transform`}>
                  <MapPin className="w-6 h-6 text-amber-500" />
                </div>
                <span className={`text-[10px] font-black uppercase ${eyeComfortMode ? 'text-amber-700' : 'text-amber-400'} tracking-wider`}>
                  Office Location
                </span>
                <h3 className={`text-lg font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} mt-1`}>
                  Bethel Computer Centre
                </h3>
                <p className={`text-xs ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} leading-relaxed mt-2`}>
                  {isMizo 
                    ? 'Lunglei & Aizawl, Mizoram. Khawtlang leh Kohhran tana FinTech hmanrua thar siamtu.' 
                    : 'Bethel Computer Centre, Lunglei & Aizawl, Mizoram. Driving community fintech innovation across the state.'}
                </p>
              </div>

              <div className={`p-2.5 ${eyeComfortMode ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-950 border-slate-800 text-slate-400'} rounded-xl border text-[11px] flex items-center gap-2`}>
                <Building className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Lunglei / Aizawl, Mizoram - 796701</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 8. DEDICATED APP LINK (www.ronpay.app/app) SHOWCASE CALLOUT */}
      <section className={`py-14 sm:py-16 ${eyeComfortMode ? 'bg-amber-50/50 border-y border-amber-200/80' : 'bg-slate-900/40 border-y border-slate-800/80'} transition-colors`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className={`inline-flex items-center gap-1.5 ${eyeComfortMode ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-amber-500/15 border-amber-400/30 text-amber-300'} px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border`}>
            <Globe className="w-3.5 h-3.5" />
            Direct Web App Access
          </div>

          <h2 className={`text-2xl sm:text-4xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'}`}>
            {isMizo ? 'RonPay App Chu www.ronpay.app/app Ah A Awm E' : 'Access RonPay App Directly at www.ronpay.app/app'}
          </h2>

          <p className={`text-sm sm:text-base ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'} max-w-2xl mx-auto`}>
            {isMizo 
              ? 'App Store emaw Play Store atanga download kher a ngai lo! Browser atangin a lut nghal zung zung theih a, default in Khualmi (Guest User) angin i lut nghal ang.' 
              : 'Zero app store friction. Open immediately in any mobile or desktop web browser with automatic Guest User (Khualmi) access.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <div className={`flex items-center gap-2 ${eyeComfortMode ? 'bg-white border-2 border-amber-400 text-amber-900 shadow-sm' : 'bg-slate-950 border-2 border-amber-400/80 text-amber-300 shadow-xl'} px-4 py-3 rounded-2xl font-mono font-black text-sm sm:text-base`}>
              <span>https://www.ronpay.app/app</span>
              <button
                type="button"
                onClick={() => copyToClipboard('https://www.ronpay.app/app', 'applink')}
                className={`p-1 ${eyeComfortMode ? 'hover:text-amber-600 text-slate-700' : 'hover:text-white text-slate-300'} transition cursor-pointer`}
                title="Copy App URL"
              >
                {appLinkCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => onLaunchApp('home')}
              className="bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 text-slate-950 font-black text-sm px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>{isMizo ? 'App Lut Rawh (Khualmi)' : 'Launch App as Guest'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 9. FREQUENTLY ASKED QUESTIONS (FAQ) */}
      <section id="faq" className={`py-16 sm:py-24 ${eyeComfortMode ? 'bg-white' : ''}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="text-center space-y-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${eyeComfortMode ? 'text-indigo-700' : 'text-indigo-400'}`}>
              {isMizo ? 'Zawhna Tlanglawn' : 'Got Questions?'}
            </span>
            <h2 className={`text-2xl sm:text-4xl font-black ${eyeComfortMode ? 'text-slate-900' : 'text-white'} tracking-tight`}>
              {isMizo ? 'Zawhna & Chhanna Tlangpui' : 'Frequently Asked Questions'}
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: isMizo 
                  ? '1. PhonePe nen hian engtin nge in thawh dun?' 
                  : '1. How does RonPay partner with PhonePe?',
                a: isMizo 
                  ? 'RonPay hi PhonePe Technology Service Provider (TSP) leh PG V2 architecture hmangin kan inzawm a. Donors-ten UPI hmanga an pek rualin sum chu 100% direct-in kohhran emaw pawl bank account-ah a lut nghal zel a, RonPay-in escrow-ah sum a vawng rih ve ngai lo.' 
                  : 'RonPay is integrated with PhonePe PG V2 and TSP infrastructure. All payments settle directly into your organization bank account via IMPS with 0% escrow holding.'
              },
              {
                q: isMizo 
                  ? '2. App chhung ka luh hian eng role-ah nge ka awm dawn?' 
                  : '2. What is my role when I enter the RonPay App?',
                a: isMizo 
                  ? 'RonPay App (www.ronpay.app/app) i luh rualin default in "Khualmi (Guest User)" angin i lut nghal ang. Login kher ngai lovin QR i scan thei a, Bawm i browse thei a, BBPS bill (Electric, Tui, Fastag, etc.) i pe thei nghal vek a ni.' 
                  : 'You are automatically welcomed as Guest User (Khualmi). You can immediately scan QRs, browse all 5 Bawms, and pay BBPS bills without creating an account.'
              },
              {
                q: isMizo 
                  ? '3. BBPS bill (EBill, Tui Bill, Fastag, School Fees, Municipal Taxes) hi a pek theih em?' 
                  : '3. Are BBPS utility bills and mobile topups supported?',
                a: isMizo 
                  ? 'Aw, theih chiang e! Power & Electricity Department Electric Bill, PHED Tui Bill, NHAI FASTag recharge, School & College Fees, AMC Municipal Taxes, leh Mobile Topup (Jio, Airtel, Vi, BSNL) te second 5 chhungin a pek theih vek e.' 
                  : 'Yes! Fully supports EBill (P&ED Mizoram), Water (PHED), FASTag, School & College Fees, Municipal Taxes (AMC), and Mobile Topup with instant receipts.'
              },
              {
                q: isMizo 
                  ? '4. Bawm hrang hrang 5-te hi engte nge?' 
                  : '4. What are the 5 core RonPay Bawm services?',
                a: isMizo 
                  ? '1. Ralna Bawm (Chhiatni & YMA pual), 2. Kumtluang Bawm (Kohhran & Pawl thawhlawm chhungkaw bu), 3. Khawlsak Bawm (Biak In & Hall sakna), 4. Rikrum Bawm (Kangmei & emergency tanpuina free), leh 5. Mimal & Chhungkua (Wedding & personal gifts).' 
                  : '1. Ralna (Condolences), 2. Kumtluang (Church & NGO family rolls), 3. Khawlsak (Building projects), 4. Rikrum (Emergency relief), and 5. Mimal (Personal & wedding gifts).'
              },
              {
                q: isMizo 
                  ? '5. AIChat (RonPay Khual chhawn) hi engtin nge ka biak ang?' 
                  : '5. How can I chat with AIChat (RonPay Khual chhawn)?',
                a: isMizo 
                  ? 'Biakpawhna section-a "Khual Chhawn Biakna Hawng Rawh" tih hmet la, emaw screen dinglam hnuai a widget hi hmet rawh. Mizo tawng ngeiin eng zawhna pawh a chhang thei che a ni.' 
                  : 'Click the "Open AI Khual Chhawn" button or floating widget to chat in Mizo or English anytime!'
              }
            ].map((faq, idx) => (
              <div 
                key={idx} 
                className={`${eyeComfortMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900 border-slate-800'} border rounded-2xl overflow-hidden transition`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className={`w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 text-sm sm:text-base font-black ${eyeComfortMode ? 'text-slate-900 hover:text-indigo-700' : 'text-white hover:text-amber-300'} transition cursor-pointer`}
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${activeFaq === idx ? (eyeComfortMode ? 'rotate-180 text-indigo-600' : 'rotate-180 text-amber-400') : (eyeComfortMode ? 'text-slate-400' : 'text-slate-400')}`} />
                </button>
                {activeFaq === idx && (
                  <div className={`px-4 sm:px-5 pb-5 text-xs sm:text-sm ${eyeComfortMode ? 'text-slate-600 border-slate-200' : 'text-slate-300 border-slate-800/80'} leading-relaxed border-t pt-3`}>
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* 10. AICHAT (RONPAY KHUAL CHHAWN) FLOATING DRAWER / MODAL */}
      {isAIChatOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <div className={`${eyeComfortMode ? 'bg-white border-2 border-indigo-200 text-slate-900' : 'bg-slate-900 border border-indigo-700/80 text-white'} w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[620px] transition-colors`}>
            
            {/* Chat Header */}
            <div className={`${eyeComfortMode ? 'bg-indigo-600 text-white border-b border-indigo-700' : 'bg-slate-950 px-4 py-3.5 border-b border-slate-800 text-white'} px-4 py-3.5 flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl ${eyeComfortMode ? 'bg-white/20 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'} flex items-center justify-center font-black shadow-xs`}>
                  <Bot className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-sm font-black flex items-center gap-1.5">
                    <span>AIChat (RonPay Khual Chhawn)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  </div>
                  <div className={`text-[10px] ${eyeComfortMode ? 'text-indigo-100' : 'text-slate-400'}`}>
                    PhonePe & BBPS Verified AI Assistant
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playSoundboxDemo(chatMessages[chatMessages.length - 1]?.text)}
                  className={`p-1.5 ${eyeComfortMode ? 'bg-indigo-700 hover:bg-indigo-800 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300'} rounded-lg transition cursor-pointer`}
                  title="Speak Response in Mizo"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAIChatOpen(false)}
                  className={`p-1.5 ${eyeComfortMode ? 'bg-indigo-700 hover:bg-indigo-800 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'} rounded-lg transition cursor-pointer`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages Body */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${eyeComfortMode ? 'bg-slate-50' : 'bg-slate-950/60'}`}>
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? eyeComfortMode
                          ? 'bg-indigo-600 text-white font-bold rounded-br-none shadow-sm'
                          : 'bg-amber-400 text-slate-950 font-bold rounded-br-none shadow-md'
                        : eyeComfortMode
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  <span className={`text-[9px] ${eyeComfortMode ? 'text-slate-400' : 'text-slate-500'} mt-1 px-1`}>{msg.time}</span>
                </div>
              ))}

              {isChatLoading && (
                <div className={`flex items-center gap-2 text-xs ${eyeComfortMode ? 'text-indigo-900 bg-white border-indigo-200' : 'text-indigo-300 bg-slate-900 border-slate-800'} border rounded-2xl px-3 py-2 w-fit shadow-xs`}>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
                  <span>RonPay Khual Chhawn a ngaihtuah mek e...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Chips */}
            <div className={`${eyeComfortMode ? 'bg-slate-100 border-t border-slate-200' : 'bg-slate-950 border-t border-slate-800/80'} px-3 py-2 overflow-x-auto no-scrollbar`}>
              <div className="flex gap-1.5 min-w-max text-[10px]">
                {[
                  'PhonePe nen engtin nge in thawhdun?',
                  'Bawm 5-te hi engte nge?',
                  'EBill leh Tui Bill pek dan',
                  'Khualmi (Guest User) angin luh dan',
                  'www.ronpay.app/app ah engte nge awm?'
                ].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChatMessage(chip)}
                    className={`${eyeComfortMode ? 'bg-white hover:bg-indigo-50 text-indigo-800 border-slate-200 shadow-xs' : 'bg-slate-900 hover:bg-slate-800 text-indigo-300 border-slate-800'} border px-2.5 py-1 rounded-full whitespace-nowrap cursor-pointer transition`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Input Field */}
            <div className={`p-3 ${eyeComfortMode ? 'bg-white border-t border-slate-200' : 'bg-slate-950 border-t border-slate-800'} flex items-center gap-2`}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendChatMessage();
                }}
                placeholder={isMizo ? 'Mizo tawngin zawhna zawt rawh le...' : 'Type a question in Mizo or English...'}
                className={`flex-1 ${eyeComfortMode ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-600' : 'bg-slate-900 border-slate-700 text-white placeholder-slate-500 focus:border-amber-400'} border rounded-xl px-3.5 py-2.5 text-xs outline-hidden`}
              />
              <button
                type="button"
                onClick={() => handleSendChatMessage()}
                disabled={!chatInput.trim() || isChatLoading}
                className={`${eyeComfortMode ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-amber-400 hover:bg-amber-300 text-slate-950'} disabled:opacity-40 p-2.5 rounded-xl transition cursor-pointer shrink-0 font-bold`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* USER MANUAL MODAL (Option 1: Interactive Popup Dialog) */}
      {manualModalOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="manual-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
            eyeComfortMode ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            {/* Modal Header */}
            <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
              eyeComfortMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs">
                  📖
                </div>
                <div>
                  <h3 id="manual-modal-title" className="text-base sm:text-lg font-black tracking-tight">
                    {isMizo ? 'RonPay Services - Hman Dan Kaihhruaina' : 'RonPay Community Services - User Manual'}
                  </h3>
                  <p className={`text-[11px] ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {isMizo ? 'A hnuaia service hrang hrangte hi thlang la, hman dan en rawh' : 'Select any service tab below to review operations'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  eyeComfortMode 
                    ? 'hover:bg-slate-200 text-slate-600 border-slate-300' 
                    : 'hover:bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Service Filter Tabs */}
            <div className={`px-4 sm:px-5 py-3 border-b flex items-center gap-1.5 overflow-x-auto ${
              eyeComfortMode ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/50 border-slate-800'
            }`}>
              {(['ralna', 'kumtluang', 'khawlsak', 'rikrum', 'mimal'] as const).map((key) => {
                const item = SERVICE_MANUALS[key];
                const isSelected = manualActiveKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setManualActiveKey(key)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
                      isSelected
                        ? eyeComfortMode
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : eyeComfortMode
                          ? 'bg-white text-slate-700 hover:bg-slate-200/80 border-slate-300'
                          : 'bg-slate-850 text-slate-300 hover:bg-slate-800 border-slate-700'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.name.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body - Scrollable */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Service Summary Card */}
              <div className={`p-4 rounded-2xl border ${
                eyeComfortMode ? 'bg-indigo-50/50 border-indigo-100' : 'bg-indigo-950/30 border-indigo-900/50'
              } flex items-start gap-3`}>
                <span className="text-2xl sm:text-3xl shrink-0">{activeManual.icon}</span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm sm:text-base font-black">
                      {activeManual.name}
                    </h4>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      eyeComfortMode ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-900 text-indigo-200'
                    }`}>
                      {activeManual.badge}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'}`}>
                    {activeManual.summary}
                  </p>
                </div>
              </div>

              {/* Step By Step Guide List */}
              <div className="space-y-3">
                <h5 className={`text-xs font-black uppercase tracking-wider ${eyeComfortMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {isMizo ? 'Hman Dan Kalhmang (Step-by-Step Instructions):' : 'Operating Steps & Protocol:'}
                </h5>

                {activeManual.steps.map((st) => (
                  <div 
                    key={st.step}
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      eyeComfortMode ? 'bg-slate-50 border-slate-200/80' : 'bg-slate-850/70 border-slate-800'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {st.step}
                    </div>
                    <div className="space-y-0.5">
                      <h6 className="text-xs font-bold">
                        {st.title}
                      </h6>
                      <p className={`text-[11px] leading-relaxed ${eyeComfortMode ? 'text-slate-600' : 'text-slate-300'}`}>
                        {st.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Helpful Tips */}
              <div className={`p-3.5 rounded-xl border text-[11px] ${
                eyeComfortMode ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/40 border-amber-900 text-amber-200'
              } flex items-start gap-2.5`}>
                <span className="text-sm">💡</span>
                <p>
                  {isMizo 
                    ? 'Tip: RonPay App chhungah hian Mizo ṭawng leh English-in zawn awlsam takin a awm a, PhonePe / UPI hmangin sum lut leh chhuak engkim live-in a lang nghal zel e.'
                    : 'Tip: Available in both Mizo and English. All collections route directly through PhonePe and NPCI bank channels with live receipting.'}
                </p>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className={`p-4 border-t flex items-center justify-between gap-3 ${
              eyeComfortMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  eyeComfortMode 
                    ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300' 
                    : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {isMizo ? 'Khar Rawh' : 'Close'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setManualModalOpen(false);
                  onLaunchApp('explorer', manualActiveKey === 'mimal' ? 'others' : manualActiveKey);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <span>{isMizo ? `${activeManual.name.split(' ')[0]} Hmang Tan Rawh` : `Open ${activeManual.name.split(' ')[0]}`}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating AIChat Action Button (Bottom Right) */}
      <button
        type="button"
        onClick={() => setIsAIChatOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border-2 border-white/20 cursor-pointer"
        title="AIChat (RonPay Khual Chhawn)"
      >
        <Bot className="w-5 h-5 text-amber-300 animate-bounce" />
        <span className="hidden sm:inline text-xs font-black">AIChat (Khual Chhawn)</span>
      </button>

      {/* Floating Scroll to Top Action Button (Smooth Scroll to Header) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          id="website-scroll-to-top-btn"
          className={`fixed bottom-20 right-5 z-40 p-3 sm:px-3.5 sm:py-2.5 rounded-full shadow-2xl transition-all duration-300 flex items-center gap-1.5 cursor-pointer border ${
            eyeComfortMode
              ? 'bg-white/95 hover:bg-amber-50 text-slate-800 border-amber-400/60 shadow-amber-900/10'
              : 'bg-slate-900/95 hover:bg-slate-800 text-white border-amber-500/50 shadow-black/40'
          } hover:-translate-y-1 active:scale-95 group backdrop-blur-md`}
          title={isMizo ? 'A chunglamah chhohna (Scroll to Top)' : 'Back to top'}
          aria-label="Scroll to top"
        >
          <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
            <ArrowUp className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-black tracking-tight">
            {isMizo ? 'A Chungah' : 'Top'}
          </span>
        </button>
      )}

      {/* 11. FOOTER: Professional FinTech Branding & Information */}
      <footer className={`${eyeComfortMode ? 'bg-slate-900 border-t border-slate-800 text-slate-400' : 'bg-slate-950 border-t border-slate-900 text-slate-400'} py-12 text-xs transition-colors`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Brand */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                  <img 
                    src="/ronpay-logo.png" 
                    alt="RonPay Logo" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-lg font-black text-white">
                  Ron<span className="text-orange-500">Pay</span>
                </span>
                <span className="bg-purple-900/50 text-purple-300 text-[8px] font-bold px-2 py-0.5 rounded-full border border-purple-700/50 uppercase">
                  PhonePe TSP
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                {isMizo 
                  ? 'Digital payment company lian ber PhonePe partner • Mizoram Kohhran & BBPS Platform' 
                  : "Mizoram's premier digital community bawm platform in partnership with PhonePe"}
              </p>
              <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1">
                <span>Email: <strong className="text-slate-200">ronpay.adm@gmail.com</strong></span>
                <span>•</span>
                <span>App Link: <strong className="text-amber-300 font-mono">www.ronpay.app/app</strong></span>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
              <a href="#hero" className="hover:text-white transition">{isMizo ? 'Kawtchhuah' : 'Home'}</a>
              <a href="#phonepe" className="hover:text-purple-300 transition">PhonePe Thawhdun</a>
              <a href="#services" className="hover:text-white transition">{isMizo ? 'Bawm 5' : '5 Bawms'}</a>
              <a href="#bbps" className="hover:text-amber-300 transition">BBPS Bills</a>
              <a href="#contact" className="hover:text-emerald-400 transition">{isMizo ? 'Biakpawhna' : 'Contact'}</a>
              <button 
                type="button" 
                onClick={() => onLaunchApp('home')} 
                className="text-amber-400 hover:text-amber-300 font-black cursor-pointer"
              >
                {isMizo ? 'App Lut Rawh (Khualmi) →' : 'Launch App →'}
              </button>
              <button
                type="button"
                onClick={scrollToTop}
                id="footer-quick-back-to-top"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 font-bold transition cursor-pointer shadow-xs active:scale-95"
                title={isMizo ? 'A chunglamah chhohna' : 'Scroll to top'}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>{isMizo ? 'A Chunglamah Chhohna ↑' : 'Back to Top ↑'}</span>
              </button>
            </div>

          </div>

          {/* Payment Gateway (PG) Compliance, RBI Norms & Mandatory Policies Bar */}
          <div className="pt-6 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  PG & Legal Policies:
                </span>
                <span className="text-slate-600">|</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-slate-400">
                <button
                  type="button"
                  onClick={() => {
                    setComplianceInitialTab('terms');
                    setComplianceModalOpen(true);
                  }}
                  className="hover:text-amber-300 transition cursor-pointer text-left"
                >
                  {isMizo ? 'Hman Dan Dan (Terms of Service)' : 'Terms of Service'}
                </button>
                <span className="text-slate-700">•</span>

                <button
                  type="button"
                  onClick={() => {
                    setComplianceInitialTab('privacy');
                    setComplianceModalOpen(true);
                  }}
                  className="hover:text-amber-300 transition cursor-pointer text-left"
                >
                  {isMizo ? 'Mimal Thuthang (Privacy Policy)' : 'Privacy Policy'}
                </button>
                <span className="text-slate-700">•</span>

                <button
                  type="button"
                  onClick={() => {
                    setComplianceInitialTab('refund');
                    setComplianceModalOpen(true);
                  }}
                  className="hover:text-amber-300 transition cursor-pointer text-left"
                >
                  {isMizo ? 'Pawisa Kirleh Dan (Refund & Cancellation)' : 'Refund & Cancellation Policy'}
                </button>
                <span className="text-slate-700">•</span>

                <button
                  type="button"
                  onClick={() => {
                    setComplianceInitialTab('grievance');
                    setComplianceModalOpen(true);
                  }}
                  className="hover:text-amber-300 transition cursor-pointer text-left"
                >
                  {isMizo ? 'Grievance Officer & Office' : 'Grievance Redressal'}
                </button>
                <span className="text-slate-700">•</span>

                <button
                  type="button"
                  onClick={() => {
                    setComplianceInitialTab('architecture');
                    setComplianceModalOpen(true);
                  }}
                  className="text-indigo-400 hover:text-indigo-300 font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isMizo ? 'PG Audit & Merchant Kalphung' : 'Merchant Architecture (PG Audit)'}</span>
                </button>
                <span className="text-slate-700">•</span>

                <button
                  type="button"
                  onClick={() => {
                    setComplianceInitialTab('sandbox');
                    setComplianceModalOpen(true);
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <span>⚙️ {isMizo ? 'PG Switch & Test Keys' : 'PG Switch & Sandbox'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Copyright line as strictly mandated */}
          <div className="pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
            <div>
              Developed & Maintained by © 2026 RonPay Technologies. All rights reserved.
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                PhonePe TSP Live • All Systems Operational
              </span>
              <span>•</span>
              <button
                type="button"
                onClick={scrollToTop}
                id="footer-bottom-scroll-top-btn"
                className="hover:text-amber-300 text-slate-300 transition cursor-pointer flex items-center gap-1 font-semibold hover:underline"
              >
                <ArrowUp className="w-3 h-3 text-amber-400" />
                <span>{isMizo ? 'Chunglamah Chhohna' : 'Back to Top'}</span>
              </button>
              <span>•</span>
              <span className="text-slate-400">NPCI / BBPS Protocol</span>
            </div>
          </div>

        </div>
      </footer>

      {/* Payment Gateway Compliance & Policies Modal */}
      <PGComplianceModal
        isOpen={complianceModalOpen}
        onClose={() => setComplianceModalOpen(false)}
        initialTab={complianceInitialTab}
        userLanguage={lang}
      />

    </div>
  );
};
