import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  UserCheck, 
  ShieldCheck, 
  Phone, 
  Building2, 
  Ribbon, 
  HandHeart, 
  AlertTriangle, 
  Infinity as InfinityIcon, 
  CheckCircle2, 
  Sparkles, 
  RefreshCw, 
  LogOut, 
  LogIn,
  Fingerprint,
  Lock,
  Unlock,
  Edit3,
  Check,
  User,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { CreatorProfile, BawmCategory } from '../types';
import { BAWM_CONFIG } from '../data/initialData';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile;
  onResetData: () => void;
  onOpenPhonePePortal?: () => void;
  onLogout?: () => void;
  onLoginClick?: () => void;
  onOpenAdmin?: () => void;
  biometricEnabled?: boolean;
  onToggleBiometric?: () => void;
  onLockNow?: () => void;
  onUpdateProfile?: (updated: CreatorProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  onResetData,
  onOpenPhonePePortal,
  onLogout,
  onLoginClick,
  onOpenAdmin,
  biometricEnabled = true,
  onToggleBiometric,
  onLockNow,
  onUpdateProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(creatorProfile.name || '');
  const [editOrgName, setEditOrgName] = useState(creatorProfile.orgName || '');
  const [editDesignation, setEditDesignation] = useState(creatorProfile.designation || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(creatorProfile.avatarUrl || '');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditName(creatorProfile.name || '');
    setEditOrgName(creatorProfile.orgName || '');
    setEditDesignation(creatorProfile.designation || '');
    setEditAvatarUrl(creatorProfile.avatarUrl || '');
  }, [creatorProfile]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (under 2.5MB for local base64 storage)
    if (file.size > 2.5 * 1024 * 1024) {
      alert('Thlalak hi 2.5MB aia lian a ni lo tur a ni.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      alert('Khawngaihin Hming chhu lut rawh.');
      return;
    }

    const updated: CreatorProfile = {
      ...creatorProfile,
      name: editName.trim(),
      orgName: editOrgName.trim() || 'Community Member',
      designation: editDesignation.trim() || 'Creator Member',
      avatarUrl: editAvatarUrl.trim() || undefined,
    };

    if (onUpdateProfile) {
      onUpdateProfile(updated);
    }
    setSaveSuccessNotice(true);
    setIsEditing(false);
    setTimeout(() => setSaveSuccessNotice(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-sm rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 relative my-auto shrink-0 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1.5 rounded-xl hover:bg-slate-100"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Save Success Toast */}
        {saveSuccessNotice && (
          <div className="p-3 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 shrink-0 text-white" />
            <span>Hming, Profile leh Thlalak hlawhtling takin vawn a ni ta!</span>
          </div>
        )}

        {/* Header / Avatar View */}
        {!isEditing ? (
          <div className="text-center space-y-2 pt-1">
            <div className="relative inline-block mx-auto">
              {creatorProfile.avatarUrl ? (
                <img
                  src={creatorProfile.avatarUrl}
                  alt={creatorProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-18 h-18 rounded-2xl object-cover shadow-md border-2 border-amber-400 mx-auto"
                />
              ) : (
                <div className="w-18 h-18 bg-gradient-to-tr from-indigo-600 to-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto text-2xl font-black shadow-md border-2 border-amber-400">
                  {creatorProfile.name ? creatorProfile.name.charAt(0).toUpperCase() : 'R'}
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="absolute -bottom-1 -right-1 p-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg shadow-sm transition cursor-pointer border-2 border-white"
                title="Profile Pic / Hming thlakna"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center justify-center gap-1.5">
                <h3 className="font-black text-slate-900 text-base sm:text-lg">{creatorProfile.name || 'RonPay User'}</h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition border border-indigo-200 cursor-pointer"
                  title="Hming leh Profile edit rawh"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                {creatorProfile.designation || 'Creator Member'} • <strong className="text-slate-900">{creatorProfile.orgName || 'Mizoram Branch'}</strong>
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-1.5 rounded-full border border-indigo-200 inline-flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" /> Profile & Pic Edit
              </button>
            </div>
          </div>
        ) : (
          /* Profile Edit Form */
          <form onSubmit={handleSave} className="bg-slate-50 p-4 rounded-2xl border border-indigo-100 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-indigo-600" /> Hming & Profile Thlakna
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Profile Picture Change Section */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2.5">
              <label className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center justify-between">
                <span>Profile Picture / Kohhran Logo</span>
                {editAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setEditAvatarUrl('')}
                    className="text-rose-600 hover:text-rose-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                )}
              </label>

              <div className="flex items-center gap-3">
                {editAvatarUrl ? (
                  <img
                    src={editAvatarUrl}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="w-13 h-13 rounded-xl object-cover border-2 border-indigo-400 shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-xl bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-xs border border-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer transition shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> Thlalak Thlang Rawh
                  </button>
                  <p className="text-[9.5px] text-slate-500 leading-tight">PNG, JPG, WebP (Max 2.5MB)</p>
                </div>
              </div>

              {/* Or Paste URL */}
              <div>
                <input
                  type="url"
                  value={editAvatarUrl}
                  onChange={(e) => setEditAvatarUrl(e.target.value)}
                  placeholder="Emaw Image Web Link / URL paste rawh..."
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10.5px] font-extrabold text-slate-700 uppercase">Creator Hming (Full Name)</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                placeholder="I hming..."
              />
            </div>

            <div>
              <label className="text-[10.5px] font-extrabold text-slate-700 uppercase">Organization / Kohhran / Branch</label>
              <input
                type="text"
                value={editOrgName}
                onChange={(e) => setEditOrgName(e.target.value)}
                className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                placeholder="e.g. BCM Ebenezer / YMA"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-extrabold text-slate-700 uppercase">Nihna (Designation)</label>
              <input
                type="text"
                value={editDesignation}
                onChange={(e) => setEditDesignation(e.target.value)}
                className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                placeholder="e.g. Secretary / Treasurer / Member"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 bg-white hover:bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl text-xs border border-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Save Changes
              </button>
            </div>
          </form>
        )}

        {/* Info Box */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-600 font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> Mobile:</span>
            <span className="font-bold text-slate-900">{creatorProfile.phone || '9862599881'}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-600 font-medium flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Account Status:</span>
            <span className="font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded text-[10px]">
              {creatorProfile.isApproved ? 'APPROVED CREATOR' : 'STANDARD USER'}
            </span>
          </div>

          <div className="border-t border-slate-200 pt-2.5">
            <p className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider mb-2">
              Active Bawm Creator Rights:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {creatorProfile.approvedCategories && creatorProfile.approvedCategories.length > 0 ? (
                creatorProfile.approvedCategories.map(cat => (
                  <span key={cat} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 flex items-center gap-1.5 shadow-2xs">
                    <CheckCircle2 className="w-3 h-3 text-indigo-600" /> {BAWM_CONFIG[cat]?.name || cat}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400 italic">No specific categories active</span>
              )}
            </div>
          </div>
        </div>

        {/* Biometric Security Control Box */}
        <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-100 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-indigo-600" />
              <span className="font-black text-xs text-slate-900">Biometric Lock</span>
            </div>
            {onToggleBiometric && (
              <button
                type="button"
                onClick={onToggleBiometric}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  biometricEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    biometricEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            )}
          </div>
          <p className="text-[10.5px] text-slate-600 leading-normal">
            Fingerprint / Face ID protection for Sulhnu History & Personal Profile.
          </p>
          {biometricEnabled && onLockNow && (
            <button
              type="button"
              onClick={() => {
                onLockNow();
                onClose();
              }}
              className="w-full mt-1 bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-700 font-bold py-2 px-3 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Lock className="w-3.5 h-3.5" /> Lock App / Reset Session
            </button>
          )}
        </div>

        {/* PhonePe PG V2 Management Trigger */}
        {onOpenPhonePePortal && (
          <button
            onClick={() => {
              onClose();
              onOpenPhonePePortal();
            }}
            className="w-full bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-950 p-3 rounded-2xl flex items-center justify-between text-xs font-bold transition cursor-pointer shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              PhonePe TSP & PG V2 Portal
            </span>
            <span className="text-[10.5px] bg-purple-200/80 text-purple-900 font-mono font-bold px-2 py-0.5 rounded-md">UAT</span>
          </button>
        )}

        {/* Master Admin Console Trigger */}
        {onOpenAdmin && (
          <button
            onClick={() => {
              onClose();
              onOpenAdmin();
            }}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white p-3 rounded-2xl flex items-center justify-between text-xs font-bold transition cursor-pointer shadow-md"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              RonPay Admin Console
            </span>
            <span className="text-[10px] bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black uppercase">
              Admin Login
            </span>
          </button>
        )}

        {/* Creator Session Login / Logout Action */}
        {creatorProfile.isApproved ? (
          onLogout && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black p-3 rounded-2xl flex items-center justify-center gap-2 text-xs transition cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-600" /> Creator Logout (Back to Normal User)
            </button>
          )
        ) : (
          onLoginClick && (
            <button
              onClick={() => {
                onClose();
                onLoginClick();
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black p-3 rounded-2xl flex items-center justify-center gap-2 text-xs transition shadow-md cursor-pointer"
            >
              <LogIn className="w-4 h-4" /> Creator Login / In-Register
            </button>
          )
        )}

        <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 text-center">
          <p className="text-[10.5px] text-amber-950 font-bold">
            RonPay Community Platform v2.5
          </p>
          <p className="text-[10px] text-amber-800">Protected with Biometrics & End-to-End Integrity</p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onResetData}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Demo
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
