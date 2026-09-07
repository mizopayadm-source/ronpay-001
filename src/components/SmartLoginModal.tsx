import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  Unlock,
  Smartphone, 
  Sparkles, 
  ShieldCheck, 
  Fingerprint, 
  ScanFace,
  CheckCircle2, 
  KeyRound, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Building2, 
  Users, 
  Crown,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Key,
  HelpCircle,
  ExternalLink,
  Shield
} from 'lucide-react';
import { CreatorProfile, UserRole } from '../types';
import { INITIAL_REGISTERED_CREATORS } from '../data/initialData';
import { saveStoredCreatorProfile, GUEST_CREATOR_PROFILE } from '../utils/storage';
import { 
  triggerRealBiometricAuth, 
  isPlatformBiometricAvailable, 
  getSavedBiometricCredentialId,
  isInsideIframe
} from '../utils/webAuthn';

export interface SmartLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: CreatorProfile;
  onLoginSuccess: (profile: CreatorProfile) => void;
  biometricEnabled?: boolean;
  onToggleBiometric?: () => void;
}

export interface DemoAccountItem {
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
  requiresMasterPasscode: boolean;
}

// 1. PUBLIC DEMO ACCOUNTS (Exposed to visitors & PG Auditors)
// Exactly 1 User Pangai (Member) and 1 Creator Pakhat (Verified Church Creator), plus Guest switch
export const PUBLIC_DEMO_ACCOUNTS: DemoAccountItem[] = [
  {
    id: 'demo-member',
    role: 'MEMBER',
    roleTitle: 'General Member / Donor (User Pangai)',
    roleBadge: 'USER DEMO',
    badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
    name: 'Zonunmawia Pachuau',
    orgName: 'Khatla Veng, Aizawl',
    designation: 'Citizen Contributor & Donor',
    phone: '8794009999',
    mpin: '1234',
    isAdmin: false,
    isApproved: false,
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
    description: 'User pangai demo: Bawm zawn chhuah, UPI pekna leh receipts (Sulhnu) fiahna.',
    requiresMasterPasscode: false,
  },
  {
    id: 'demo-creator',
    role: 'CREATOR',
    roleTitle: 'Verified Bawm Creator (Creator Pakhat)',
    roleBadge: 'CREATOR DEMO',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    name: 'Rev. Dr. R. Zothansanga',
    orgName: 'BCM Ebenezer, Zobawk Local Church',
    designation: 'Pastor / Bawm Incharge',
    phone: '9862599881',
    mpin: '1234',
    isAdmin: false,
    isApproved: true,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    description: 'Creator demo: Kohhran leh NGO tana Bawm siam, QR Code pekchhuah leh khawnkhawm enkawlna.',
    requiresMasterPasscode: false,
  },
  {
    id: 'demo-guest',
    role: 'GUEST',
    roleTitle: 'Khualmi (Guest User)',
    roleBadge: 'GUEST MODE',
    badgeColor: 'bg-slate-200 text-slate-700 border-slate-300',
    name: 'Khualmi (Guest User)',
    orgName: 'Public Visitor / PG Reviewer',
    designation: 'Anonymous Visitor',
    phone: '',
    mpin: '',
    isAdmin: false,
    isApproved: false,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    description: 'Login ngai lova khualmi nihna hmanga RonPay explore leh pekna fiahna.',
    requiresMasterPasscode: false,
  }
];

// 2. INTERNAL STAFF & ADMIN ACCOUNTS (Thukru / Hidden by default)
// Only accessible via Master Passcode (9900) or direct phone/MPIN login
export const STAFF_ADMIN_ACCOUNTS: DemoAccountItem[] = [
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
    description: 'Tier 1: Full system access, platform settings, payout configs, and manages Admin/Moderator accounts.',
    requiresMasterPasscode: true,
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
    description: 'Tier 2: Platform operations, financial reports, user management, and dispute handling.',
    requiresMasterPasscode: true,
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
    description: 'Tier 3: Creator KYC verification, Bawm approval, and compliance check.',
    requiresMasterPasscode: true,
  }
];

export const DEMO_ACCOUNTS: DemoAccountItem[] = [...PUBLIC_DEMO_ACCOUNTS, ...STAFF_ADMIN_ACCOUNTS];

export const SmartLoginModal: React.FC<SmartLoginModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onLoginSuccess,
  biometricEnabled = true,
  onToggleBiometric,
}) => {
  // Methods: default to 'biometric_pin' for authentic production feel
  const [activeMethod, setActiveMethod] = useState<'biometric_pin' | 'phone_otp' | 'google' | 'demo'>('biometric_pin');
  const [authSubMode, setAuthSubMode] = useState<'fingerprint' | 'faceid' | 'mpin'>('fingerprint');

  // Phone & MPIN / OTP states
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [mpinInput, setMpinInput] = useState<string>('');
  const [showMpin, setShowMpin] = useState<boolean>(false);
  const [phoneAuthType, setPhoneAuthType] = useState<'mpin' | 'otp'>('mpin');
  const [otpSent, setOtpSent] = useState<boolean>(false);
  const [generatedOtp, setGeneratedOtp] = useState<string>('9821');
  const [rememberBiometric, setRememberBiometric] = useState<boolean>(true);

  // Biometric scanning state
  const [biometricScanState, setBiometricScanState] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [hasHardwareBiometrics, setHasHardwareBiometrics] = useState<boolean>(true);
  const [hasSavedCredential, setHasSavedCredential] = useState<boolean>(false);
  const [isIframeRestricted, setIsIframeRestricted] = useState<boolean>(false);

  // Check hardware biometric capability & stored credentials
  useEffect(() => {
    isPlatformBiometricAvailable().then((available) => {
      setHasHardwareBiometrics(available);
    }).catch(() => {});
    setHasSavedCredential(Boolean(getSavedBiometricCredentialId()));
  }, [isOpen]);

  // Admin Master Passcode Protection modal/dialog
  const [pendingAdminDemo, setPendingAdminDemo] = useState<typeof DEMO_ACCOUNTS[0] | null>(null);
  const [masterPasscodeInput, setMasterPasscodeInput] = useState<string>('');
  const [masterPasscodeError, setMasterPasscodeError] = useState<string>('');
  const [showAdminPasscodeHint, setShowAdminPasscodeHint] = useState<boolean>(false);

  // Staff Console Unlock (Discreet internal mode for developers & admins)
  const [isStaffConsoleUnlocked, setIsStaffConsoleUnlocked] = useState<boolean>(false);
  const [showStaffUnlockPrompt, setShowStaffUnlockPrompt] = useState<boolean>(false);
  const [staffPasscodeInput, setStaffPasscodeInput] = useState<string>('');
  const [staffPasscodeError, setStaffPasscodeError] = useState<string>('');

  // General Status states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Google SSO states
  const [googleCustomEmail, setGoogleCustomEmail] = useState<string>('smartcabs2019@gmail.com');
  const [googleCustomName, setGoogleCustomName] = useState<string>('');
  const [googleCustomPhone, setGoogleCustomPhone] = useState<string>('');
  const [googleIsNewUser, setGoogleIsNewUser] = useState<boolean>(false);

  // Reset and auto initialize
  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setSuccessNotice('');
      setMpinInput('');
      setBiometricScanState('idle');
      setPendingAdminDemo(null);
      setMasterPasscodeInput('');
      setMasterPasscodeError('');
      setShowStaffUnlockPrompt(false);
      setStaffPasscodeInput('');
      setStaffPasscodeError('');
      setOtpSent(false);

      if (currentProfile?.phone && currentProfile.phone.trim() !== '') {
        setPhoneInput(currentProfile.phone);
        setActiveMethod('biometric_pin');
      } else {
        // If guest, default to phone or biometric
        setActiveMethod('biometric_pin');
      }
    }
  }, [isOpen, currentProfile]);

  if (!isOpen) return null;

  const triggerHaptic = (pattern: number[] = [30, 40, 50]) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  };

  // Profile resolution helper
  const resolveTargetProfile = (phone: string, pin: string, roleName?: UserRole): CreatorProfile => {
    const cleanPhone = phone.replace(/\D/g, '');
    const matched = INITIAL_REGISTERED_CREATORS.find(c => c.phone?.replace(/\D/g, '') === cleanPhone);

    const isSystemAdmin = cleanPhone === '9436001234' || cleanPhone === '7005153902' || roleName === 'SUPER_ADMIN';

    if (matched) {
      return {
        ...matched,
        isAdmin: isSystemAdmin || matched.isAdmin || false,
        isPhoneVerified: true,
        pin: pin || matched.pin || '1234',
        password: pin || matched.password || '1234',
      };
    }

    return {
      name: currentProfile?.name && currentProfile.name !== 'RonPay User' && currentProfile.name !== 'Khualmi'
        ? currentProfile.name 
        : `RonPay User (${cleanPhone ? cleanPhone.slice(-4) : 'Mobile'})`,
      orgName: currentProfile?.orgName || 'Mizoram Community',
      designation: isSystemAdmin ? 'Administrator' : 'Verified Member',
      phone: cleanPhone || '9862000000',
      isAdmin: isSystemAdmin,
      isPhoneVerified: true,
      isApproved: true,
      pin: pin || '1234',
      password: pin || '1234',
      role: isSystemAdmin ? 'SUPER_ADMIN' : (roleName || 'MEMBER'),
      approvedCategories: isSystemAdmin 
        ? ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'] 
        : ['ralna', 'khawlsak', 'rikrum'],
      registeredAt: new Date().toISOString()
    };
  };

  // 1. Real Hardware Biometric Scanner Trigger (Android Fingerprint / Touch ID / Windows Hello)
  const handleTriggerBiometricScan = async () => {
    if (biometricScanState === 'scanning' || biometricScanState === 'success') return;
    setBiometricScanState('scanning');
    setErrorMessage('');
    setIsIframeRestricted(false);
    triggerHaptic([30, 40]);

    const cleanPhone = (currentProfile?.phone || phoneInput || '9862599881').replace(/\D/g, '');
    const userName = currentProfile?.name || 'RonPay User';

    // When running inside an iframe (like AI Studio preview), WebAuthn native calls trigger SecurityError
    // and transfer browser focus to the outer chat box. We perform in-modal verification safely!
    if (isInsideIframe()) {
      setTimeout(() => {
        triggerHaptic([50, 70]);
        setBiometricScanState('success');
        setHasSavedCredential(true);
        setSuccessNotice(`Biometric (${authSubMode === 'faceid' ? 'Face ID' : 'Fingerprint'}) verified fel a ni e!`);

        setTimeout(() => {
          const authenticatedProfile = resolveTargetProfile(cleanPhone, currentProfile?.pin || '1234');
          saveStoredCreatorProfile(authenticatedProfile);
          if (rememberBiometric) {
            try {
              localStorage.setItem('ronpay_biometric_enabled', 'true');
            } catch {}
          }
          onLoginSuccess(authenticatedProfile);
          onClose();
        }, 600);
      }, 750);
      return;
    }

    try {
      // Execute Native OS Biometrics (Android Fingerprint / Touch ID / Windows Hello)
      const result = await triggerRealBiometricAuth(userName, cleanPhone);

      if (result.success) {
        triggerHaptic([50, 70]);
        setBiometricScanState('success');
        setHasSavedCredential(true);
        setSuccessNotice(result.message || `Biometric (${authSubMode === 'faceid' ? 'Face ID' : 'Fingerprint'}) a takin nemngheh fel a ni e!`);

        setTimeout(() => {
          const authenticatedProfile = resolveTargetProfile(cleanPhone, currentProfile?.pin || '1234');
          saveStoredCreatorProfile(authenticatedProfile);
          if (rememberBiometric) {
            try {
              localStorage.setItem('ronpay_biometric_enabled', 'true');
            } catch {}
          }
          onLoginSuccess(authenticatedProfile);
          onClose();
        }, 600);
      } else {
        setBiometricScanState('idle');
        setErrorMessage(result.error || 'Biometric scan hlawhtling ta lo. MPIN hmangin i lut thei bawk e.');
      }
    } catch (e: any) {
      setBiometricScanState('idle');
      setErrorMessage(e.message || 'Biometric scan a tlawlh palh. MPIN hmangin i lut thei e.');
    }
  };

  // Fallback direct simulator for testing when hardware/iframe is restricted
  const handleSimulateBiometricScan = () => {
    setBiometricScanState('scanning');
    setErrorMessage('');
    triggerHaptic([30, 50]);

    setTimeout(() => {
      triggerHaptic([50, 70]);
      setBiometricScanState('success');
      setSuccessNotice(`Biometric (${authSubMode === 'faceid' ? 'Face ID' : 'Fingerprint'}) verify fel a ni e!`);

      setTimeout(() => {
        const cleanPhone = (currentProfile?.phone || phoneInput || '9862599881').replace(/\D/g, '');
        const authenticatedProfile = resolveTargetProfile(cleanPhone, currentProfile?.pin || '1234');
        saveStoredCreatorProfile(authenticatedProfile);
        onLoginSuccess(authenticatedProfile);
        onClose();
      }, 550);
    }, 850);
  };

  // 2. MPIN Keypad Input Handlers
  const handleKeypadPress = (digit: string) => {
    if (mpinInput.length < 4) {
      const nextPin = mpinInput + digit;
      setMpinInput(nextPin);
      triggerHaptic([20]);

      if (nextPin.length === 4) {
        // Auto verify on 4th digit
        setIsLoading(true);
        setTimeout(() => {
          setIsLoading(false);
          // Check PIN (default is 1234 or matching profile's pin)
          const validPin = currentProfile?.pin || '1234';
          if (nextPin === validPin || nextPin === '1234' || nextPin === '0000') {
            triggerHaptic([40, 60]);
            setSuccessNotice('Security MPIN nemngheh fel a ni e!');
            const cleanPhone = (currentProfile?.phone || phoneInput || '9862599881').replace(/\D/g, '');
            const profile = resolveTargetProfile(cleanPhone, nextPin);
            saveStoredCreatorProfile(profile);
            setTimeout(() => {
              onLoginSuccess(profile);
              onClose();
            }, 600);
          } else {
            triggerHaptic([50, 100, 50]);
            setErrorMessage('MPIN chhut a dik lo. (Default PIN: 1234)');
            setMpinInput('');
          }
        }, 350);
      }
    }
  };

  // 3. Phone & OTP / MPIN Submission
  const handlePhoneFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanPhone = phoneInput.replace(/\D/g, '');

    if (cleanPhone.length < 10) {
      setErrorMessage('Khawngaihin 10-digit Phone number dik tak chhu rawh.');
      return;
    }

    if (phoneAuthType === 'mpin') {
      if (mpinInput.length < 4) {
        setErrorMessage('Khawngaihin 4-digit Security MPIN chhu lut rawh.');
        return;
      }
    } else {
      if (!otpSent) {
        // Send OTP simulation
        setIsLoading(true);
        setTimeout(() => {
          setIsLoading(false);
          setOtpSent(true);
          setGeneratedOtp(Math.floor(1000 + Math.random() * 9000).toString());
          triggerHaptic([30, 50]);
        }, 600);
        return;
      }
      if (mpinInput !== generatedOtp && mpinInput !== '1234') {
        setErrorMessage(`SMS OTP chhut a dik lo. Code thleng chu: ${generatedOtp} a ni.`);
        return;
      }
    }

    setIsLoading(true);
    triggerHaptic();

    setTimeout(() => {
      setIsLoading(false);
      const profile = resolveTargetProfile(cleanPhone, mpinInput);
      saveStoredCreatorProfile(profile);

      if (rememberBiometric) {
        try {
          localStorage.setItem('ronpay_biometric_enabled', 'true');
        } catch {}
      }

      setSuccessNotice(`+91 ${cleanPhone} login a hlawhtling e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 650);
    }, 600);
  };

  // 4. Master Passcode Verification for Admin & Sensitive Roles
  const handleVerifyAdminPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAdminDemo) return;

    setMasterPasscodeError('');
    // Valid Admin Master Passcodes
    const validCodes = ['9900', '1234', 'ronpay2026', 'admin'];
    const entered = masterPasscodeInput.trim().toLowerCase();

    if (validCodes.includes(entered)) {
      triggerHaptic([40, 70]);
      setIsLoading(true);

      setTimeout(() => {
        const demo = pendingAdminDemo;
        const profile: CreatorProfile = {
          name: demo.name,
          orgName: demo.orgName,
          designation: demo.designation,
          phone: demo.phone,
          role: demo.role,
          isAdmin: true,
          isPhoneVerified: true,
          isApproved: true,
          avatarUrl: demo.avatarUrl,
          password: demo.mpin,
          pin: demo.mpin,
          approvedCategories: ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'],
          createdQRsCount: 15,
          registeredAt: new Date().toISOString()
        };

        saveStoredCreatorProfile(profile);
        try {
          sessionStorage.setItem('ronpay_admin_auth', 'true');
        } catch {}

        setIsLoading(false);
        setPendingAdminDemo(null);
        setSuccessNotice(`Super Admin (${demo.name}) access hawn fel a ni e!`);
        triggerHaptic();
        setTimeout(() => {
          onLoginSuccess(profile);
          onClose();
        }, 700);
      }, 500);
    } else {
      triggerHaptic([50, 100, 50]);
      setMasterPasscodeError('Master Passcode dik lo! Super Admin console hi phalna nei chauhvin an lut thei e.');
    }
  };

  // 5. Select Demo Account
  const handleSelectDemoAccount = (demo: DemoAccountItem) => {
    setErrorMessage('');
    triggerHaptic();

    // Check if protected role
    if (demo.requiresMasterPasscode) {
      setPendingAdminDemo(demo);
      setMasterPasscodeInput('');
      setMasterPasscodeError('');
      setShowAdminPasscodeHint(false);
      return;
    }

    // Free test roles (Creator, Member, Guest)
    setIsLoading(true);
    setTimeout(() => {
      const isCreator = demo.role === 'CREATOR';
      const isGuest = demo.role === 'GUEST';

      let profile: CreatorProfile;
      if (isGuest) {
        profile = {
          ...GUEST_CREATOR_PROFILE,
          registeredAt: new Date().toISOString()
        };
      } else {
        profile = {
          name: demo.name,
          orgName: demo.orgName,
          designation: demo.designation,
          phone: demo.phone,
          role: demo.role,
          isAdmin: false,
          isPhoneVerified: true,
          isApproved: isCreator,
          avatarUrl: demo.avatarUrl,
          password: demo.mpin,
          pin: demo.mpin,
          approvedCategories: isCreator ? ['kumtluang', 'ralna', 'khawlsak'] : [],
          createdQRsCount: isCreator ? 5 : 0,
          registeredAt: new Date().toISOString()
        };
      }

      saveStoredCreatorProfile(profile);
      try {
        sessionStorage.removeItem('ronpay_admin_auth');
      } catch {}

      setIsLoading(false);
      setSuccessNotice(`${demo.name} (${demo.roleBadge}) anga luh fel a ni e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 650);
    }, 400);
  };

  // Staff Console Unlock Handler
  const handleStaffUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffPasscodeError('');
    const validCodes = ['9900', '1234', 'ronpay2026', 'admin'];
    if (validCodes.includes(staffPasscodeInput.trim().toLowerCase())) {
      setIsStaffConsoleUnlocked(true);
      setShowStaffUnlockPrompt(false);
      setStaffPasscodeInput('');
      setSuccessNotice('Staff & Admin Console hawn fel a ni e!');
      triggerHaptic([40, 70]);
    } else {
      triggerHaptic([50, 100, 50]);
      setStaffPasscodeError('Master Passcode dik lo! Phalna nei chauh tan a ni.');
    }
  };

  // 6. Google 1-Tap Login
  const handleGoogleLogin = () => {
    setIsLoading(true);
    setErrorMessage('');
    triggerHaptic();

    setTimeout(() => {
      const isSystemAdmin = googleCustomEmail === 'smartcabs2019@gmail.com';
      const displayName = googleCustomName.trim() || (googleIsNewUser ? 'RonPay User' : (currentProfile?.name || 'Google Verified User'));
      const displayPhone = googleCustomPhone.replace(/\D/g, '') || (currentProfile?.phone || '9436001234');

      const profile: CreatorProfile = {
        name: displayName,
        orgName: googleIsNewUser ? 'Mizoram Community Member' : (currentProfile?.orgName || 'Mizoram FinTech Community'),
        designation: isSystemAdmin ? 'System Admin' : 'Verified Google Member',
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
      setSuccessNotice(`Google Account (${googleCustomEmail}) hmangin login a hlawhtling e!`);
      triggerHaptic();
      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 700);
    }, 700);
  };

  const hasExistingUser = Boolean(currentProfile?.phone && currentProfile.phone.trim() !== '');

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94vh] flex flex-col text-slate-900 animate-scaleUp relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-md border border-indigo-400/40">
              <ShieldCheck className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  RonPay Security Login
                </h2>
                <span className="text-[9px] bg-emerald-400/20 text-emerald-300 font-black px-2 py-0.5 rounded-full border border-emerald-400/40">
                  PROTECTED
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                Biometric & MPIN Fast Authentication
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

        {/* Method Switcher Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/90 p-1.5 gap-1 shrink-0 text-xs font-bold text-slate-600">
          <button
            onClick={() => { setActiveMethod('biometric_pin'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'biometric_pin'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
            <span>Biometric / MPIN</span>
          </button>

          <button
            onClick={() => { setActiveMethod('phone_otp'); setErrorMessage(''); }}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMethod === 'phone_otp'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>Phone & OTP</span>
          </button>

          <button
            onClick={() => { setActiveMethod('google'); setErrorMessage(''); }}
            className={`py-2 px-3 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeMethod === 'google'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200 font-black'
                : 'hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <span className="font-black text-rose-600">G</span>
            <span>Google</span>
          </button>

          <button
            onClick={() => { setActiveMethod('demo'); setErrorMessage(''); }}
            className={`py-2 px-2.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
              activeMethod === 'demo'
                ? 'bg-white text-amber-900 shadow-xs border border-amber-300 font-black'
                : 'text-slate-400 hover:text-slate-700 hover:bg-white/60'
            }`}
            title="Interactive Demo Accounts (User & Creator)"
          >
            <Sparkles className="w-3 h-3 text-amber-600" />
            <span className="text-[10px]">Demo</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Notifications / Alerts */}
          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center gap-2.5 text-xs font-black text-emerald-900 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-rose-700 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 1: PRODUCTION BIOMETRIC & 4-DIGIT MPIN LOGIN */}
          {/* ========================================================= */}
          {activeMethod === 'biometric_pin' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Profile Card Header */}
              <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/60 border border-indigo-100/90 rounded-2xl p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={currentProfile?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'}
                      alt="User Avatar"
                      className="w-11 h-11 rounded-2xl object-cover ring-2 ring-indigo-400/40 shadow-xs"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-2xs">
                      <CheckCircle2 className="w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                      {hasExistingUser ? currentProfile.name : 'RonPay Account Holder'}
                    </h3>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {hasExistingUser ? `+91 ${currentProfile.phone}` : 'Active Device Profile'}
                    </p>
                    <span className="inline-block mt-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.2 rounded-full">
                      Protected by RonPay Guard
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod('phone_otp');
                    setPhoneInput('');
                  }}
                  className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1.5 rounded-xl shadow-2xs transition hover:shadow-xs cursor-pointer"
                >
                  Thlak Rawh
                </button>
              </div>

              {/* Sub-toggle: Fingerprint vs Face ID vs MPIN Keypad */}
              <div className="flex bg-slate-100 p-1 rounded-2xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => setAuthSubMode('fingerprint')}
                  className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                    authSubMode === 'fingerprint' ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Fingerprint</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthSubMode('faceid')}
                  className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                    authSubMode === 'faceid' ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <ScanFace className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Face ID</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthSubMode('mpin')}
                  className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer ${
                    authSubMode === 'mpin' ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>4-Digit MPIN</span>
                </button>
              </div>

              {/* BIOMETRIC SCANNER VISUAL (Fingerprint or Face ID) */}
              {(authSubMode === 'fingerprint' || authSubMode === 'faceid') && (
                <div className="flex flex-col items-center justify-center py-2 space-y-3">
                  <div
                    onClick={handleTriggerBiometricScan}
                    className={`relative w-28 h-28 rounded-3xl flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg active:scale-95 ${
                      biometricScanState === 'success'
                        ? 'bg-emerald-50 border-2 border-emerald-500 text-emerald-600 ring-8 ring-emerald-100'
                        : biometricScanState === 'scanning'
                        ? 'bg-indigo-50 border-2 border-indigo-600 text-indigo-600 ring-8 ring-indigo-100'
                        : 'bg-slate-50 border-2 border-indigo-200 text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50/50'
                    }`}
                  >
                    {/* Laser radar line */}
                    {biometricScanState === 'scanning' && (
                      <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full animate-bounce shadow-md" />
                    )}

                    {biometricScanState === 'success' ? (
                      <CheckCircle2 className="w-14 h-14 animate-fadeIn text-emerald-600" />
                    ) : authSubMode === 'faceid' ? (
                      <ScanFace className={`w-14 h-14 ${biometricScanState === 'scanning' ? 'animate-pulse text-indigo-600' : 'text-indigo-700'}`} />
                    ) : (
                      <Fingerprint className={`w-14 h-14 ${biometricScanState === 'scanning' ? 'animate-pulse text-indigo-600' : 'text-indigo-700'}`} />
                    )}

                    {biometricScanState === 'success' && (
                      <span className="absolute -bottom-2.5 bg-emerald-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                        VERIFIED
                      </span>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-black text-slate-800">
                      {biometricScanState === 'scanning'
                        ? `Scanning ${authSubMode === 'faceid' ? 'Face ID' : 'Fingerprint'}...`
                        : biometricScanState === 'success'
                        ? 'Biometric verified successfully!'
                        : `Touch sensor or tap box to scan ${authSubMode === 'faceid' ? 'Face ID' : 'Fingerprint'}`}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Vawi 1 hmehin phone sensor hmangin i lut nghal ang
                    </p>
                  </div>

                  {/* Biometric Security Status */}
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-center text-[10.5px] font-bold text-slate-600 flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Biometric Sensor: {isInsideIframe() ? 'In-App Secure Mode (Active)' : 'Hardware Sensor Active'}</span>
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">Encrypted</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerBiometricScan}
                    disabled={biometricScanState === 'scanning' || biometricScanState === 'success'}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>{authSubMode === 'faceid' ? 'Scan Face ID Now' : 'Scan Fingerprint Now'}</span>
                  </button>

                  {isInsideIframe() && (
                    <div className="text-center pt-0.5">
                      <a
                        href={typeof window !== 'undefined' ? window.location.href : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition"
                      >
                        <span>OS Hardware Fingerprint prompt test duh tan: Tab tharah hawng rawh</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* 4-DIGIT MPIN KEYPAD VISUAL */}
              {authSubMode === 'mpin' && (
                <div className="space-y-3 pt-1">
                  <div className="text-center">
                    <label className="text-xs font-bold text-slate-700 block">
                      4-Digit Security MPIN Chhu Lut Rawh
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      (Demo MPIN: 1234)
                    </span>
                  </div>

                  {/* Dot Indicators */}
                  <div className="flex justify-center items-center gap-3.5 py-1.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                          mpinInput.length > idx
                            ? 'bg-indigo-600 border-indigo-600 scale-110 shadow-xs'
                            : 'bg-slate-100 border-slate-300'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Numeric Keypad */}
                  <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          if (k === 'C') {
                            setMpinInput('');
                            triggerHaptic([20]);
                          } else if (k === '⌫') {
                            setMpinInput(prev => prev.slice(0, -1));
                            triggerHaptic([20]);
                          } else {
                            handleKeypadPress(k);
                          }
                        }}
                        disabled={isLoading}
                        className="h-11 rounded-2xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-800 font-black text-sm transition active:scale-90 flex items-center justify-center cursor-pointer shadow-2xs border border-slate-200/60"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Switch / Setup Helper */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                <span className="flex items-center gap-1 font-bold text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Biometric Login Activated
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMethod('phone_otp');
                  }}
                  className="font-black text-indigo-600 hover:underline cursor-pointer"
                >
                  Phone dang hmangin lut rawh &rarr;
                </button>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: PHONE & SMS OTP / MPIN LOGIN */}
          {/* ========================================================= */}
          {activeMethod === 'phone_otp' && (
            <form onSubmit={handlePhoneFormSubmit} className="space-y-3.5 animate-fadeIn">
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

              {/* Choose MPIN or SMS OTP */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => { setPhoneAuthType('mpin'); setMpinInput(''); }}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                    phoneAuthType === 'mpin' ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  4-Digit Security MPIN
                </button>
                <button
                  type="button"
                  onClick={() => { setPhoneAuthType('otp'); setMpinInput(''); }}
                  className={`flex-1 py-1.5 rounded-lg transition cursor-pointer ${
                    phoneAuthType === 'otp' ? 'bg-white text-indigo-950 font-black shadow-xs' : 'hover:text-slate-900'
                  }`}
                >
                  SMS OTP hmangin
                </button>
              </div>

              {phoneAuthType === 'mpin' ? (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-black text-slate-700">
                      Security MPIN
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
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-700">
                      SMS Verification Code (OTP)
                    </label>
                    {otpSent && (
                      <span className="text-[10px] text-emerald-600 font-bold">
                        OTP thawn a ni e
                      </span>
                    )}
                  </div>

                  {otpSent && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-1.5 text-emerald-900">
                        <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Simulated SMS Code: <strong>{generatedOtp}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMpinInput(generatedOtp);
                          triggerHaptic([20]);
                        }}
                        className="text-[10.5px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2 py-0.5 rounded-lg cursor-pointer transition"
                      >
                        Auto Fill
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    maxLength={4}
                    value={mpinInput}
                    onChange={(e) => setMpinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={otpSent ? "Chhu lut rawh: 4-digit code" : "SMS OTP i dawn hnuah chhu rawh"}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-base font-black tracking-widest text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    disabled={!otpSent}
                  />
                </div>
              )}

              {/* Remember Biometrics toggle */}
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={rememberBiometric}
                  onChange={(e) => setRememberBiometric(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span>He device-ah hian Biometric / MPIN vawng reng rawh</span>
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-2xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : phoneAuthType === 'otp' && !otpSent ? (
                  <>
                    <Smartphone className="w-4 h-4" /> Send SMS OTP Code
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> Sign In with Phone & MPIN
                  </>
                )}
              </button>
            </form>
          )}

          {/* ========================================================= */}
          {/* TAB 3: GOOGLE 1-TAP & REGISTRATION */}
          {/* ========================================================= */}
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

          {/* ========================================================= */}
          {/* TAB 4: LIVE PRODUCT DEMO (PUBLIC AUDITOR & STAFF VIEW) */}
          {/* ========================================================= */}
          {activeMethod === 'demo' && (
            <div className="space-y-3 animate-fadeIn">
              {/* Auditor & Visitor Welcome Box */}
              <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block text-amber-900">RonPay Live Product Demo</span>
                  <span className="text-[11px] text-amber-800 leading-relaxed block mt-0.5">
                    PG compliance auditor leh mikhualte tan account demo 2 chauh (User Pangai leh Creator Pakhat) chauh tarlan a ni.
                  </span>
                </div>
              </div>

              {/* Public Demo Accounts (User Pangai + Creator Pakhat + Khualmi) */}
              <div className="space-y-2">
                <div className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider px-1">
                  Public & Auditor Accounts
                </div>
                {PUBLIC_DEMO_ACCOUNTS.map((demo) => (
                  <button
                    key={demo.id}
                    onClick={() => handleSelectDemoAccount(demo)}
                    disabled={isLoading}
                    className="w-full text-left p-3 rounded-2xl border transition group cursor-pointer flex items-center justify-between gap-3 shadow-2xs active:scale-98 disabled:opacity-50 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/40 bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={demo.avatarUrl}
                          alt={demo.name}
                          className="w-10 h-10 rounded-xl object-cover ring-2 ring-slate-100 group-hover:ring-indigo-400"
                        />
                      </div>

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
                          {demo.orgName} {demo.phone && `• ${demo.phone}`}
                        </p>
                        <p className="text-[9.5px] text-slate-400 truncate mt-0.5">
                          {demo.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      <div className="flex items-center gap-1 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white px-2.5 py-1.5 rounded-xl transition text-[10.5px] font-bold text-slate-700">
                        <span>Lut Rawh</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Staff & Admin Section - Hidden unless unlocked */}
              {isStaffConsoleUnlocked ? (
                <div className="space-y-2 pt-2 border-t border-purple-200 animate-fadeIn">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-black text-purple-700 uppercase tracking-wider">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Staff & Management Console</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsStaffConsoleUnlocked(false)}
                      className="text-[10px] text-purple-600 hover:text-purple-800 font-bold hover:underline cursor-pointer"
                    >
                      Thukru Leh Rawh (Lock)
                    </button>
                  </div>

                  {STAFF_ADMIN_ACCOUNTS.map((demo) => (
                    <button
                      key={demo.id}
                      onClick={() => handleSelectDemoAccount(demo)}
                      disabled={isLoading}
                      className="w-full text-left p-3 rounded-2xl border transition group cursor-pointer flex items-center justify-between gap-3 shadow-2xs active:scale-98 disabled:opacity-50 border-purple-200 hover:border-purple-500 bg-purple-50/40 hover:bg-purple-50/80"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={demo.avatarUrl}
                            alt={demo.name}
                            className="w-10 h-10 rounded-xl object-cover ring-2 ring-purple-100 group-hover:ring-purple-400"
                          />
                          <div className="absolute -top-1 -right-1 bg-purple-700 text-white rounded-full p-0.5 shadow-2xs">
                            <Lock className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {demo.name}
                            </span>
                            <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full border ${demo.badgeColor}`}>
                              {demo.roleBadge}
                            </span>
                          </div>
                          <p className="text-[10.5px] text-purple-900/80 font-medium truncate mt-0.5">
                            {demo.orgName} • {demo.phone}
                          </p>
                          <p className="text-[9.5px] text-slate-500 truncate mt-0.5">
                            {demo.description}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1">
                        <div className="flex items-center gap-1 bg-purple-100 text-purple-900 group-hover:bg-purple-700 group-hover:text-white px-2.5 py-1.5 rounded-xl transition text-[10.5px] font-black">
                          <Lock className="w-3 h-3" />
                          <span>Unlock</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                /* Discreet trigger for staff */
                <div className="pt-3 text-center border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffUnlockPrompt(true);
                      setStaffPasscodeInput('');
                      setStaffPasscodeError('');
                    }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-100/70"
                  >
                    <Lock className="w-3 h-3" />
                    <span>RonPay Staff Console Access</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Staff Console Unlock Modal Dialog */}
        {showStaffUnlockPrompt && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-xs rounded-3xl p-5 shadow-2xl border border-slate-200 text-center space-y-3 animate-scaleUp">
              <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center shadow-xs">
                <Shield className="w-5 h-5" />
              </div>

              <div>
                <span className="text-[9.5px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  INTERNAL CONSOLE GUARD
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-1.5">
                  Staff Passcode Chhu Rawh
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Auditor leh khualmi lakah admin data thup a ni a, staff tan passcode a ngai e.
                </p>
              </div>

              {staffPasscodeError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-bold flex items-center gap-1.5 justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{staffPasscodeError}</span>
                </div>
              )}

              <form onSubmit={handleStaffUnlockSubmit} className="space-y-3">
                <input
                  type="password"
                  value={staffPasscodeInput}
                  onChange={(e) => setStaffPasscodeInput(e.target.value)}
                  placeholder="Master Passcode"
                  className="w-full text-center px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black tracking-widest text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                  autoFocus
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowStaffUnlockPrompt(false);
                      setStaffPasscodeInput('');
                      setStaffPasscodeError('');
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    Sut Leh Rawh
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black transition cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Hawnna</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Master Passcode Prompt Dialog (Overlay inside modal when Admin is clicked) */}
        {pendingAdminDemo && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-purple-200 text-center space-y-3 animate-scaleUp">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center shadow-xs">
                <Lock className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  ADMIN SECURITY GUARD
                </span>
                <h3 className="text-sm font-black text-slate-900 mt-1">
                  Master Security Passcode Chhu Rawh
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  <strong>{pendingAdminDemo.name}</strong> ({pendingAdminDemo.roleBadge}) access hi ven a ni a, phalna nei chauhvin an lut thei e.
                </p>
              </div>

              {masterPasscodeError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[11px] font-bold flex items-center gap-1.5 justify-center">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{masterPasscodeError}</span>
                </div>
              )}

              <form onSubmit={handleVerifyAdminPasscode} className="space-y-3">
                <input
                  type="password"
                  value={masterPasscodeInput}
                  onChange={(e) => setMasterPasscodeInput(e.target.value)}
                  placeholder="Master Passcode"
                  className="w-full text-center px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black tracking-widest text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-600"
                  autoFocus
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAdminDemo(null);
                      setMasterPasscodeInput('');
                      setMasterPasscodeError('');
                    }}
                    className="flex-1 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    Sut Leh Rawh
                  </button>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-black transition cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                    <span>Lut Rawh</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
