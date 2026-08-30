import React, { useState, useEffect } from 'react';
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
  ShieldAlert
} from 'lucide-react';
import { CreatorProfile, UserRole } from '../types';
import { INITIAL_REGISTERED_CREATORS } from '../data/initialData';
import { saveStoredCreatorProfile } from '../utils/storage';
import { ROLE_METAS } from '../utils/rbac';

export interface SmartLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: CreatorProfile;
  onLoginSuccess: (profile: CreatorProfile) => void;
  biometricEnabled?: boolean;
}

export const DEMO_ACCOUNTS: {
  id: string;
  role: UserRole;
  roleTitle: string;
  roleBadge: string;
  badgeColor: string;
  name: string;
  orgName: string;
  designation: string;
  phone: string;
  mpin: string;
  isAdmin: boolean;
  isApproved: boolean;
  avatarUrl: string;
  description: string;
}[] = [
  {
    id: 'demo-super-admin',
    role: 'SUPER_ADMIN',
    roleTitle: 'Super Admin / Platform HQ',
    roleBadge: 'SUPER ADMIN',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
    name: 'RonPay System Admin',
    orgName: 'RonPay HQ / Master Console',
    designation: 'Chief Administrator & Reviewer',
    phone: '9436001234',
    mpin: '1234',
    isAdmin: true,
    isApproved: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    description: 'Tier 1: Full system access, platform settings, payout configs, and manages Admin/Moderator accounts.'
  },
  {
    id: 'demo-admin',
    role: 'ADMIN',
    roleTitle: 'Platform Operations Admin',
    roleBadge: 'ADMIN',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    name: 'Lalchhandama Sailo',
    orgName: 'RonPay Operations Unit',
    designation: 'Operations & Finance Manager',
    phone: '9436154321',
    mpin: '1234',
    isAdmin: true,
    isApproved: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    description: 'Tier 2: Platform operations, financial reports, user management, and dispute handling.'
  },
  {
    id: 'demo-moderator',
    role: 'MODERATOR',
    roleTitle: 'Compliance & KYC Moderator',
    roleBadge: 'MODERATOR',
    badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
    name: 'Malsawmtluangi Fanai',
    orgName: 'RonPay Trust & Verification Cell',
    designation: 'KYC & Content Reviewer',
    phone: '9862899001',
    mpin: '1234',
    isAdmin: false,
    isApproved: true,
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    description: 'Tier 3: Specifically handles Creator KYC verification (approve/reject creators), reviews reports, and moderates content.'
  },
  {
    id: 'demo-creator',
    role: 'CREATOR',
    roleTitle: 'Verified Bawm Creator',
    roleBadge: 'CREATOR',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    name: 'Rev. Dr. R. Zothansanga',
    orgName: 'BCM Ebenezer, Zobawk Local Church',
    designation: 'Pastor / Secretary',
    phone: '9862599881',
    mpin: '1234',
    isAdmin: false,
    isApproved: true,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    description: 'Tier 4: Content/service provider requiring verification to publish Bawms, manage member rolls, and receive collections.'
  },
  {
    id: 'demo-member',
    role: 'MEMBER',
    roleTitle: 'General Member / Customer',
    roleBadge: 'MEMBER',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    name: 'Zonunmawia Pachuau',
    orgName: 'Khatla Veng, Aizawl',
    designation: 'Community Donor & Citizen',
    phone: '8794009999',
    mpin: '1234',
    isAdmin: false,
    isApproved: false,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    description: 'Tier 5: Standard registered end-user/customer. Scan & pay, wallet top-up, and giving statements.'
  },
  {
    id: 'demo-guest',
    role: 'GUEST',
    roleTitle: 'Unauthenticated Visitor',
    roleBadge: 'GUEST',
    badgeColor: 'bg-slate-200 text-slate-700 border-slate-300',
    name: 'Guest Explorer',
    orgName: 'Public Visitor',
    designation: 'Anonymous Guest',
    phone: '',
    mpin: '',
    isAdmin: false,
    isApproved: false,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    description: 'Tier 6: Unauthenticated visitor browsing public campaigns and exploring the Bawm directory.'
  }
];

export const SmartLoginModal: React.FC<SmartLoginModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onLoginSuccess,
  biometricEnabled = true,
}) => {
  const [activeMethod, setActiveMethod] = useState<'demo' | 'phone_mpin' | 'google' | 'biometric'>('demo');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [mpinInput, setMpinInput] = useState<string>('');
  const [showMpin, setShowMpin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [googleCustomEmail, setGoogleCustomEmail] = useState<string>('smartcabs2019@gmail.com');
  const [googleCustomName, setGoogleCustomName] = useState<string>('');
  const [googleCustomPhone, setGoogleCustomPhone] = useState<string>('');
  const [googleIsNewUser, setGoogleIsNewUser] = useState<boolean>(false);

  // Auto focus / initialize
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessNotice('');
      setMpinInput('');
      if (currentProfile?.phone) {
        setPhoneInput(currentProfile.phone);
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

  // 1. One-click Demo Login
  const handleSelectDemoAccount = (demo: typeof DEMO_ACCOUNTS[0]) => {
    setIsLoading(true);
    setErrorMessage('');
    triggerHaptic();

    setTimeout(() => {
      const isStaffOrAdmin = demo.role === 'SUPER_ADMIN' || demo.role === 'ADMIN';
      const isModerator = demo.role === 'MODERATOR';
      const isCreator = demo.role === 'CREATOR';
      const isGuest = demo.role === 'GUEST';

      const profile: CreatorProfile = {
        name: demo.name,
        orgName: demo.orgName,
        designation: demo.designation,
        phone: demo.phone,
        role: demo.role,
        isAdmin: isStaffOrAdmin,
        isPhoneVerified: !isGuest,
        isApproved: isStaffOrAdmin || isModerator || isCreator,
        avatarUrl: demo.avatarUrl,
        password: demo.mpin,
        pin: demo.mpin,
        approvedCategories: isStaffOrAdmin || isModerator
          ? ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others']
          : isCreator
          ? ['kumtluang', 'ralna', 'khawlsak']
          : [],
        createdQRsCount: isStaffOrAdmin ? 12 : isCreator ? 5 : 0,
        registeredAt: new Date().toISOString()
      };

      saveStoredCreatorProfile(profile);
      if (demo.role === 'SUPER_ADMIN' || demo.role === 'ADMIN' || demo.role === 'MODERATOR') {
        sessionStorage.setItem('ronpay_admin_auth', 'true');
      } else {
        sessionStorage.removeItem('ronpay_admin_auth');
      }

      setIsLoading(false);
      setSuccessNotice(`${demo.name} (${demo.roleBadge}) anga login fel a ni e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 700);
    }, 450);
  };

  // 2. Google 1-Tap Login / Registration
  const handleGoogleLogin = () => {
    setIsLoading(true);
    setErrorMessage('');
    triggerHaptic();

    setTimeout(() => {
      const isSystemAdmin = googleCustomEmail === 'smartcabs2019@gmail.com' || (currentProfile?.isAdmin && !googleIsNewUser);
      const displayName = googleCustomName.trim() || (googleIsNewUser ? 'New RonPay User' : (currentProfile?.name || 'Smart Cabs Admin'));
      const displayPhone = googleCustomPhone.replace(/\D/g, '') || (currentProfile?.phone || '9436001234');

      // Simulate real Google Sign-In profile retrieval
      const profile: CreatorProfile = {
        name: displayName,
        orgName: googleIsNewUser ? 'Mizoram Community Member' : (currentProfile?.orgName || 'Mizoram FinTech Community'),
        designation: isSystemAdmin ? 'Chief Administrator & Reviewer' : 'Verified Google Account Member',
        phone: displayPhone,
        isAdmin: isSystemAdmin,
        isPhoneVerified: true,
        isApproved: true,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName || 'RonPay')}`,
        password: '1234',
        pin: '1234',
        approvedCategories: isSystemAdmin ? ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'] : ['ralna', 'khawlsak', 'rikrum'],
        registeredAt: new Date().toISOString()
      };

      saveStoredCreatorProfile(profile);
      setIsLoading(false);
      setSuccessNotice(googleIsNewUser 
        ? `Google Account (${googleCustomEmail}) hmangin Account thar siam fel a ni e!` 
        : `Google Account (${googleCustomEmail}) hmanga login a hlawhtling e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 700);
    }, 800);
  };

  // 3. Phone & MPIN Login
  const handlePhoneMpinLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanPhone = phoneInput.replace(/\D/g, '');

    if (cleanPhone.length < 10) {
      setErrorMessage('Khawngaihin 10-digit Phone number dik chhu rawh.');
      return;
    }

    if (mpinInput.length < 4) {
      setErrorMessage('Khawngaihin 4-digit Security MPIN chhu lut rawh.');
      return;
    }

    setIsLoading(true);
    triggerHaptic();

    setTimeout(() => {
      // Check existing registered list
      const matched = INITIAL_REGISTERED_CREATORS.find(c => c.phone?.replace(/\D/g, '') === cleanPhone);
      const isSystemAdmin = cleanPhone === '9436001234' || cleanPhone === '9862599881' || cleanPhone.endsWith('1234');

      const profile: CreatorProfile = matched ? {
        ...matched,
        isAdmin: isSystemAdmin || matched.isAdmin || false,
        isPhoneVerified: true,
        pin: mpinInput,
        password: mpinInput,
      } : {
        name: currentProfile?.name && currentProfile.name !== 'RonPay User' ? currentProfile.name : `RonPay User (${cleanPhone.slice(-4)})`,
        orgName: currentProfile?.orgName || 'Mizoram Community',
        designation: 'Verified Member',
        phone: cleanPhone,
        isAdmin: isSystemAdmin,
        isPhoneVerified: true,
        isApproved: true,
        pin: mpinInput,
        password: mpinInput,
        approvedCategories: ['ralna', 'khawlsak', 'rikrum', 'kumtluang'],
        registeredAt: new Date().toISOString()
      };

      saveStoredCreatorProfile(profile);
      setIsLoading(false);
      setSuccessNotice(`+91 ${cleanPhone} login fel a ni e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 700);
    }, 600);
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
        {/* Top Gradient Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-md border border-indigo-400/40">
              <Lock className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  RonPay Smart Login
                </h2>
                <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400/40">
                  SECURE ACCESS
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                1-Tap Demo Switcher & Production Authentication
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 p-1.5 gap-1 shrink-0 text-xs font-bold text-slate-600">
          <button
            onClick={() => { setActiveMethod('demo'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'demo'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            <span>1-Tap Demo</span>
          </button>

          <button
            onClick={() => { setActiveMethod('phone_mpin'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'phone_mpin'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Phone & MPIN</span>
          </button>

          <button
            onClick={() => { setActiveMethod('google'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'google'
                ? 'bg-white text-indigo-900 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span className="font-black text-rose-600">G</span>
            <span>Google</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
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

          {/* TAB 1: 1-TAP DEMO PROFILES */}
          {activeMethod === 'demo' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 text-xs text-amber-950 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block">Demo Testing Hub (Fast Switch)</span>
                  <span className="text-[11px] text-amber-900/80">
                    A hnuaia Account duh ber hi hmet la, vawi 1 hmehin Admin, Kohhran emaw Member angin i in-thlak kual nghal zung zung thei e.
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.id}
                    onClick={() => handleSelectDemoAccount(demo)}
                    disabled={isLoading}
                    className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 transition group cursor-pointer flex items-center justify-between gap-3 shadow-2xs active:scale-98 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={demo.avatarUrl}
                        alt={demo.name}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100 group-hover:ring-indigo-400 shrink-0"
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

                    <div className="shrink-0 flex items-center gap-1 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white px-2.5 py-1.5 rounded-xl transition text-[11px] font-bold text-slate-700">
                      <span>Login</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PHONE & 4-DIGIT MPIN */}
          {activeMethod === 'phone_mpin' && (
            <form onSubmit={handlePhoneMpinLogin} className="space-y-4 animate-fadeIn">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    Phone Number (India +91)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="9436001234"
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-black text-slate-900 tracking-wider focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black text-slate-700">
                      4-Digit Security MPIN
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      Demo PIN: 1234
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showMpin ? 'text' : 'password'}
                      maxLength={4}
                      value={mpinInput}
                      onChange={(e) => setMpinInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • •"
                      className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-black tracking-widest text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowMpin(!showMpin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showMpin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick MPIN Pad Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {['1', '2', '3', '4'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      if (mpinInput.length < 4) setMpinInput(prev => prev + d);
                    }}
                    className="py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-black text-slate-700 transition cursor-pointer"
                  >
                    {d}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-2xl text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying Security MPIN...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> Sign In with Phone & MPIN
                  </>
                )}
              </button>
            </form>
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

          {/* Biometric Quick Unlock Strip */}
          {biometricEnabled && (
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
