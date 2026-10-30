import React, { useState, useEffect } from 'react';
import { 
  X, 
  HardDrive, 
  Folder, 
  FolderOpen, 
  Save, 
  Mail, 
  Share2, 
  MessageSquare, 
  ShieldCheck, 
  Key, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileSpreadsheet, 
  FileCode, 
  Download, 
  RefreshCw, 
  Send, 
  Eye, 
  EyeOff, 
  Check, 
  Info, 
  Calendar, 
  Database,
  ExternalLink,
  ChevronRight,
  Shield,
  Upload,
  Trash2,
  Smartphone,
  Laptop,
  CheckSquare,
  Sparkles,
  Layers
} from 'lucide-react';
import { BackupSyncConfig, BackupHistoryItem } from '../types';
import { 
  getBackupConfig, 
  saveBackupConfig, 
  executeLocalBackup, 
  sendEmailBackup, 
  generateWhatsAppSummary, 
  pickLocalFolder, 
  getBackupHistory,
  clearBackupHistory,
  setStorageLocation,
  isFileSystemAccessSupported,
  decryptData
} from '../services/backupService';
import { formatDateTimeDDMMYYYY } from '../utils/date';
import { restoreFullDatabaseBackup, isGuestUser, getStoredCreatorProfile } from '../utils/storage';

interface BackupSyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorEmail?: string;
  creatorPhone?: string;
}

export const BackupSyncSettingsModal: React.FC<BackupSyncSettingsModalProps> = ({
  isOpen,
  onClose,
  creatorEmail,
  creatorPhone
}) => {
  const [config, setConfig] = useState<BackupSyncConfig>(() => getBackupConfig());
  const [history, setHistory] = useState<BackupHistoryItem[]>(() => getBackupHistory());

  // Form Editing States
  const [localEnabled, setLocalEnabled] = useState(config.localBackupEnabled);
  const [midnightAuto, setMidnightAuto] = useState(config.midnightAutoBackup);
  const [backupFormat, setBackupFormat] = useState<'json' | 'csv' | 'both'>(config.backupFormat || 'both');
  const [encryptionEnabled, setEncryptionEnabled] = useState(config.encryptionEnabled);
  const [encryptionPassword, setEncryptionPassword] = useState(config.encryptionPassword || '');
  const [showPassword, setShowPassword] = useState(false);
  const [folderName, setFolderName] = useState(config.folderName || 'Device Downloads (Download/RonPay_Backups)');
  const [storageMode, setStorageMode] = useState<'downloads' | 'directory_handle' | 'opfs' | 'custom'>(config.storageMode || 'downloads');

  // Folder Location Picker Modal State
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [locationPickerMsg, setLocationPickerMsg] = useState<string>('');

  // Email States
  const [emailEnabled, setEmailEnabled] = useState(config.emailBackupEnabled);
  const [emailRecipient, setEmailRecipient] = useState(config.emailRecipient || creatorEmail || 'bethelcomputercentrelunglei@gmail.com');
  const [emailWeeklyDigest, setEmailWeeklyDigest] = useState(config.emailWeeklyDigest);

  // WhatsApp States
  const [whatsappEnabled, setWhatsappEnabled] = useState(config.whatsappBackupEnabled);
  const [whatsappNumber, setWhatsappNumber] = useState(config.whatsappNumber || creatorPhone || '9862000001');

  // Action status indicators
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [saveStatusMsg, setSaveStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<{ type: 'success' | 'error'; text: string; mailtoUrl?: string } | null>(null);

  // Clear History confirmation state
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);

  // Test Decrypt Modal / Drawer
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [verifyFileContent, setVerifyFileContent] = useState('');
  const [verifyPassword, setVerifyPassword] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; preview?: string; error?: string } | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Restore State
  const restoreFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState<{
    success: boolean;
    message: string;
    counts?: { campaigns?: number; transactions?: number; members?: number; expenses?: number; creators?: number };
  } | null>(null);
  const [pendingEncryptedFileContent, setPendingEncryptedFileContent] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [restorePassphrasePrompt, setRestorePassphrasePrompt] = useState(false);
  const [customRestorePassphrase, setCustomRestorePassphrase] = useState('');
  const [restorePassphraseError, setRestorePassphraseError] = useState('');

  // Active Tab: Mobile Optimized (local | email | whatsapp | history)
  const [activeTab, setActiveTab] = useState<'local' | 'email' | 'whatsapp' | 'history'>('local');

  useEffect(() => {
    if (isOpen) {
      const freshConfig = getBackupConfig();
      setConfig(freshConfig);
      setLocalEnabled(freshConfig.localBackupEnabled);
      setMidnightAuto(freshConfig.midnightAutoBackup);
      setBackupFormat(freshConfig.backupFormat || 'both');
      setEncryptionEnabled(freshConfig.encryptionEnabled);
      setEncryptionPassword(freshConfig.encryptionPassword || '');
      setFolderName(freshConfig.folderName || 'Device Downloads (Download/RonPay_Backups)');
      setStorageMode(freshConfig.storageMode || 'downloads');

      setEmailEnabled(freshConfig.emailBackupEnabled);
      setEmailRecipient(freshConfig.emailRecipient || creatorEmail || 'bethelcomputercentrelunglei@gmail.com');
      setEmailWeeklyDigest(freshConfig.emailWeeklyDigest);

      setWhatsappEnabled(freshConfig.whatsappBackupEnabled);
      setWhatsappNumber(freshConfig.whatsappNumber || creatorPhone || '9862000001');

      setHistory(getBackupHistory());
      setSaveStatusMsg(null);
      setEmailStatusMsg(null);
      setShowLocationPicker(false);
      setConfirmClearHistory(false);
    }
  }, [isOpen, creatorEmail, creatorPhone]);

  if (!isOpen) return null;

  // Save Settings handler
  const handleUpdateConfig = (partial: Partial<BackupSyncConfig>) => {
    const updated: BackupSyncConfig = {
      ...config,
      localBackupEnabled: localEnabled,
      midnightAutoBackup: midnightAuto,
      backupFormat,
      encryptionEnabled,
      encryptionPassword,
      folderName,
      storageMode,
      emailBackupEnabled: emailEnabled,
      emailRecipient,
      emailWeeklyDigest,
      whatsappBackupEnabled: whatsappEnabled,
      whatsappNumber,
      ...partial
    };
    setConfig(updated);
    saveBackupConfig(updated);
  };

  // 1. Local: Pick Folder on PC / HDD (via File System Access API)
  const handlePickDesktopDirectory = async () => {
    setLocationPickerMsg('');
    try {
      const res = await pickLocalFolder();
      if (res.success && res.folderName) {
        setFolderName(res.folderName);
        setStorageMode('directory_handle');
        handleUpdateConfig({ 
          folderName: res.folderName, 
          storageMode: 'directory_handle', 
          hasFolderHandle: true 
        });
        setSaveStatusMsg({ type: 'success', text: `📁 PC Folder thlan fel a ni: "${res.folderName}"` });
        setShowLocationPicker(false);
      } else if (res.error === 'UNSUPPORTED_ON_DEVICE') {
        setLocationPickerMsg('He device/browser-ah hian direct folder picker a awm lo. "Phone / Device Downloads" thlang rawh le.');
      } else if (res.error) {
        setLocationPickerMsg(res.error);
      }
    } catch (e: any) {
      setLocationPickerMsg(e?.message || 'Folder thlan theih a ni lo.');
    }
  };

  // 1. Local: Set Storage Mode (Downloads / OPFS / Custom)
  const handleSelectStorageMode = async (mode: 'downloads' | 'opfs' | 'custom', customName?: string) => {
    const updated = await setStorageLocation(mode, customName);
    setFolderName(updated.folderName || 'Device Downloads');
    setStorageMode(mode);
    setConfig(updated);
    setSaveStatusMsg({ 
      type: 'success', 
      text: `Save-na hmun thlak fel a ni: "${updated.folderName}"` 
    });
    setShowLocationPicker(false);
  };

  // 1. Local: Manual "Save Backup Now" (MS Office-style)
  const handleSaveBackupNow = async (formatOverride?: 'json' | 'csv' | 'both') => {
    setIsSavingManual(true);
    setSaveStatusMsg(null);

    // Save current config preferences first
    handleUpdateConfig({
      localBackupEnabled: localEnabled,
      midnightAutoBackup: midnightAuto,
      backupFormat: formatOverride || backupFormat,
      encryptionEnabled,
      encryptionPassword,
      folderName,
      storageMode
    });

    try {
      const result = await executeLocalBackup(false, formatOverride || backupFormat);
      if (result.success) {
        setSaveStatusMsg({
          type: 'success',
          text: `💾 ${result.message}`
        });
        setHistory(getBackupHistory());
        setConfig(getBackupConfig());
      } else {
        setSaveStatusMsg({
          type: 'error',
          text: result.message || 'Backup save theih a ni lo.'
        });
      }
    } catch (e: any) {
      setSaveStatusMsg({
        type: 'error',
        text: e?.message || 'Backup process-ah buaina a awm.'
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  // 2. Email: Manual Send
  const handleSendEmailNow = async () => {
    setIsSendingEmail(true);
    setEmailStatusMsg(null);

    handleUpdateConfig({
      emailBackupEnabled: emailEnabled,
      emailRecipient,
      emailWeeklyDigest
    });

    try {
      const res = await sendEmailBackup(false, emailRecipient);
      setEmailStatusMsg({
        type: res.success ? 'success' : 'error',
        text: res.message,
        mailtoUrl: res.mailtoUrl
      });
      setHistory(getBackupHistory());
      setConfig(getBackupConfig());
    } catch (e: any) {
      setEmailStatusMsg({
        type: 'error',
        text: e?.message || 'Email thawn theih a ni lo.'
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 3. WhatsApp: Share Summary Now
  const handleShareWhatsApp = () => {
    handleUpdateConfig({
      whatsappBackupEnabled: whatsappEnabled,
      whatsappNumber
    });
    const { url } = generateWhatsAppSummary(whatsappNumber);
    window.open(url, '_blank');
    setHistory(getBackupHistory());
  };

  // 4. History: Clear History
  const handleClearHistory = () => {
    clearBackupHistory();
    setHistory([]);
    setConfirmClearHistory(false);
    setSaveStatusMsg({ type: 'success', text: 'Backup history zawng zawng phiat fel a ni e.' });
  };

  // Decryption Tester
  const handleRunDecryptTest = async () => {
    if (!verifyFileContent.trim()) {
      setVerifyResult({ success: false, error: 'Encrypted file content dah lut rawh.' });
      return;
    }
    setIsDecrypting(true);
    setVerifyResult(null);
    try {
      const plain = await decryptData(verifyFileContent, verifyPassword);
      let preview = plain.slice(0, 400);
      try {
        const parsed = JSON.parse(plain);
        if (parsed.stats) {
          preview = `Decrypted successfully!\n• Total Transactions: ${parsed.stats.totalTransactions}\n• Total Amount: ₹${parsed.stats.totalCollectedAmount}\n• Exported: ${parsed.exportedAt}`;
        }
      } catch {}
      setVerifyResult({ success: true, preview });
    } catch (e: any) {
      setVerifyResult({ success: false, error: e?.message || 'Decryption failed. Check password.' });
    } finally {
      setIsDecrypting(false);
    }
  };

  // Restore Execution Handler
  const executeRestorePayload = (plainJsonText: string) => {
    try {
      const activeProfile = getStoredCreatorProfile();
      const res = restoreFullDatabaseBackup(plainJsonText, activeProfile);
      if (res.success) {
        setRestoreStatus({
          success: true,
          message: `Backup hlawhtling taka dah let a ni! Recovered: ${res.counts?.transactions ?? 0} transactions, ${res.counts?.campaigns ?? 0} campaigns, ${res.counts?.members ?? 0} members, ${res.counts?.expenses ?? 0} expenses.`,
          counts: res.counts
        });
        setHistory(getBackupHistory());
        setRestorePassphrasePrompt(false);
        setPendingEncryptedFileContent(null);
        setCustomRestorePassphrase('');
        setRestorePassphraseError('');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ronpay_database_restored'));
        }
      } else {
        setRestoreStatus({
          success: false,
          message: res.error || 'Backup restore a hlawhchham. File format enfiah rawh.'
        });
      }
    } catch (e: any) {
      setRestoreStatus({
        success: false,
        message: e?.message || 'Restore tih laia buaina a awm.'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRestoreFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    setRestoreStatus(null);
    setPendingFileName(file.name);

    try {
      const rawText = await file.text();
      if (!rawText.trim()) {
        throw new Error('File ruak a ni.');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        throw new Error('File hi valid JSON / RonPay Backup file a ni lo.');
      }

      // If it's an encrypted backup envelope
      if (parsed && (parsed.ronpay_envelope || parsed.cipher === 'AES-GCM-256')) {
        // Attempt automatic decryption using configured password or default
        try {
          const plain = await decryptData(rawText, encryptionPassword || undefined);
          executeRestorePayload(plain);
          return;
        } catch {
          // If auto decrypt fails, prompt user for password
          setPendingEncryptedFileContent(rawText);
          setCustomRestorePassphrase(encryptionPassword || '');
          setRestorePassphrasePrompt(true);
          setRestorePassphraseError('');
          setIsRestoring(false);
          return;
        }
      }

      // Plain JSON backup
      executeRestorePayload(rawText);
    } catch (err: any) {
      setRestoreStatus({
        success: false,
        message: err?.message || 'File chhiar theih a ni lo.'
      });
      setIsRestoring(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleDecryptAndRestoreSubmit = async () => {
    if (!pendingEncryptedFileContent) return;
    setIsRestoring(true);
    setRestorePassphraseError('');
    try {
      const plain = await decryptData(pendingEncryptedFileContent, customRestorePassphrase);
      executeRestorePayload(plain);
    } catch (e: any) {
      setRestorePassphraseError(e?.message || 'Passphrase a dik lo. Password dik tak chhuah leh rawh le.');
      setIsRestoring(false);
    }
  };

  const currentProfile = getStoredCreatorProfile();
  const isGuest = isGuestUser(currentProfile);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
              <HardDrive className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Backup & Sync Settings
                <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  SSOT
                </span>
              </h2>
              <p className="text-[10.5px] text-slate-400">
                Local Device • Midnight Auto • Email & WhatsApp
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Guest User Access Restriction View */}
        {isGuest ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base font-black text-white">Khualmi (Guest User) Tan Backup A In-Off</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Guest user te hian Bawm an siam ngai loh avangin Backup hi mamawh a ni lo. Backup hi Creator-te tan chauh, anmahni Bawm siam chauh vawng tura duan a ni.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition cursor-pointer"
            >
              Hrethiam E / Khawp Mai
            </button>
          </div>
        ) : (
          <>

        {/* Navigation Tabs - Mobile Optimized 4-Column Responsive Grid */}
        <div className="grid grid-cols-4 bg-slate-950/90 border-b border-slate-800 p-1 gap-1 shrink-0">
          {/* Tab 1: Local Device */}
          <button
            type="button"
            id="tab-btn-local"
            onClick={() => setActiveTab('local')}
            className={`py-2 px-1 rounded-xl text-center transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer min-w-0 ${
              activeTab === 'local' 
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10.5px] sm:text-xs truncate leading-tight">
              <span className="hidden sm:inline">1. </span>Local<span className="hidden md:inline"> Storage</span>
            </span>
          </button>

          {/* Tab 2: Optional Email */}
          <button
            type="button"
            id="tab-btn-email"
            onClick={() => setActiveTab('email')}
            className={`py-2 px-1 rounded-xl text-center transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer min-w-0 relative ${
              activeTab === 'email' 
                ? 'bg-indigo-600 text-white font-black shadow-xs' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold'
            }`}
          >
            <div className="relative inline-flex items-center">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {emailEnabled && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-950 animate-pulse" />}
            </div>
            <span className="text-[10.5px] sm:text-xs truncate leading-tight">
              <span className="hidden sm:inline">2. </span>Email
            </span>
          </button>

          {/* Tab 3: Optional WhatsApp */}
          <button
            type="button"
            id="tab-btn-whatsapp"
            onClick={() => setActiveTab('whatsapp')}
            className={`py-2 px-1 rounded-xl text-center transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer min-w-0 relative ${
              activeTab === 'whatsapp' 
                ? 'bg-emerald-600 text-white font-black shadow-xs' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold'
            }`}
          >
            <div className="relative inline-flex items-center">
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              {whatsappEnabled && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-slate-950 animate-pulse" />}
            </div>
            <span className="text-[10.5px] sm:text-xs truncate leading-tight">
              <span className="hidden sm:inline">3. </span>WhatsApp
            </span>
          </button>

          {/* Tab 4: History */}
          <button
            type="button"
            id="tab-btn-history"
            onClick={() => setActiveTab('history')}
            className={`py-2 px-1 rounded-xl text-center transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer min-w-0 ${
              activeTab === 'history' 
                ? 'bg-slate-700 text-white font-black shadow-xs' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60 font-semibold'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[10.5px] sm:text-xs truncate leading-tight">
              History<span className="text-[9.5px] opacity-80 ml-0.5">({history.length})</span>
            </span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: LOCAL DEVICE BACKUP (HDD / PHONE STORAGE) */}
          {activeTab === 'local' && (
            <div className="space-y-4 animate-fadeIn">
              
              {/* MS Office-Style Manual Save Prominent Banner */}
              <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-amber-950/40 p-3.5 sm:p-4 rounded-2xl border border-amber-500/30 shadow-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      MS Office-Style Save
                    </span>
                    <h3 className="text-sm sm:text-base font-black text-white mt-1">Manual On-Demand Save</h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Save backup file directly to your local device anytime with one click.
                    </p>
                  </div>

                  {/* The Explicit "Save Backup Now" Button */}
                  <button
                    type="button"
                    id="save-backup-now-btn"
                    onClick={() => handleSaveBackupNow()}
                    disabled={isSavingManual}
                    className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl font-black text-xs transition shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {isSavingManual ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    ) : (
                      <Save className="w-4 h-4 text-slate-950" />
                    )}
                    <span>{isSavingManual ? 'Saving Backup...' : 'Save Backup Now'}</span>
                  </button>
                </div>

                {/* Status Notice if any */}
                {saveStatusMsg && (
                  <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fadeIn ${
                    saveStatusMsg.type === 'success' 
                      ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                      : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                  }`}>
                    {saveStatusMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="flex-1 break-words">{saveStatusMsg.text}</span>
                  </div>
                )}

                {/* Last Local Backup Information */}
                <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Last Saved:</span>
                    <strong className="text-slate-200">
                      {config.lastLocalBackupAt 
                        ? formatDateTimeDDMMYYYY(config.lastLocalBackupAt) 
                        : 'No backup saved yet today'}
                    </strong>
                  </div>
                  {config.lastLocalBackupFile && (
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-full sm:max-w-xs">
                      📁 {config.lastLocalBackupFile}
                    </div>
                  )}
                </div>
              </div>

              {/* Automated Midnight Backup (12:00 AM) Control Card */}
              <div className="bg-slate-950/70 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                      <h4 className="text-sm font-black text-white">Automated Midnight Backup</h4>
                    </div>
                    <p className="text-xs text-slate-400">
                      Automatically saves/updates encrypted ledgers every day at 12:00 AM.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !midnightAuto;
                      setMidnightAuto(next);
                      handleUpdateConfig({ midnightAutoBackup: next });
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      midnightAuto ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        midnightAuto ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Destination Local Storage & Folder Selector */}
                <div className="bg-slate-900/90 p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      Backup Save-na Hmun (Storage Location):
                    </span>
                    <button
                      type="button"
                      id="choose-backup-folder-btn"
                      onClick={() => setShowLocationPicker(true)}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white rounded-lg text-xs font-bold border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Thlak / Thlang Rawh</span>
                    </button>
                  </div>

                  {/* Active Storage Location Display */}
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {storageMode === 'directory_handle' ? (
                        <Laptop className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : storageMode === 'opfs' ? (
                        <Layers className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : (
                        <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="text-emerald-400 font-bold block truncate font-mono text-[11.5px]">
                          {folderName}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {storageMode === 'directory_handle'
                            ? 'PC HDD Direct Folder (File System Access)'
                            : storageMode === 'opfs'
                            ? 'In-App Secure Storage (OPFS Sandbox)'
                            : 'Device Downloads Folder (Standard Phone Storage)'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-sans self-start sm:self-auto shrink-0">
                      {config.hasFolderHandle ? 'Direct Access' : 'Auto-Save'}
                    </span>
                  </div>

                  <p className="text-[10.5px] text-slate-400">
                    💡 <b>Tip:</b> Phone-ah chuan i phone <b>"Download"</b> folder chhungah <b>/RonPay_Backups/</b> tiin a save nghal ziah e.
                  </p>
                </div>

                {/* Backup Format Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">
                    Backup Format:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setBackupFormat('both');
                        handleUpdateConfig({ backupFormat: 'both' });
                      }}
                      className={`p-2 sm:p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                        backupFormat === 'both'
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-amber-400">
                        <Database className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-black text-[11px] sm:text-xs">JSON & CSV</span>
                      </div>
                      <p className="text-[9.5px] sm:text-[10px] text-slate-400 leading-tight">Ledger + Excel sheets</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBackupFormat('json');
                        handleUpdateConfig({ backupFormat: 'json' });
                      }}
                      className={`p-2 sm:p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                        backupFormat === 'json'
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-sky-400">
                        <FileCode className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-black text-[11px] sm:text-xs">JSON Ledger</span>
                      </div>
                      <p className="text-[9.5px] sm:text-[10px] text-slate-400 leading-tight">Fast restore snapshot</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setBackupFormat('csv');
                        handleUpdateConfig({ backupFormat: 'csv' });
                      }}
                      className={`p-2 sm:p-2.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                        backupFormat === 'csv'
                          ? 'bg-amber-500/20 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-emerald-400">
                        <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-black text-[11px] sm:text-xs">CSV Excel</span>
                      </div>
                      <p className="text-[9.5px] sm:text-[10px] text-slate-400 leading-tight">Excel & Sheets table</p>
                    </button>
                  </div>
                </div>

                {/* AES-GCM 256-bit Encryption Controls */}
                <div className="bg-slate-900/80 p-3 sm:p-3.5 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <h5 className="text-xs font-black text-white">Military-Grade AES-GCM 256 Encryption</h5>
                        <p className="text-[10.5px] text-slate-400">PBKDF2 key derivation with 100,000 rounds</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !encryptionEnabled;
                        setEncryptionEnabled(next);
                        handleUpdateConfig({ encryptionEnabled: next });
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        encryptionEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          encryptionEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {encryptionEnabled && (
                    <div className="pt-2 border-t border-slate-800 space-y-2 animate-fadeIn">
                      <label className="text-[11px] font-bold text-slate-300 block">
                        Encryption Passphrase (Optional - Leave blank for default platform security):
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={encryptionPassword}
                          onChange={(e) => {
                            setEncryptionPassword(e.target.value);
                            handleUpdateConfig({ encryptionPassword: e.target.value });
                          }}
                          placeholder="Passphrase (minimum 4 characters) or blank"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-400 font-mono pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Verification / Decrypt tool trigger */}
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-400">Decryption verify na:</span>
                    <button
                      type="button"
                      onClick={() => setIsVerifyOpen(!isVerifyOpen)}
                      className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Key className="w-3 h-3" />
                      <span>{isVerifyOpen ? 'Hide Decrypt Tester' : 'Test Decrypt / Verify Backup'}</span>
                    </button>
                  </div>

                  {/* Decrypt Tester Panel */}
                  {isVerifyOpen && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-xs animate-fadeIn">
                      <p className="text-[11px] text-slate-300 font-bold">Paste Encrypted Backup Envelope JSON:</p>
                      <textarea
                        value={verifyFileContent}
                        onChange={(e) => setVerifyFileContent(e.target.value)}
                        placeholder='{"ronpay_envelope": true, "ciphertext": "...", ...}'
                        rows={3}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-[10.5px] font-mono text-slate-200 focus:outline-hidden"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          value={verifyPassword}
                          onChange={(e) => setVerifyPassword(e.target.value)}
                          placeholder="Password (if custom)"
                          className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleRunDecryptTest}
                          disabled={isDecrypting}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          {isDecrypting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                          <span>Decrypt & Check</span>
                        </button>
                      </div>

                      {verifyResult && (
                        <div className={`p-2.5 rounded-lg border text-[11px] font-mono whitespace-pre-wrap ${
                          verifyResult.success ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200' : 'bg-rose-950/80 border-rose-600 text-rose-200'
                        }`}>
                          {verifyResult.success ? verifyResult.preview : verifyResult.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Direct Instant Download Options */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSaveBackupNow('json')}
                    disabled={isSavingManual}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Download JSON</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveBackupNow('csv')}
                    disabled={isSavingManual}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Download CSV (Excel)</span>
                  </button>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* RESTORE DATABASE BACKUP CARD                                   */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-slate-950/80 p-3.5 sm:p-4 rounded-2xl border border-indigo-900/60 shadow-lg space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-400 shrink-0" />
                      <h4 className="text-sm font-black text-white">Restore Backup (File Dah Lette)</h4>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        JSON & Encrypted
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      I device-a backup file (<code className="text-indigo-300">.json</code> / <code className="text-amber-300">.enc.json</code>) thlang la, records zawng zawng dah let rawh.
                    </p>
                  </div>

                  <button
                    type="button"
                    id="upload-restore-backup-btn"
                    onClick={() => restoreFileInputRef.current?.click()}
                    disabled={isRestoring}
                    className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30 active:scale-95 disabled:opacity-50 shrink-0 self-start sm:self-auto"
                  >
                    {isRestoring ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isRestoring ? 'Restoring Records...' : 'Upload & Restore File'}</span>
                  </button>

                  <input
                    type="file"
                    ref={restoreFileInputRef}
                    accept=".json,.enc.json,application/json"
                    onChange={handleRestoreFileSelected}
                    className="hidden"
                  />
                </div>

                {/* Restore Result Notice */}
                {restoreStatus && (
                  <div className={`p-3 rounded-xl border text-xs font-semibold animate-fadeIn ${
                    restoreStatus.success
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                      : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
                  }`}>
                    <div className="flex items-start gap-2">
                      {restoreStatus.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-1.5">
                        <p className="font-bold">{restoreStatus.message}</p>
                        {restoreStatus.counts && (
                          <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono">
                            <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50">
                              💳 {restoreStatus.counts.transactions ?? 0} Txns
                            </span>
                            <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50">
                              🎯 {restoreStatus.counts.campaigns ?? 0} Campaigns
                            </span>
                            <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50">
                              👥 {restoreStatus.counts.members ?? 0} Members
                            </span>
                            <span className="bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700/50">
                              📋 {restoreStatus.counts.expenses ?? 0} Expenses
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Encrypted Passphrase Prompt Modal/Inline Card */}
                {restorePassphrasePrompt && (
                  <div className="bg-slate-900 p-3 rounded-xl border border-amber-500/40 space-y-2 animate-fadeIn text-xs">
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Encrypted Backup Detect A Ni ({pendingFileName || 'File'}):</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      He backup file hi AES-GCM 256-bit hmanga encrypt a ni. Khawngaihin a password / passphrase dah lut rawh le:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={customRestorePassphrase}
                        onChange={(e) => setCustomRestorePassphrase(e.target.value)}
                        placeholder="Passphrase (a awm loh chuan blank dah rawh)"
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-amber-400 focus:outline-hidden"
                      />
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setRestorePassphrasePrompt(false);
                            setPendingEncryptedFileContent(null);
                          }}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDecryptAndRestoreSubmit}
                          disabled={isRestoring}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isRestoring ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                          <span>Decrypt & Restore</span>
                        </button>
                      </div>
                    </div>
                    {restorePassphraseError && (
                      <p className="text-[11px] text-rose-400 font-bold">{restorePassphraseError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: OPTIONAL EMAIL BACKUP & SYNC */}
          {activeTab === 'email' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-950/70 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-4">
                
                {/* Optional ON/OFF Toggle Switch */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-indigo-400 shrink-0" />
                      <h3 className="text-sm font-black text-white">Optional Email Backup & Sync</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Enable or disable automated email digests and manual backup notifications.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !emailEnabled;
                      setEmailEnabled(next);
                      handleUpdateConfig({ emailBackupEnabled: next });
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      emailEnabled ? 'bg-indigo-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        emailEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Email Form Fields */}
                <div className={`space-y-3 transition-opacity ${emailEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      Recipient Email Address:
                    </label>
                    <input
                      type="email"
                      value={emailRecipient}
                      onChange={(e) => {
                        setEmailRecipient(e.target.value);
                        handleUpdateConfig({ emailRecipient: e.target.value });
                      }}
                      placeholder="e.g. bethelcomputercentrelunglei@gmail.com"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10.5px] text-slate-400 mt-1">
                      Default: Bethel Computer Centre Lunglei account
                    </p>
                  </div>

                  {/* Weekly Sunday Midnight Auto-Digest */}
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                    <div className="pr-2">
                      <span className="text-xs font-bold text-slate-200 block">
                        Weekly Auto-Digest (Every Sunday Midnight)
                      </span>
                      <span className="text-[10.5px] text-slate-400 block">
                        Automated weekly summary sent every Sunday at 12:00 AM
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !emailWeeklyDigest;
                        setEmailWeeklyDigest(next);
                        handleUpdateConfig({ emailWeeklyDigest: next });
                      }}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        emailWeeklyDigest ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          emailWeeklyDigest ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Manual "Send Email Backup Now" Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      id="send-email-backup-now-btn"
                      onClick={handleSendEmailNow}
                      disabled={isSendingEmail || !emailRecipient}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      {isSendingEmail ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>{isSendingEmail ? 'Sending Email Backup...' : 'Send Email Backup Now'}</span>
                    </button>
                  </div>

                  {/* Status / Notice */}
                  {emailStatusMsg && (
                    <div className={`p-3 rounded-xl border text-xs font-bold space-y-2 animate-fadeIn ${
                      emailStatusMsg.type === 'success' 
                        ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                        : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                    }`}>
                      <div className="flex items-center gap-2">
                        {emailStatusMsg.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{emailStatusMsg.text}</span>
                      </div>
                      {emailStatusMsg.mailtoUrl && (
                        <a
                          href={emailStatusMsg.mailtoUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Open in Gmail / Email Client</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Last Email Backup timestamp */}
                  {config.lastEmailBackupAt && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>Last email sent: {formatDateTimeDDMMYYYY(config.lastEmailBackupAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPTIONAL WHATSAPP BACKUP */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="bg-slate-950/70 p-3.5 sm:p-4 rounded-2xl border border-slate-800 space-y-4">
                
                {/* Optional ON/OFF Toggle Switch */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      <h3 className="text-sm font-black text-white">Optional WhatsApp Backup & Sharing</h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Share formatted financial reports and backup exports directly to WhatsApp.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !whatsappEnabled;
                      setWhatsappEnabled(next);
                      handleUpdateConfig({ whatsappBackupEnabled: next });
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      whatsappEnabled ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        whatsappEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* WhatsApp Config Content */}
                <div className={`space-y-3 transition-opacity ${whatsappEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">
                      WhatsApp Phone Number (with Country Code):
                    </label>
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => {
                        setWhatsappNumber(e.target.value);
                        handleUpdateConfig({ whatsappNumber: e.target.value });
                      }}
                      placeholder="e.g. 9862000001 or +919862000001"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                    />
                  </div>

                  {/* Summary Preview Box */}
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
                    <span className="font-bold text-emerald-400 block text-[11px]">Included in WhatsApp Message:</span>
                    <p className="text-[11px] text-slate-400">
                      • Total Collected Amount & Transaction Count (106 records)<br />
                      • Bawm / Campaign breakdown with amounts<br />
                      • Member counts & total expenses<br />
                      • Authenticated timestamp & SSOT verification badge
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      id="share-whatsapp-backup-btn"
                      onClick={handleShareWhatsApp}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share WhatsApp Summary Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveBackupNow('csv')}
                      className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-emerald-400" />
                      <span>Export File to Attach</span>
                    </button>
                  </div>

                  {config.lastWhatsappShareAt && (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>Last shared: {formatDateTimeDDMMYYYY(config.lastWhatsappShareAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP HISTORY & AUDIT */}
          {activeTab === 'history' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Backup & Sync Sulhnu (History)</h4>
                  <span className="text-[10.5px] text-slate-500">{history.length} snapshots saved</span>
                </div>

                {history.length > 0 && (
                  <div>
                    {confirmClearHistory ? (
                      <div className="flex items-center gap-1.5 animate-fadeIn">
                        <button
                          type="button"
                          onClick={handleClearHistory}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-black cursor-pointer shadow-xs"
                        >
                          Confirm Phiat
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmClearHistory(false)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="clear-backup-history-btn"
                        onClick={() => setConfirmClearHistory(true)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear History</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {history.length === 0 ? (
                <div className="text-center py-8 bg-slate-950/50 rounded-2xl border border-slate-800 text-slate-400 text-xs space-y-1">
                  <Database className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="font-bold text-slate-300">Backup history a ruak rih e.</p>
                  <p className="text-[10.5px] text-slate-500">"Save Backup Now" hmet la, snapshot thar vawng rawh le.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${item.status === 'success' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                          <span className="font-bold text-white truncate">{item.summary}</span>
                          {item.isEncrypted && (
                            <span className="text-[9.5px] bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800 font-mono shrink-0">
                              AES-GCM
                            </span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400">
                          {formatDateTimeDDMMYYYY(item.timestamp)} • Format: <span className="uppercase text-slate-300 font-semibold">{item.format}</span>
                          {item.fileName && <span className="hidden sm:inline font-mono text-[9.5px] text-slate-500 ml-1">({item.fileName})</span>}
                        </p>
                      </div>

                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                        item.status === 'success' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-[10.5px] sm:text-[11px] truncate">RonPay Zero-Loss Financial Ledger Architecture</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition cursor-pointer shrink-0"
          >
            Close
          </button>
        </div>

        </>
      )}

      </div>

      {/* STORAGE & FOLDER LOCATION PICKER MODAL (SOLVES POINT C FOR MOBILE & DESKTOP) */}
      {showLocationPicker && (
        <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-4 sm:p-5 space-y-4 text-slate-100">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Save-na Hmun Thlang Rawh</h3>
                  <p className="text-[10.5px] text-slate-400">Choose storage destination for ledgers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Error / Notice message if any */}
            {locationPickerMsg && (
              <div className="p-2.5 bg-amber-950/70 border border-amber-500/50 rounded-xl text-amber-200 text-xs font-medium flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{locationPickerMsg}</span>
              </div>
            )}

            {/* Option 1: Mobile & PC Downloads Folder (Recommended) */}
            <div 
              onClick={() => handleSelectStorageMode('downloads')}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                storageMode === 'downloads'
                  ? 'bg-emerald-950/50 border-emerald-500 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">Device Downloads Folder</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.2 rounded">Recommended</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Phone (Android / iPhone) leh PC "Download" folder chhungah /RonPay_Backups/ tiin a lut nghal ziah ang. File Manager-ah awlsam takin a hmuh theih.
                </p>
                <span className="text-[10px] text-emerald-400 font-mono block mt-1">
                  Path: Download/RonPay_Backups/
                </span>
              </div>
            </div>

            {/* Option 2: Direct PC / HDD Directory Picker (File System Access) */}
            <div 
              onClick={handlePickDesktopDirectory}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                storageMode === 'directory_handle'
                  ? 'bg-sky-950/50 border-sky-500 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                <Laptop className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">Choose PC / HDD Folder</span>
                  <span className="text-[9px] bg-sky-500/20 text-sky-400 font-bold px-1.5 py-0.2 rounded">Desktop</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Computer (Chrome / Edge) ah i HDD, USB Drive emaw SSD folder thlang la, direct-in permission pein a save nghal ang.
                </p>
                {isFileSystemAccessSupported() ? (
                  <span className="text-[10px] text-sky-400 font-bold block mt-1">
                    ✓ Browser Supported (Click to browse folder)
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 block mt-1">
                    (Mobile browser-ah chuan Downloads hmang rawh le)
                  </span>
                )}
              </div>
            </div>

            {/* Option 3: In-App Secure Storage (OPFS Sandbox) */}
            <div 
              onClick={() => handleSelectStorageMode('opfs')}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-start gap-3 ${
                storageMode === 'opfs'
                  ? 'bg-purple-950/50 border-purple-500 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-black text-white block">In-App Secure Storage (OPFS Sandbox)</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  App private device storage chhungah him takin a vawng reng a, permission dil buai ngai lovin offline-in a in-save ziah ang.
                </p>
              </div>
            </div>

            {/* Option 4: Custom Folder Label */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] font-bold text-slate-300 block">
                Custom Folder / Directory Name (Optional):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={customFolderInput}
                  onChange={(e) => setCustomFolderInput(e.target.value)}
                  placeholder="e.g. RonPay_Ledger_2026 or SDCard/Ledgers"
                  className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customFolderInput.trim()) {
                      handleSelectStorageMode('custom', customFolderInput.trim());
                    }
                  }}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold cursor-pointer transition shrink-0"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowLocationPicker(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Done / Cancel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
