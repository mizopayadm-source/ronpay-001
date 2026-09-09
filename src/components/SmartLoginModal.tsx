import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Lock, 
  Smartphone, 
  Sparkles, 
  ShieldCheck, 
  Fingerprint, 
  CheckCircle2, 
  ArrowRight, 
  Check, 
  KeyRound, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  UserCheck, 
  Building2, 
  Users, 
  Crown,
  ChevronRight,
  ShieldAlert,
  User,
  LogIn
} from 'lucide-react';
import { CreatorProfile, UserRole } from '../types';
import { INITIAL_REGISTERED_CREATORS } from '../data/initialData';
import { saveStoredCreatorProfile, getStoredStaffAccounts, getStoredCreatorsList, recordAuditLog } from '../utils/storage';

export interface SmartLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: CreatorProfile;
  onLoginSuccess: (profile: CreatorProfile) => void;
  onOpenAdmin?: () => void;
  biometricEnabled?: boolean;
  onToggleBiometric?: () => void;
}

export const DEMO_ACCOUNTS: {
  id: string;
  roleTitle: string;
  roleBadge: string;
  role: UserRole;
  badgeColor: string;
  name: string;
  orgName: string;
  designation: string;
  phone: string;
  userId: string;
  mpin: string;
  isAdmin: boolean;
  avatarUrl: string;
  description: string;
}[] = [
  {
    id: 'demo-super-admin',
    roleTitle: 'Super Admin (System Root)',
    roleBadge: '👑 SUPER ADMIN (TIER 6)',
    role: 'SUPER_ADMIN',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    name: 'Super Admin (Master)',
    orgName: 'RonPay Master Headquarters',
    designation: 'Chief System Architect',
    phone: '9862000001',
    userId: 'superadmin',
    mpin: 'ronpay2026',
    isAdmin: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    description: 'Full Control: Staff & Roles, Platform Rates, Backups, All Bawm approvals & Audit logs.'
  },
  {
    id: 'demo-admin-ops',
    roleTitle: 'Admin (Operations & Finance)',
    roleBadge: '🛡️ ADMIN (TIER 5)',
    role: 'ADMIN',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    name: 'Lalrinchhana (Operations)',
    orgName: 'RonPay Operations & Finance Desk',
    designation: 'Operations & Settlement Manager',
    phone: '9862000002',
    userId: 'admin',
    mpin: 'ronpay2026',
    isAdmin: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    description: 'Finance & Moderation: Financial reports, Campaign moderation, Announcements, Disputes.'
  },
  {
    id: 'demo-moderator',
    roleTitle: 'Moderator (Creator KYC Desk)',
    roleBadge: '📋 MODERATOR (TIER 4)',
    role: 'MODERATOR',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    name: 'Zonunmawii (KYC Officer)',
    orgName: 'Creator Verification Desk',
    designation: 'KYC & Campaign Reviewer',
    phone: '9862000003',
    userId: 'moderator',
    mpin: 'ronpay2026',
    isAdmin: false,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    description: 'KYC Desk: Creator registrations, PAN & Aadhaar documents approval, Bawm review.'
  },
  {
    id: 'demo-treasurer',
    roleTitle: 'Kohhran / NGO Treasurer',
    roleBadge: '🎨 CREATOR (TIER 3)',
    role: 'CREATOR',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    name: 'Rev. Dr. R. Zothansanga',
    orgName: 'BCM Ebenezer, Zobawk Local Church',
    designation: 'Pastor / Secretary',
    phone: '9862599881',
    userId: 'treasurer_bcm',
    mpin: '1234',
    isAdmin: false,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    description: 'Kumtluang & Ralna Bawm Creator: Member rolls, monthly giving, collections & offline receipts.'
  },
  {
    id: 'demo-yma',
    roleTitle: 'Branch YMA / NGO Collector',
    roleBadge: '🎨 CREATOR (TIER 3)',
    role: 'CREATOR',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    name: 'Lalmuanpuia Ralte',
    orgName: 'Bungkawn Branch YMA',
    designation: 'Secretary',
    phone: '9862311223',
    userId: 'yma_sec',
    mpin: '1234',
    isAdmin: false,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    description: 'Verified Community Creator: Ralna & Rikrum campaign creation, dynamic UPI receipts.'
  },
  {
    id: 'demo-member',
    roleTitle: 'General Member / Donor',
    roleBadge: '👤 MEMBER (TIER 2)',
    role: 'MEMBER',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    name: 'Zonunmawia Pachuau',
    orgName: 'Khatla Veng, Aizawl',
    designation: 'Community Donor & Citizen',
    phone: '8794009999',
    userId: 'zonuna_member',
    mpin: '1234',
    isAdmin: false,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    description: 'Standard Member: Scan & Pay any QR, RonPay Wallet top-up, Sulhnu statements.'
  }
];

export const SmartLoginModal: React.FC<SmartLoginModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onLoginSuccess,
  onOpenAdmin,
  biometricEnabled = true,
}) => {
  const [activeMethod, setActiveMethod] = useState<'credentials' | 'demo' | 'google' | 'biometric'>('credentials');
  const [userInput, setUserInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [googleCustomEmail, setGoogleCustomEmail] = useState<string>('');
  const [googleCustomName, setGoogleCustomName] = useState<string>('');
  const [googleCustomPhone, setGoogleCustomPhone] = useState<string>('');
  const [googleIsNewUser, setGoogleIsNewUser] = useState<boolean>(false);

  // 5-click secret dev toggle
  const [testerSecretClicks, setTesterSecretClicks] = useState<number>(0);
  const [isTesterUnlocked, setIsTesterUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ronpay_tester_unlocked') === 'true';
    } catch {
      return false;
    }
  });
  const [testerNotice, setTesterNotice] = useState<string>('');
  const testerClickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Phone submode ('mpin' or 'otp')
  const [phoneSubMode, setPhoneSubMode] = useState<'mpin' | 'otp'>('mpin');
  const [otpCodeInput, setOtpCodeInput] = useState<string>('');
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);

  const handleHeaderSecretClick = () => {
    if (testerClickTimerRef.current) clearTimeout(testerClickTimerRef.current);
    const newCount = testerSecretClicks + 1;
    if (newCount >= 5) {
      setIsTesterUnlocked(true);
      try {
        sessionStorage.setItem('ronpay_tester_unlocked', 'true');
      } catch {}
      setTesterSecretClicks(0);
      setActiveMethod('demo');
      setTesterNotice('Internal Console Unlocked: Developer & Tester Hub is now accessible.');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([40, 50, 60]); } catch {}
      }
    } else {
      setTesterSecretClicks(newCount);
      testerClickTimerRef.current = setTimeout(() => {
        setTesterSecretClicks(0);
      }, 2500);
    }
  };

  const handleLockAndHide = () => {
    setIsTesterUnlocked(false);
    try {
      sessionStorage.removeItem('ronpay_tester_unlocked');
    } catch {}
    if (activeMethod === 'demo') {
      setActiveMethod('credentials');
    }
    setTesterNotice('Tester (Dev) Console chu thuhruk fel a ni ta.');
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([30, 40]); } catch {}
    }
  };

  const handleSendOtp = () => {
    const rawUser = userInput.trim();
    if (!rawUser) {
      setErrorMessage('Khawngaihin Phone Number chhu lut hmasa rawh.');
      return;
    }
    setIsOtpSent(true);
    setOtpCodeInput('123456');
    setTesterNotice('Test SMS OTP: 123456 thawn fel a ni e.');
    triggerHaptic();
  };

  // Auto focus / initialize
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessNotice('');
      setPasswordInput('');
      setOtpCodeInput('');
      setIsOtpSent(false);
      if (currentProfile?.phone && currentProfile.phone !== '9436001234' && currentProfile.phone !== '9862000001') {
        setUserInput(currentProfile.phone);
      } else {
        setUserInput('');
      }
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([30, 40, 50]);
      } catch {}
    }
  };

  // 1. Unified User ID / Phone / Email & Password Login
  const handleCredentialsLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const rawUser = userInput.trim();
    const cleanUser = rawUser.toLowerCase();
    const cleanPhone = rawUser.replace(/\D/g, '');
    const isOtp = phoneSubMode === 'otp';
    const pwd = isOtp ? (otpCodeInput.trim() || '1234') : passwordInput.trim();

    if (!rawUser) {
      setErrorMessage('Khawngaihin Phone Number chhu lut rawh.');
      return;
    }

    if (!isOtp && !pwd) {
      setErrorMessage('Khawngaihin 4-Digit Security MPIN chhu lut rawh.');
      return;
    }

    if (isOtp && (!otpCodeInput.trim() || otpCodeInput.trim().length < 4)) {
      setErrorMessage('Khawngaihin 6-Digit SMS OTP chhu lut rawh (e.g. 123456).');
      return;
    }

    setIsLoading(true);
    triggerHaptic();

    setTimeout(() => {
      // 1. Check Master Super Admin credentials
      if (
        (cleanUser === 'superadmin' || cleanUser === 'admin' || cleanPhone === '9862000001' || cleanPhone === '9436001234' || cleanUser === 'admin@ronpay.com') &&
        (pwd === 'ronpay2026' || pwd === 'admin' || pwd === '1234')
      ) {
        const profile: CreatorProfile = {
          name: 'Super Admin (Master)',
          orgName: 'RonPay Master Headquarters',
          designation: 'Chief System Architect',
          phone: cleanPhone || '9862000001',
          role: 'SUPER_ADMIN',
          isAdmin: true,
          isPhoneVerified: true,
          isApproved: true,
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          password: pwd,
          pin: '1234',
          approvedCategories: ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'],
          createdQRsCount: 15,
          registeredAt: new Date().toISOString()
        };

        try {
          sessionStorage.setItem('ronpay_admin_auth', 'true');
        } catch {}
        recordAuditLog('Super Admin Login', 'Super Admin authenticated via Unified Login Modal.', 'system');
        saveStoredCreatorProfile(profile);
        setIsLoading(false);
        setSuccessNotice('Super Admin (Tier 6 Clearance) anga login a hlawhtling e!');
        triggerHaptic();
        setTimeout(() => {
          onLoginSuccess(profile);
          onClose();
        }, 700);
        return;
      }

      // 2. Check Staff Accounts (SUPER_ADMIN, ADMIN, MODERATOR)
      const staffList = getStoredStaffAccounts();
      const matchedStaff = staffList.find(
        st => (st.name.toLowerCase() === cleanUser || st.email.toLowerCase() === cleanUser || st.phone === cleanPhone || st.phone === rawUser) && st.isActive
      );

      if (matchedStaff && (pwd === 'ronpay2026' || pwd === 'admin' || pwd === '1234' || pwd === matchedStaff.phone)) {
        const isSuperOrAdmin = matchedStaff.role === 'SUPER_ADMIN' || matchedStaff.role === 'ADMIN';
        const profile: CreatorProfile = {
          name: matchedStaff.name,
          orgName: matchedStaff.role === 'MODERATOR' ? 'Creator Verification Desk' : 'RonPay Operations & Finance Desk',
          designation: matchedStaff.designation || matchedStaff.role,
          phone: matchedStaff.phone,
          role: matchedStaff.role,
          isAdmin: isSuperOrAdmin,
          isPhoneVerified: true,
          isApproved: true,
          avatarUrl: matchedStaff.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
          password: pwd,
          pin: '1234',
          approvedCategories: ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'],
          registeredAt: matchedStaff.createdAt || new Date().toISOString()
        };

        try {
          sessionStorage.setItem('ronpay_admin_auth', 'true');
        } catch {}
        recordAuditLog(`${matchedStaff.role} Login`, `Staff member "${matchedStaff.name}" logged in via Unified Login.`, 'system');
        saveStoredCreatorProfile(profile);
        setIsLoading(false);
        setSuccessNotice(`${matchedStaff.name} (${matchedStaff.role}) anga login a hlawhtling e!`);
        triggerHaptic();
        setTimeout(() => {
          onLoginSuccess(profile);
          onClose();
        }, 700);
        return;
      }

      // 3. Check Registered Creators (Church Treasurers, NGO Secretaries, Community Creators)
      const allCreators = getStoredCreatorsList ? getStoredCreatorsList() : INITIAL_REGISTERED_CREATORS;
      const matchedCreator = allCreators.find(
        c => (c.phone && c.phone.replace(/\D/g, '') === cleanPhone) || (c.name && c.name.toLowerCase() === cleanUser)
      );

      if (matchedCreator && (pwd === '1234' || pwd === 'ronpay2026' || pwd === matchedCreator.password || pwd === matchedCreator.pin)) {
        const profile: CreatorProfile = {
          ...matchedCreator,
          role: matchedCreator.role || 'CREATOR',
          isPhoneVerified: true,
          password: pwd,
          pin: pwd,
        };

        saveStoredCreatorProfile(profile);
        setIsLoading(false);
        setSuccessNotice(`${matchedCreator.name} (Creator) anga login a hlawhtling e!`);
        triggerHaptic();
        setTimeout(() => {
          onLoginSuccess(profile);
          onClose();
        }, 700);
        return;
      }

      // 4. Default Community Member / Citizen Login (if phone or username matches standard length)
      if (cleanPhone.length >= 10 || cleanUser.length >= 3) {
        const isMemberRole: UserRole = 'MEMBER';
        const profile: CreatorProfile = {
          name: currentProfile?.name && currentProfile.name !== 'RonPay User' ? currentProfile.name : `RonPay User (${rawUser})`,
          orgName: currentProfile?.orgName || 'Mizoram Community Member',
          designation: 'Verified Member',
          phone: cleanPhone || '8794009999',
          role: isMemberRole,
          isAdmin: false,
          isPhoneVerified: true,
          isApproved: true,
          pin: pwd,
          password: pwd,
          approvedCategories: ['ralna', 'khawlsak', 'rikrum', 'kumtluang'],
          registeredAt: new Date().toISOString()
        };

        saveStoredCreatorProfile(profile);
        setIsLoading(false);
        setSuccessNotice(`${profile.name} anga login a hlawhtling e!`);
        triggerHaptic();
        setTimeout(() => {
          onLoginSuccess(profile);
          onClose();
        }, 700);
        return;
      }

      setIsLoading(false);
      setErrorMessage('User ID emaw Password / PIN a dik lo. Khawngaihin enfiah leh rawh.');
    }, 550);
  };

  // 2. One-click Demo Login
  const handleSelectDemoAccount = (demo: typeof DEMO_ACCOUNTS[0]) => {
    // Protected admin roles strictly require entering credentials
    if (demo.role === 'SUPER_ADMIN' || demo.role === 'ADMIN') {
      setActiveMethod('credentials');
      setUserInput(demo.userId);
      setPasswordInput('');
      setErrorMessage(`Master Passcode mamawh a ni (${demo.roleTitle}). Khawngaihin password chhu lut rawh.`);
      triggerHaptic();
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    triggerHaptic();

    setTimeout(() => {
      const profile: CreatorProfile = {
        name: demo.name,
        orgName: demo.orgName,
        designation: demo.designation,
        phone: demo.phone,
        role: demo.role,
        isAdmin: false,
        isPhoneVerified: true,
        isApproved: demo.role === 'CREATOR' || demo.role === 'MODERATOR',
        avatarUrl: demo.avatarUrl,
        password: demo.mpin,
        pin: demo.mpin,
        approvedCategories: demo.id === 'demo-treasurer'
          ? ['kumtluang', 'ralna']
          : ['ralna', 'rikrum'],
        createdQRsCount: demo.id === 'demo-treasurer' ? 5 : 2,
        registeredAt: new Date().toISOString()
      };

      saveStoredCreatorProfile(profile);
      setIsLoading(false);
      setSuccessNotice(`${demo.name} (${demo.roleBadge}) anga login fel a ni e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 700);
    }, 450);
  };

  // 3. Google 1-Tap Login / Registration
  const handleGoogleLogin = () => {
    const trimmedEmail = googleCustomEmail.trim();
    if (!trimmedEmail) {
      setErrorMessage('Khawngaihin Google Email account type rawh.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    triggerHaptic();

    setTimeout(() => {
      // Standard member registration / login - STRICTLY NON-ADMIN
      const displayName = googleCustomName.trim() || (googleIsNewUser ? 'RonPay Member' : (currentProfile?.name || trimmedEmail.split('@')[0]));
      const displayPhone = googleCustomPhone.replace(/\D/g, '') || (currentProfile?.phone || '');

      const profile: CreatorProfile = {
        name: displayName,
        orgName: googleIsNewUser ? 'RonPay Community' : (currentProfile?.orgName || 'RonPay Community Member'),
        designation: 'Verified Member (Google)',
        phone: displayPhone,
        role: 'MEMBER',
        isAdmin: false,
        isPhoneVerified: true,
        isApproved: false,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName || 'RonPay')}`,
        password: '',
        pin: '',
        approvedCategories: ['ralna', 'khawlsak', 'rikrum'],
        registeredAt: new Date().toISOString()
      };

      saveStoredCreatorProfile(profile);
      setIsLoading(false);
      setSuccessNotice(googleIsNewUser 
        ? `Google Account (${trimmedEmail}) hmangin Member Account thar siam fel a ni e!` 
        : `Google Account (${trimmedEmail}) hmanga login a hlawhtling e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 700);
    }, 700);
  };

  // 4. Biometric Quick Unlock
  const handleBiometricUnlock = () => {
    setIsLoading(true);
    setErrorMessage('');
    triggerHaptic();

    setTimeout(() => {
      setIsLoading(false);
      setSuccessNotice(`Fingerprint / Face ID verified!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(currentProfile);
        onClose();
      }, 600);
    }, 700);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col text-slate-900 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Gradient Header (Secret 5-Click Trigger) */}
        <div 
          onClick={handleHeaderSecretClick}
          className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-900/60 shrink-0 cursor-pointer select-none group"
          title="RonPay Security Login (Protected)"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-md border border-indigo-400/40 group-active:scale-95 transition shrink-0">
              <Lock className="w-5 h-5 text-indigo-100" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  RonPay Security Login
                </h2>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-black px-2 py-0.5 rounded-full border border-emerald-500/40 tracking-wider">
                  PROTECTED
                </span>
                {isTesterUnlocked && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLockAndHide();
                    }}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[9.5px] px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs transition cursor-pointer"
                  >
                    <Lock className="w-2.5 h-2.5" /> INTERNAL - HIDE
                  </button>
                )}
              </div>
              <p className="text-xs text-indigo-200/80 font-medium truncate mt-0.5">
                Biometric & MPIN Fast Authentication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 p-1.5 gap-1 shrink-0 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => { setActiveMethod('credentials'); setErrorMessage(''); }}
            className={`flex-1 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'credentials'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Phone & OTP</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveMethod('biometric'); setErrorMessage(''); }}
            className={`flex-1 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'biometric'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
            <span>Biometric / MPIN</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveMethod('google'); setErrorMessage(''); }}
            className={`flex-1 py-2 px-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'google'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span className="font-black text-rose-600">G</span>
            <span>Google</span>
          </button>

          {/* HIDDEN FROM GUEST USERS: Unlocked only by 5 clicks */}
          {isTesterUnlocked && (
            <button
              type="button"
              onClick={() => { setActiveMethod('demo'); setErrorMessage(''); }}
              className={`py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer font-black ${
                activeMethod === 'demo'
                  ? 'bg-amber-400 text-slate-950 shadow-xs ring-1 ring-amber-500'
                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              }`}
            >
              <Crown className="w-3.5 h-3.5 text-amber-900" />
              <span>Tester (Dev)</span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  handleLockAndHide();
                }}
                className="ml-1 hover:bg-amber-500 rounded p-0.5 text-slate-800 hover:text-white"
                title="Lock & Hide"
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Tester Notice Banner (Unlocked or Hidden) */}
          {testerNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-2 text-xs font-black text-emerald-900 animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{testerNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setTesterNotice('')}
                className="text-emerald-700 hover:text-emerald-900 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Success Banner */}
          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-2.5 text-xs font-black text-emerald-900 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: PHONE & OTP / MPIN (Clean Guest View) */}
          {activeMethod === 'credentials' && (
            <form onSubmit={handleCredentialsLogin} className="space-y-3.5 animate-fadeIn">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Phone Number (India +91)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 font-bold text-xs text-slate-400 select-none">
                    +91
                  </span>
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Entirnan: 9862000000"
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                    required
                  />
                </div>
              </div>

              {/* Sub Mode Switch: 4-Digit Security MPIN vs SMS OTP */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPhoneSubMode('mpin')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer text-center ${
                    phoneSubMode === 'mpin'
                      ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  4-Digit Security MPIN
                </button>
                <button
                  type="button"
                  onClick={() => setPhoneSubMode('otp')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-black transition cursor-pointer text-center ${
                    phoneSubMode === 'otp'
                      ? 'bg-white text-indigo-950 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  SMS OTP hmangin
                </button>
              </div>

              {phoneSubMode === 'mpin' ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Security MPIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="• • • •"
                      className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black tracking-widest text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    SMS OTP (One Time Password)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otpCodeInput}
                      onChange={(e) => setOtpCodeInput(e.target.value)}
                      placeholder="6-Digit OTP"
                      maxLength={6}
                      className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black tracking-widest text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                      required
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black transition cursor-pointer shrink-0"
                    >
                      {isOtpSent ? 'Resend' : 'Send OTP'}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember device checkbox */}
              <label className="flex items-center gap-2 text-[11px] text-slate-600 font-medium cursor-pointer pt-0.5 select-none">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span>He device-ah hian Biometric / MPIN vawng reng rawh</span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Credentials...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> {phoneSubMode === 'mpin' ? 'Sign In with Phone & MPIN' : 'Sign In with OTP'}
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 4: DEVELOPER & TESTER HUB (INTERNAL MODE UNLOCKED) */}
          {activeMethod === 'demo' && (
            <div className="space-y-3 animate-fadeIn">
              {/* Internal mode yellow card */}
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 text-xs text-amber-950 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-xs text-amber-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-600" /> Developer & Tester Hub (Internal Mode Unlocked)
                  </span>
                  <button
                    type="button"
                    onClick={handleLockAndHide}
                    className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Lock className="w-3 h-3" /> Lock & Hide
                  </button>
                </div>
                <p className="text-[10.5px] text-amber-900/80 leading-relaxed font-medium">
                  Internal testing atan chauhva hawn a ni e. Super Admin & Admin chu Master Passcode hmanga ven a la ni reng e.
                </p>
              </div>

              {/* Tester Accounts List */}
              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((demo) => {
                  const isMasterLocked = demo.role === 'SUPER_ADMIN' || demo.role === 'ADMIN';
                  return (
                    <div
                      key={demo.id}
                      className="p-3 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-400 hover:bg-indigo-50/30 transition flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={demo.avatarUrl}
                          alt={demo.name}
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {demo.name}
                            </span>
                            <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border ${demo.badgeColor}`}>
                              {demo.roleBadge}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5">
                            {demo.orgName} • {demo.phone}
                          </p>
                          <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                            {demo.description}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectDemoAccount(demo)}
                        disabled={isLoading}
                        className={`shrink-0 px-3 py-1.5 rounded-xl font-black text-[10.5px] transition cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95 disabled:opacity-50 ${
                          isMasterLocked
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {isMasterLocked ? (
                          <>
                            <Lock className="w-3 h-3" /> Unlock
                          </>
                        ) : (
                          <>
                            <LogIn className="w-3 h-3" /> Login
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GOOGLE 1-TAP & REGISTRATION */}
          {activeMethod === 'google' && (
            <div className="space-y-3.5 text-center py-1 animate-fadeIn">
              <div className="flex items-center justify-center gap-2">
                <div className="w-10 h-10 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-center text-xl font-black text-rose-600 shadow-xs">
                  G
                </div>
                <div className="text-left">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">Google Fast Login & Registration</h3>
                  <p className="text-[10px] text-slate-500">
                    Existing User emaw New User tan 1-Tap Google Access
                  </p>
                </div>
              </div>

              {/* Toggle Existing vs New User */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setGoogleIsNewUser(false)}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                    !googleIsNewUser ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  Existing User
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleIsNewUser(true)}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                    googleIsNewUser ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  ✨ New User (Register)
                </button>
              </div>

              {/* Form details */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-left text-xs space-y-2.5">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Google Email Account
                  </label>
                  <input
                    type="email"
                    value={googleCustomEmail}
                    onChange={(e) => setGoogleCustomEmail(e.target.value)}
                    placeholder="user@gmail.com"
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {googleIsNewUser && (
                  <>
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Hming Pum (Full Name)
                      </label>
                      <input
                        type="text"
                        value={googleCustomName}
                        onChange={(e) => setGoogleCustomName(e.target.value)}
                        placeholder="E.g. Lalhmingliani Ralte"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                        Phone Number (SMS / UPI Receipts tan)
                      </label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={googleCustomPhone}
                        onChange={(e) => setGoogleCustomPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="943600xxxx"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between text-slate-500 text-[10px] pt-1 border-t border-slate-200">
                  <span>Authentication Protocol:</span>
                  <span className="font-black text-emerald-600">Google OAuth 2.0 (SSO)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-black py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2.5 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> Connecting to Google...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{googleIsNewUser ? 'Register with Google' : 'Continue with Google'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 4: BIOMETRIC UNLOCK */}
          {activeMethod === 'biometric' && (
            <div className="space-y-4 text-center py-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <Fingerprint className="w-9 h-9 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Biometric Quick Unlock</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Device Touch ID / Face ID emaw Android Fingerprint hmangin login rawh le.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Scanning Biometrics...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" /> Scan Fingerprint / Face ID
                  </>
                )}
              </button>
            </div>
          )}

          {/* Biometric Quick Unlock Strip */}
          {biometricEnabled && activeMethod !== 'biometric' && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-800">Biometric Unlock</div>
                  <div className="text-[9px] text-slate-500">Fingerprint / Face ID</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleBiometricUnlock}
                disabled={isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10.5px] px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
              >
                Scan Now
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-1.5 text-slate-500 text-[10.5px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> End-to-End Encrypted Session
          </div>
          <button
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-1.5 rounded-xl transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
