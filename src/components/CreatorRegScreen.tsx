import React, { useState } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Smartphone, 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  Info, 
  BookOpen,
  Lock,
  LogIn,
  UserPlus,
  LogOut,
  AlertCircle
} from 'lucide-react';
import { BawmCategory, CreatorProfile } from '../types';
import { BAWM_CONFIG } from '../data/initialData';
import { getStoredCreatorsList } from '../utils/storage';

interface CreatorRegScreenProps {
  onBack: () => void;
  onSuccess: (profile: CreatorProfile, selectedCategory: BawmCategory) => void;
  creatorProfile: CreatorProfile;
  onOpenAdminDashboard?: () => void;
}

export const CreatorRegScreen: React.FC<CreatorRegScreenProps> = ({
  onBack,
  onSuccess,
  creatorProfile,
  onOpenAdminDashboard,
}) => {
  // Mode: 'login' vs 'register'
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login states
  const [loginPhone, setLoginPhone] = useState<string>(creatorProfile.phone || '');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Register states
  const [applicantName, setApplicantName] = useState<string>(creatorProfile.name || '');
  const [orgName, setOrgName] = useState<string>(creatorProfile.orgName || '');
  const [designation, setDesignation] = useState<string>(creatorProfile.designation || '');
  const [phone, setPhone] = useState<string>(creatorProfile.phone || '');
  const [password, setPassword] = useState<string>('');
  const [category, setCategory] = useState<BawmCategory>('ralna');
  const [uploadedDocName, setUploadedDocName] = useState<string>(creatorProfile.authDocName || '');
  
  // OTP state for registration
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean>(creatorProfile.isPhoneVerified || false);

  const handleSendOtp = () => {
    if (!phone || phone.trim().length < 10) {
      alert('Khawngaihin Phone number dik tak chhu lut rawh (10 digits).');
      return;
    }
    setIsOtpSent(true);
    alert('📲 OTP chu i phone (' + phone + ')-ah thawn a ni ta! (Test OTP: 1234)');
  };

  const handleVerifyOtp = () => {
    if (otpCode.trim() === '1234' || otpCode.trim().length === 4) {
      setIsPhoneVerified(true);
      setIsOtpSent(false);
      alert('✅ Phone number verified successfully!');
    } else {
      alert('❌ OTP a dik lo! Test OTP atan "1234" hmang rawh.');
    }
  };

  const handleDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedDocName(e.target.files[0].name);
    }
  };

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanInput = loginPhone.trim();

    // Check for Admin Login via User ID / Phone
    if (cleanInput.toLowerCase() === 'admin' || cleanInput === 'admin@ronpay.com' || cleanInput === '9999999999') {
      if (loginPassword.trim() === 'ronpay2026' || loginPassword.trim() === 'admin' || loginPassword.trim() === '1234') {
        try {
          sessionStorage.setItem('ronpay_admin_auth', 'true');
        } catch (e) {
          // ignore
        }
        const adminProfile: CreatorProfile = {
          name: 'RonPay System Administrator',
          orgName: 'BCM Ebenezer',
          designation: 'Finance & Accounts',
          phone: 'admin',
          isPhoneVerified: true,
          isApproved: true,
          isAdmin: true,
          approvedCategories: ['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'],
          createdQRsCount: 99,
        };
        onSuccess(adminProfile, 'ralna');
        if (onOpenAdminDashboard) {
          onOpenAdminDashboard();
        }
        return;
      } else {
        setLoginError('Admin Password a dik lo! (Default: ronpay2026)');
        return;
      }
    }

    if (!cleanInput || (cleanInput.length < 10 && cleanInput.toLowerCase() !== 'admin')) {
      setLoginError('Khawngaihin Registered Mobile Number (10 digits) chhu lut rawh.');
      return;
    }

    if (!loginPassword.trim()) {
      setLoginError('Khawngaihin Creator Password chhu lut rawh.');
      return;
    }

    // Registered Creator login authentication matching
    const registeredCreators = getStoredCreatorsList();
    const matchedCreator = registeredCreators.find(c => c.phone === cleanInput || c.phone.replace(/\D/g, '') === cleanInput.replace(/\D/g, ''));

    let activeProfile: CreatorProfile;
    if (matchedCreator) {
      activeProfile = {
        ...matchedCreator,
        isPhoneVerified: true,
        isApproved: true,
        approvedCategories: matchedCreator.approvedCategories && matchedCreator.approvedCategories.length > 0 
          ? matchedCreator.approvedCategories 
          : ['kumtluang', 'ralna', 'khawlsak', 'rikrum'],
      };
    } else {
      activeProfile = {
        name: creatorProfile.name || (loginPhone === '9862599881' ? 'Rev. Dr. R. Zothansanga' : (loginPhone === '9862300000' ? 'Lalthianghlima (YMA Secretary)' : 'QR Creator Officer')),
        orgName: creatorProfile.orgName || (loginPhone === '9862599881' ? 'BCM Ebenezer, Zobawk Local Church' : 'YMA Bungkawn Branch / BCM Ebenezer'),
        designation: creatorProfile.designation || (loginPhone === '9862599881' ? 'Pastor / Secretary' : 'General Secretary'),
        phone: loginPhone.trim(),
        isPhoneVerified: true,
        isApproved: true,
        authDocName: creatorProfile.authDocName || 'Official_Approval_Letter.pdf',
        approvedCategories: creatorProfile.approvedCategories.length > 0 
          ? creatorProfile.approvedCategories 
          : ['kumtluang', 'ralna', 'khawlsak', 'rikrum'],
        createdQRsCount: creatorProfile.createdQRsCount || 3,
      };
    }

    onSuccess(activeProfile, activeProfile.approvedCategories[0] || 'kumtluang');
  };

  // Handle Registration submission
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!applicantName.trim()) {
      alert('Khawngaihin Diltu Hming chhu lut rawh!');
      return;
    }

    if (!isPhoneVerified) {
      alert('Khawngaihin i Phone number OTP hmangin verify hmasa rawh!');
      return;
    }

    if (!password.trim() || password.length < 4) {
      alert('Khawngaihin Password (a tlem berah 4 characters) siam rawh.');
      return;
    }

    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 6 Months (180 Days) dynamic fair trial from registration date

    const updatedProfile: CreatorProfile = {
      ...creatorProfile,
      name: applicantName.trim(),
      orgName: orgName.trim() || 'Community Organization',
      designation: designation.trim() || 'Authorized Creator',
      phone: phone.trim(),
      isPhoneVerified: true,
      isApproved: true,
      authDocName: uploadedDocName || 'Authorization_Letter.pdf',
      approvedCategories: Array.from(new Set([...creatorProfile.approvedCategories, category])),
      createdQRsCount: creatorProfile.createdQRsCount || 0,
      registeredAt: now.toISOString(),
      trialExpiresAt: trialExpiry.toISOString(),
      customTrialDays: 180,
      freePostsQuota: 10,
      freePostsUsed: 0,
      subscriptionPlan: 'free_trial',
    };

    alert(`🎉 Creator Registration Successful for ${BAWM_CONFIG[category].name}!\n\n🎁 Welcome Offer: Thla 6 (180 Days) Free Trial & A thlawnin QR 10 siam theihna pek i ni e.`);
    onSuccess(updatedProfile, category);
  };

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 hover:text-indigo-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 border border-amber-300 uppercase">
          Creator Authentication
        </span>
      </div>

      {/* Mode Switcher Tabs: Login vs Register */}
      <div className="bg-slate-200/80 p-1 rounded-2xl flex text-xs font-bold shadow-inner">
        <button
          type="button"
          onClick={() => setAuthMode('login')}
          className={`flex-1 py-2.5 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            authMode === 'login'
              ? 'bg-white text-indigo-950 font-black shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <LogIn className="w-3.5 h-3.5 text-indigo-600" /> Creator Login
        </button>
        <button
          type="button"
          onClick={() => setAuthMode('register')}
          className={`flex-1 py-2.5 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
            authMode === 'register'
              ? 'bg-white text-amber-950 font-black shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-amber-600" /> New Registration
        </button>
      </div>

      {/* 1. CREATOR LOGIN VIEW */}
      {authMode === 'login' && (
        <form onSubmit={handleLoginSubmit} className="bg-white p-4.5 rounded-2xl border border-slate-200/90 space-y-4 shadow-xs text-xs">
          <div className="text-center py-1">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto text-xl mb-1.5 shadow-xs border border-indigo-200">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-sm">QR Creator Account Login</h3>
            <p className="text-[10.5px] text-slate-500 mt-0.5">
              QR Code siam turin Creator account-ah lut rawh.
            </p>
          </div>

          {loginError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-xl flex items-center gap-2 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Registered Phone Number or Admin User ID *
            </label>
            <input
              type="text"
              required
              value={loginPhone}
              onChange={(e) => setLoginPhone(e.target.value)}
              placeholder="e.g. 9862300000 or admin"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Password / PIN *
            </label>
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Enter PIN / Password"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          <div className="bg-indigo-50/70 p-3 rounded-xl border border-indigo-100 text-[10px] text-indigo-950 font-medium space-y-1">
            <p className="font-bold">Quick Demo Login Credentials:</p>
            <p>• Creator: <span className="font-mono font-bold text-indigo-700">9862300000</span> | PIN: <span className="font-mono font-bold text-indigo-700">1234</span></p>
            <p>• Admin: <span className="font-mono font-bold text-indigo-700">admin</span> | Password: <span className="font-mono font-bold text-indigo-700">ronpay2026</span></p>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3 rounded-xl transition text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <LogIn className="w-4 h-4" /> Login & Continue
          </button>

          {onOpenAdminDashboard && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium">System Administrator i ni em?</span>
              <button
                type="button"
                onClick={onOpenAdminDashboard}
                className="text-[10.5px] font-black text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Admin Console
              </button>
            </div>
          )}
        </form>
      )}

      {/* 2. NEW REGISTRATION VIEW */}
      {authMode === 'register' && (
        <form onSubmit={handleRegisterSubmit} className="bg-white p-4 rounded-2xl border border-slate-200/90 space-y-3.5 shadow-xs text-xs">
          {/* Banner */}
          <div className="text-center py-1">
            <div className="w-11 h-11 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto text-lg mb-1.5 shadow-xs border border-amber-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-black text-slate-900 text-sm">QR Creator Dilna & Verification</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Security leh Mawhphurhna felfai neihna a ni.</p>
          </div>

          {/* Applicant Name */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Diltu Hming Pum (Applicant Full Name) *
            </label>
            <input
              type="text"
              required
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="e.g. Lalremruata"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          {/* Organization Name */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Pawl / NGO / Kohhran Hming (Organization Name)
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. YMA Bungkawn Branch / BCM Zobawk"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          {/* Designation */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Pawl-ah Dinhmun Chelh (Designation)
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Secretary / Treasurer / Finance Committee"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          {/* Phone Number & OTP Verification */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" /> Phone & OTP Verification
              </label>
              {isPhoneVerified && (
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black flex items-center gap-1 border border-emerald-300">
                  <CheckCircle2 className="w-2.5 h-2.5" /> VERIFIED
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                disabled={isPhoneVerified}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile Number (10 digits)"
                maxLength={10}
                className={`flex-1 border rounded-xl p-2 text-xs font-bold focus:outline-none ${
                  isPhoneVerified 
                    ? 'bg-slate-100 border-slate-200 text-slate-500' 
                    : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-600'
                }`}
              />
              {!isPhoneVerified && (
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Send OTP
                </button>
              )}
            </div>

            {isOtpSent && !isPhoneVerified && (
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter OTP (Test: 1234)"
                  maxLength={4}
                  className="flex-1 bg-white border border-amber-300 rounded-xl p-2 text-xs font-black text-slate-800 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Verify
                </button>
              </div>
            )}
          </div>

          {/* New Password field */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Create Password / PIN *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create Login Password"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            />
          </div>

          {/* Creator Category Selection */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
              Creator Category Dil Duh *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as BawmCategory)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
            >
              <option value="ralna">Ralna Bawm Creator (Chhiatni & Ralna)</option>
              <option value="khawlsak">Khawlsak Bawm Creator (Riangvai, Chanhai)</option>
              <option value="rikrum">Rikrum Bawm Creator (Emergency, Kangmei)</option>
              <option value="kumtluang">Kumtluang Bawm Creator (Permanent / Kohhran)</option>
            </select>
          </div>

          {/* Recommendation Letter Upload */}
          <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200 space-y-2">
            <label className="text-[10.5px] font-extrabold text-indigo-950 uppercase tracking-wider block">
              Pawl / Branch Hriatpuina Lehkha (Recommendation Letter)
            </label>
            <input
              type="file"
              accept="image/*,.pdf"
              onChange={handleDocUpload}
              className="block w-full text-[10px] text-slate-500 file:mr-2.5 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
            />
            {uploadedDocName && (
              <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Uploaded: {uploadedDocName}
              </p>
            )}
            <p className="text-[9.5px] text-slate-500 italic">
              Pawl aiawha dil a nih chuan Seal & Signature hmuhtheihna lehkha upload tel tur a ni.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black py-3 rounded-xl transition text-xs shadow-md cursor-pointer active:scale-[0.99]"
          >
            Submit Application & Activate Creator Account
          </button>
        </form>
      )}

      {/* KAWHHMUHNA GUIDANCE SECTION */}
      <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl space-y-2.5 text-[10.5px] text-slate-700">
        <div className="flex items-center gap-1.5 border-b border-indigo-200 pb-1.5">
          <BookOpen className="w-4 h-4 text-indigo-700" />
          <h4 className="font-extrabold text-indigo-950 uppercase tracking-wider">
            KAWHHMUHNA (GUIDELINES)
          </h4>
        </div>
        <div className="space-y-1.5 font-medium leading-relaxed">
          <p>
            <b className="text-purple-900">a) Ralna Bawm:</b> Chhiatni atan bika hman tur a ni a, YMA te'n Chhiattawk chhungkua te tan he Ralna Bawm QR hi an siam thei ang.
          </p>
          <p>
            <b className="text-emerald-900">b) Khawlsak Bawm:</b> Riangvai, Chanhai, mi chhumchhia leh tanpui ngaite leh vehbur khawnsak ngai te tan hman tur a ni ang.
          </p>
          <p>
            <b className="text-rose-900">c) Rikrum Bawm:</b> Kangmei, Tuilian, Leimin leh Khuarel chhiatna tawk tu te he Bawm hi hman tur a ni.
          </p>
          <p>
            <b className="text-blue-900">d) Kumtluang Bawm:</b> NGO, Kohhran, Pawl, Association etc. te tan he Bawm hi siam a ni.
          </p>
        </div>
        <div className="border-t border-indigo-200 pt-2 text-slate-600 font-semibold text-[10px]">
          <p>
            <b>Note :-</b> Point no a), b), c) QR nun hun chhung hi Creator in a set thei a, Ni 1 atanga thla khat chhung a ni ang; d) Kumtluang QR hi Kum 1 chhung a nung thei thung ang.
          </p>
        </div>
      </div>
    </div>
  );
};
