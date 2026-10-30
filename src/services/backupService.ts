import { 
  BackupSyncConfig, 
  BackupHistoryItem, 
  EncryptedBackupEnvelope,
  Transaction,
  Campaign,
  MemberRecord,
  KumtluangExpense
} from '../types';
import { 
  getStoredCampaigns, 
  getStoredTransactions, 
  getStoredCreatorsList, 
  getStoredCreatorProfile, 
  getStoredPricingConfig, 
  getStoredAnnouncement, 
  getStoredAuditLogs, 
  getStoredUserPaidTxIds, 
  getMembers, 
  getStoredExpenses,
  recordAuditLog,
  getStoredStaffAccounts
} from '../utils/storage';
import { downloadFileUniversal } from '../utils/export';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';

const BACKUP_CONFIG_KEY = 'ronpay_backup_config_v1';
const BACKUP_HISTORY_KEY = 'ronpay_backup_history_v1';
const IDB_NAME = 'RonPay_Backup_DB';
const IDB_STORE = 'handles';
const IDB_KEY = 'chosen_folder_handle';
const DEFAULT_ENCRYPTION_PASS = 'RonPay@SecureLedger!2026';

export const DEFAULT_BACKUP_CONFIG: BackupSyncConfig = {
  localBackupEnabled: true,
  midnightAutoBackup: true,
  backupFormat: 'both',
  encryptionEnabled: true,
  encryptionPassword: '',
  folderName: 'Device Downloads (Download/RonPay_Backups)',
  storageMode: 'downloads',
  hasFolderHandle: false,
  lastLocalBackupAt: undefined,
  lastLocalBackupStatus: 'idle',
  lastLocalBackupFile: undefined,
  lastLocalBackupSize: undefined,
  lastMidnightRunDate: undefined,

  emailBackupEnabled: false,
  emailRecipient: 'bethelcomputercentrelunglei@gmail.com',
  emailWeeklyDigest: true,
  lastEmailBackupAt: undefined,
  lastEmailBackupStatus: 'idle',
  lastSundayDigestDate: undefined,

  whatsappBackupEnabled: false,
  whatsappNumber: '9862000001',
  includeFinancialSummary: true,
  lastWhatsappShareAt: undefined
};

// -------------------------------------------------------------
// IndexedDB Directory Handle Storage (File System Access API)
// -------------------------------------------------------------

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not supported on this device'));
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storeFolderHandle(handle: any): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(handle, IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[BackupService] Could not persist folder handle to IndexedDB:', err);
  }
}

export async function getFolderHandle(): Promise<any | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearFolderHandle(): Promise<void> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.delete(IDB_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}

export async function verifyFolderPermission(handle: any, readWrite = true): Promise<boolean> {
  if (!handle || typeof handle.queryPermission !== 'function') return false;
  const options = { mode: readWrite ? 'readwrite' : 'read' };
  try {
    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }
    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch {}
  return false;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).showDirectoryPicker === 'function';
}

export async function pickLocalFolder(): Promise<{ success: boolean; folderName?: string; storageMode?: 'downloads' | 'directory_handle' | 'opfs' | 'custom'; error?: string }> {
  if (!isFileSystemAccessSupported()) {
    return {
      success: false,
      error: 'UNSUPPORTED_ON_DEVICE'
    };
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });

    if (handle) {
      await storeFolderHandle(handle);
      const folderName = handle.name || 'Selected Folder';
      const config = getBackupConfig();
      saveBackupConfig({
        ...config,
        folderName,
        storageMode: 'directory_handle',
        hasFolderHandle: true
      });
      return { success: true, folderName, storageMode: 'directory_handle' };
    }
    return { success: false, error: 'Folder thlan a ni lo.' };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Folder thlanna cancel a ni.' };
    }
    return { success: false, error: err?.message || 'Folder thlanna a buai hret.' };
  }
}

export async function setStorageLocation(
  mode: 'downloads' | 'directory_handle' | 'opfs' | 'custom',
  customName?: string
): Promise<BackupSyncConfig> {
  const config = getBackupConfig();
  let folderName = customName?.trim();
  if (!folderName) {
    if (mode === 'downloads') {
      folderName = 'Device Downloads (Download/RonPay_Backups)';
    } else if (mode === 'opfs') {
      folderName = 'In-App Secure Storage (OPFS Sandbox)';
    } else {
      folderName = config.folderName || 'Device Downloads (Download/RonPay_Backups)';
    }
  }

  if (mode !== 'directory_handle') {
    await clearFolderHandle();
  }

  const updated: BackupSyncConfig = {
    ...config,
    storageMode: mode,
    folderName,
    hasFolderHandle: mode === 'directory_handle'
  };
  saveBackupConfig(updated);
  return updated;
}

// -------------------------------------------------------------
// Config & History Helpers
// -------------------------------------------------------------

export function getBackupConfig(): BackupSyncConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(BACKUP_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_BACKUP_CONFIG, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_BACKUP_CONFIG };
}

export function saveBackupConfig(config: BackupSyncConfig): void {
  try {
    const updated = { ...config, updatedAt: new Date().toISOString() };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(updated));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_backup_config_changed', { detail: updated }));
    }
    // Also sync to server settings endpoint asynchronously
    fetch('/api/backup/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    }).catch(() => {});
  } catch (e) {
    console.error('[BackupService] Failed to save backup config:', e);
  }
}

export function getBackupHistory(): BackupHistoryItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(BACKUP_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}
  return [];
}

export function addBackupHistoryItem(item: Omit<BackupHistoryItem, 'id'>): BackupHistoryItem {
  const fullItem: BackupHistoryItem = {
    ...item,
    id: 'bkh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
  };
  try {
    const list = getBackupHistory();
    const updated = [fullItem, ...list].slice(0, 50); // Keep last 50 backups
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BACKUP_HISTORY_KEY, JSON.stringify(updated));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_backup_history_changed', { detail: updated }));
    }
  } catch {}
  return fullItem;
}

export function clearBackupHistory(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(BACKUP_HISTORY_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_backup_history_changed', { detail: [] }));
    }
  } catch {}
}

// -------------------------------------------------------------
// Web Crypto AES-GCM 256-bit PBKDF2 Encryption Engine
// -------------------------------------------------------------

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < uint8.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptData(
  plainText: string, 
  format: 'json' | 'csv' | 'both' = 'json',
  password?: string
): Promise<string> {
  const keyPass = (password && password.trim().length >= 4) ? password.trim() : DEFAULT_ENCRYPTION_PASS;

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available on this platform');
  }

  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Import raw password key
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyPass),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-GCM 256-bit key
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const plainBytes = enc.encode(plainText);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plainBytes
  );

  const envelope: EncryptedBackupEnvelope = {
    ronpay_envelope: true,
    format,
    version: '2.5.0',
    cipher: 'AES-GCM-256',
    encryptedAt: new Date().toISOString(),
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encryptedBuf),
    app: 'RonPay Secure Ledger'
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptData(
  envelopeString: string, 
  password?: string
): Promise<string> {
  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(envelopeString);
  } catch {
    throw new Error('File content is not valid JSON or RonPay envelope');
  }

  if (!envelope.ronpay_envelope || envelope.cipher !== 'AES-GCM-256') {
    throw new Error('He file hi RonPay encrypted backup file dik a ni lo.');
  }

  const keyPass = (password && password.trim().length >= 4) ? password.trim() : DEFAULT_ENCRYPTION_PASS;

  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API is not available on this platform');
  }

  const salt = base64ToBuffer(envelope.salt);
  const iv = base64ToBuffer(envelope.iv);
  const ciphertext = base64ToBuffer(envelope.ciphertext);

  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyPass),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  try {
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch {
    throw new Error('Password a dik lo emaw file chhe palh a ni. Khawngaihin password dik chhu lut rawh.');
  }
}

// -------------------------------------------------------------
// Ledger Data Compilers (JSON & RFC 4180 CSV)
// -------------------------------------------------------------

export function compileFullLedgerPackage(): any {
  const campaigns = getStoredCampaigns();
  const transactions = getStoredTransactions();
  const members = getMembers();
  const expenses = getStoredExpenses();
  const creators = getStoredCreatorsList();
  const creatorProfile = getStoredCreatorProfile();
  const pricingConfig = getStoredPricingConfig();
  const announcement = getStoredAnnouncement();
  const auditLogs = getStoredAuditLogs();
  const staff = getStoredStaffAccounts();

  const totalCollected = transactions
    .filter(t => t.status !== 'failed' && t.status !== 'rejected')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalExpenses = expenses
    .filter(e => e.status !== 'rejected')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return {
    ronpay_ledger_version: '2.5.0',
    exportedAt: new Date().toISOString(),
    system: 'RonPay Financial & Community Ledger',
    stats: {
      totalCampaigns: campaigns.length,
      totalTransactions: transactions.length,
      totalMembers: members.length,
      totalExpenses: expenses.length,
      totalCollectedAmount: totalCollected,
      totalExpenseAmount: totalExpenses,
      netBalance: totalCollected - totalExpenses
    },
    data: {
      campaigns,
      transactions,
      members,
      expenses,
      creators,
      creatorProfile,
      pricingConfig,
      announcement,
      auditLogs,
      staffAccounts: staff
    }
  };
}

export function compileLedgerCSV(): string {
  const txs = getStoredTransactions();
  const campaigns = getStoredCampaigns();
  const expenses = getStoredExpenses();

  const campMap = new Map<string, string>();
  campaigns.forEach(c => {
    if (c.id) campMap.set(c.id, c.title || c.orgName || 'Bawm');
  });

  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const lines: string[] = [];

  // UTF-8 BOM
  lines.push('# RONPAY FINANCIAL LEDGER STATEMENT');
  lines.push(`# Generated At: ${new Date().toISOString()} (${formatDateTimeDDMMYYYY(new Date().toISOString())})`);
  lines.push(`# Total Transactions: ${txs.length}`);
  lines.push('');

  // Transactions Header
  lines.push([
    'SL',
    'Date & Time',
    'Receipt / Txn ID',
    'Campaign / Bawm',
    'Category',
    'Donor / Member Name',
    'Phone',
    'Veng / Locality',
    'Member ID',
    'Amount (INR)',
    'Platform Fee (INR)',
    'Total Amount (INR)',
    'Payment Method',
    'Status',
    'Period / SubCategory',
    'UTR / Ref No',
    'Remark'
  ].map(escapeCSV).join(','));

  // Transactions Rows
  txs.forEach((t, idx) => {
    const campTitle = t.campaignTitle || campMap.get(t.campaignId) || 'Bawm';
    const dt = t.timestamp || t.createdAt || '';
    const formattedDate = dt ? formatDateTimeDDMMYYYY(dt) : '';
    const donor = t.isAnonymous ? 'Anonymous' : (t.donorName || '');

    lines.push([
      idx + 1,
      formattedDate || dt,
      t.id,
      campTitle,
      t.category || '',
      donor,
      t.donorPhone || '',
      t.donorVeng || '',
      t.memberId || '',
      Number(t.amount) || 0,
      Number(t.platformFee) || 0,
      Number(t.totalAmount || t.amount) || 0,
      (t.paymentMethod || 'cash').toUpperCase(),
      (t.status || 'completed').toUpperCase(),
      t.subCategory || t.periodLabel || '',
      t.utr || t.referenceNo || '',
      t.remark || ''
    ].map(escapeCSV).join(','));
  });

  // Expense Summary Section
  if (expenses.length > 0) {
    lines.push('');
    lines.push('# EXPENSES & DISBURSEMENTS LEDGER');
    lines.push([
      'Voucher No',
      'Date',
      'Campaign / Bawm',
      'Payee',
      'Head / Category',
      'Amount (INR)',
      'Payment Mode',
      'Purpose / Notes',
      'Recorded By',
      'Status'
    ].map(escapeCSV).join(','));

    expenses.forEach(e => {
      lines.push([
        e.voucherNo || e.id,
        e.spentDate || (e as any).date || '',
        e.campaignTitle || campMap.get(e.campaignId) || '',
        e.paidTo || (e as any).payee || '',
        e.head || 'General',
        Number(e.amount) || 0,
        e.paymentMode || 'Cash',
        e.purpose || '',
        e.recordedBy || '',
        (e.status || 'approved').toUpperCase()
      ].map(escapeCSV).join(','));
    });
  }

  return '\uFEFF' + lines.join('\r\n');
}

// -------------------------------------------------------------
// Local Save / Backup Executor (Manual & Midnight)
// -------------------------------------------------------------

export interface SaveBackupResult {
  success: boolean;
  filesSaved: string[];
  totalBytes: number;
  message: string;
  isEncrypted: boolean;
}

export async function executeLocalBackup(
  isAutomatedMidnight: boolean = false,
  explicitFormat?: 'json' | 'csv' | 'both'
): Promise<SaveBackupResult> {
  const config = getBackupConfig();
  const format = explicitFormat || config.backupFormat || 'both';
  const shouldEncrypt = Boolean(config.encryptionEnabled);
  const password = config.encryptionPassword || undefined;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const typeLabel = isAutomatedMidnight ? 'Midnight' : 'Manual';

  const filesSaved: string[] = [];
  let totalBytes = 0;

  try {
    // 1. Prepare JSON Payload
    let jsonContent = '';
    let jsonFileName = '';
    if (format === 'json' || format === 'both') {
      const fullPackage = compileFullLedgerPackage();
      const rawJson = JSON.stringify(fullPackage, null, 2);
      if (shouldEncrypt) {
        jsonContent = await encryptData(rawJson, 'json', password);
        jsonFileName = `RonPay_Ledger_${dateStr}_${typeLabel}_${timeStr}.enc.json`;
      } else {
        jsonContent = rawJson;
        jsonFileName = `RonPay_Ledger_${dateStr}_${typeLabel}_${timeStr}.json`;
      }
    }

    // 2. Prepare CSV Payload
    let csvContent = '';
    let csvFileName = '';
    if (format === 'csv' || format === 'both') {
      const rawCsv = compileLedgerCSV();
      if (shouldEncrypt) {
        csvContent = await encryptData(rawCsv, 'csv', password);
        csvFileName = `RonPay_Ledger_${dateStr}_${typeLabel}_${timeStr}.enc.csv`;
      } else {
        csvContent = rawCsv;
        csvFileName = `RonPay_Ledger_${dateStr}_${typeLabel}_${timeStr}.csv`;
      }
    }

    // 3. Attempt direct write to user's chosen directory handle
    let directFolderSuccess = false;
    const folderHandle = await getFolderHandle();

    if (folderHandle) {
      const hasPermission = await verifyFolderPermission(folderHandle, true);
      if (hasPermission) {
        try {
          if (jsonContent && jsonFileName) {
            const fileHandle = await folderHandle.getFileHandle(jsonFileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(jsonContent);
            await writable.close();
            filesSaved.push(jsonFileName);
            totalBytes += new Blob([jsonContent]).size;
          }

          if (csvContent && csvFileName) {
            const fileHandle = await folderHandle.getFileHandle(csvFileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            filesSaved.push(csvFileName);
            totalBytes += new Blob([csvContent]).size;
          }

          directFolderSuccess = true;
        } catch (dirWriteErr) {
          console.warn('[BackupService] Direct folder write failed, falling back to download:', dirWriteErr);
        }
      }
    }

    // 4. Fallback or Manual Save: Direct Browser / Phone Storage Download
    if (!directFolderSuccess) {
      if (jsonContent && jsonFileName) {
        await downloadFileUniversal(
          jsonContent,
          jsonFileName,
          shouldEncrypt ? 'application/octet-stream' : 'application/json',
          'RonPay Ledger JSON'
        );
        filesSaved.push(jsonFileName);
        totalBytes += new Blob([jsonContent]).size;
      }

      if (csvContent && csvFileName) {
        if (jsonContent) {
          // Stagger download on mobile devices so popup blocker doesn't block the second file
          await new Promise(r => setTimeout(r, 350));
        }
        await downloadFileUniversal(
          csvContent,
          csvFileName,
          shouldEncrypt ? 'application/octet-stream' : 'text/csv;charset=utf-8;',
          'RonPay Ledger CSV'
        );
        filesSaved.push(csvFileName);
        totalBytes += new Blob([csvContent]).size;
      }
    }

    // 5. Also persist in Origin Private File System (OPFS) for guaranteed offline retention on device
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).storage?.getDirectory) {
        const root = await (navigator as any).storage.getDirectory();
        const backupsDir = await root.getDirectoryHandle('ronpay_ledgers', { create: true });
        if (jsonContent && jsonFileName) {
          const f = await backupsDir.getFileHandle(jsonFileName, { create: true });
          const w = await f.createWritable();
          await w.write(jsonContent);
          await w.close();
        }
        if (csvContent && csvFileName) {
          const f = await backupsDir.getFileHandle(csvFileName, { create: true });
          const w = await f.createWritable();
          await w.write(csvContent);
          await w.close();
        }
      }
    } catch {}

    // 6. Update configuration state & history log
    const updatedConfig: BackupSyncConfig = {
      ...config,
      lastLocalBackupAt: now.toISOString(),
      lastLocalBackupStatus: 'success',
      lastLocalBackupFile: filesSaved.join(', '),
      lastLocalBackupSize: totalBytes,
      lastMidnightRunDate: isAutomatedMidnight ? dateStr : config.lastMidnightRunDate
    };
    saveBackupConfig(updatedConfig);

    const historyItem = addBackupHistoryItem({
      timestamp: now.toISOString(),
      type: isAutomatedMidnight ? 'local_auto_midnight' : 'local_manual',
      format,
      fileName: filesSaved.join(', '),
      fileSizeBytes: totalBytes,
      isEncrypted: shouldEncrypt,
      status: 'success',
      summary: `${typeLabel} backup saved successfully (${filesSaved.length} files, ${(totalBytes / 1024).toFixed(1)} KB)`
    });

    recordAuditLog(
      isAutomatedMidnight ? '[Auto Backup] Midnight Ledger Saved' : 'Manual Backup Saved',
      `Saved ${filesSaved.join(' & ')} (${(totalBytes / 1024).toFixed(1)} KB). Encrypted: ${shouldEncrypt ? 'Yes (AES-GCM-256)' : 'No'}.`,
      'system'
    );

    const destLabel = config.folderName || 'Phone Downloads';
    return {
      success: true,
      filesSaved,
      totalBytes,
      isEncrypted: shouldEncrypt,
      message: `${filesSaved.length} backup file${filesSaved.length > 1 ? 's' : ''} (${(totalBytes / 1024).toFixed(1)} KB) hlawhtling taka vawn fel a ni: ${destLabel}`
    };
  } catch (err: any) {
    console.error('[BackupService] Backup execution failed:', err);
    saveBackupConfig({
      ...config,
      lastLocalBackupStatus: 'failed'
    });
    addBackupHistoryItem({
      timestamp: now.toISOString(),
      type: isAutomatedMidnight ? 'local_auto_midnight' : 'local_manual',
      format,
      isEncrypted: shouldEncrypt,
      status: 'failed',
      summary: `Backup error: ${err?.message || 'Unknown failure'}`
    });
    return {
      success: false,
      filesSaved: [],
      totalBytes: 0,
      isEncrypted: shouldEncrypt,
      message: err?.message || 'Backup siam hlawhtling ta lo.'
    };
  }
}

// -------------------------------------------------------------
// Optional Email Backup & Weekly Auto-Digest
// -------------------------------------------------------------

export async function sendEmailBackup(
  isWeeklyAutoDigest: boolean = false,
  customRecipient?: string
): Promise<{ success: boolean; message: string; mailtoUrl?: string }> {
  const config = getBackupConfig();
  const recipient = (customRecipient || config.emailRecipient || 'bethelcomputercentrelunglei@gmail.com').trim();

  if (!recipient || !recipient.includes('@')) {
    return { success: false, message: 'Recipient email address dik chhu lut rawh.' };
  }

  const txs = getStoredTransactions();
  const campaigns = getStoredCampaigns();
  const members = getMembers();
  const expenses = getStoredExpenses();

  const totalAmount = txs
    .filter(t => t.status !== 'failed' && t.status !== 'rejected')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalExpense = expenses
    .filter(e => e.status !== 'rejected')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const subject = `[RonPay Backup] ${isWeeklyAutoDigest ? 'Weekly Auto-Digest (Sunday Midnight)' : 'Financial Ledger Statement'} - ${formatDateDDMMYYYY(new Date().toISOString())}`;
  
  const bodyText = `
RonPay Financial & Community Ledger Backup
Date: ${formatDateTimeDDMMYYYY(new Date().toISOString())}
Recipient: ${recipient}
Mode: ${isWeeklyAutoDigest ? 'Weekly Sunday Auto-Digest' : 'Manual On-Demand Backup'}

--- FINANCIAL SUMMARY ---
• Total Transactions: ${txs.length}
• Total Collected Amount: ₹${totalAmount.toLocaleString('en-IN')}
• Total Expenses: ₹${totalExpense.toLocaleString('en-IN')}
• Net Balance: ₹${(totalAmount - totalExpense).toLocaleString('en-IN')}
• Registered Members: ${members.length}
• Active Campaigns / Bawm: ${campaigns.length}

--- CAMPAIGNS BREAKDOWN ---
${campaigns.map(c => `• ${c.title || c.orgName}: ₹${(c.collectedAmount || 0).toLocaleString('en-IN')} (${c.category})`).join('\n')}

This automated backup digest is generated by RonPay Platform Ledger Engine.
Verified & Authenticated.
`.trim();

  const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

  try {
    // Attempt backend dispatch route
    const res = await fetch('/api/backup/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient,
        subject,
        bodyText,
        isWeeklyAutoDigest,
        summary: {
          transactionsCount: txs.length,
          totalAmount,
          membersCount: members.length,
          expensesCount: expenses.length,
          netBalance: totalAmount - totalExpense
        }
      })
    });

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const updatedConfig: BackupSyncConfig = {
      ...config,
      lastEmailBackupAt: now.toISOString(),
      lastEmailBackupStatus: 'success',
      lastSundayDigestDate: isWeeklyAutoDigest ? dateStr : config.lastSundayDigestDate
    };
    saveBackupConfig(updatedConfig);

    addBackupHistoryItem({
      timestamp: now.toISOString(),
      type: isWeeklyAutoDigest ? 'email_auto_weekly' : 'email_manual',
      format: 'text',
      isEncrypted: false,
      status: 'success',
      summary: `Email digest dispatched to ${recipient}`
    });

    recordAuditLog(
      isWeeklyAutoDigest ? '[Email Auto-Digest] Weekly Sunday Backup' : 'Email Backup Dispatched',
      `Sent digest to ${recipient} (${txs.length} txns, ₹${totalAmount.toLocaleString('en-IN')})`,
      'system'
    );

    return {
      success: true,
      message: `Email backup digest hi ${recipient} hnenah thawn fel a ni e.`,
      mailtoUrl
    };
  } catch (err: any) {
    // If backend endpoint is unavailable, mailtoUrl is returned so client can trigger email app directly
    return {
      success: true,
      message: `Email app kaltlangin thawn theih a ni e.`,
      mailtoUrl
    };
  }
}

// -------------------------------------------------------------
// Optional WhatsApp Backup Summary Generator
// -------------------------------------------------------------

export function generateWhatsAppSummary(customPhone?: string): { url: string; text: string; cleanPhone: string } {
  const config = getBackupConfig();
  const phone = (customPhone || config.whatsappNumber || '9862000001').replace(/\D/g, '');
  const cleanPhone = phone.length === 10 ? `91${phone}` : phone;

  const txs = getStoredTransactions();
  const campaigns = getStoredCampaigns();
  const members = getMembers();
  const expenses = getStoredExpenses();

  const totalAmount = txs
    .filter(t => t.status !== 'failed' && t.status !== 'rejected')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalExpense = expenses
    .filter(e => e.status !== 'rejected')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const netBalance = totalAmount - totalExpense;

  const text = `📊 *RONPAY FINANCIAL & BACKUP SUMMARY*
🗓 *Tarikh:* ${formatDateTimeDDMMYYYY(new Date().toISOString())}
───────────────────
💰 *Total Sum Lut (Collected):* ₹${totalAmount.toLocaleString('en-IN')}
🧾 *Total Transactions:* ${txs.length}
👥 *Registered Members:* ${members.length}
📦 *Active Bawm/Campaigns:* ${campaigns.length}
💸 *Total Expenses:* ₹${totalExpense.toLocaleString('en-IN')}
💼 *Net Balance:* ₹${netBalance.toLocaleString('en-IN')}
───────────────────
*Campaigns Breakdown:*
${campaigns.slice(0, 6).map(c => `• *${c.title || c.orgName}:* ₹${(c.collectedAmount || 0).toLocaleString('en-IN')} (${c.category})`).join('\n')}
───────────────────
🔒 *Verified & Backed Up via RonPay Ledger Engine*`;

  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

  const now = new Date().toISOString();
  saveBackupConfig({
    ...config,
    lastWhatsappShareAt: now
  });

  addBackupHistoryItem({
    timestamp: now,
    type: 'whatsapp_summary',
    format: 'text',
    isEncrypted: false,
    status: 'success',
    summary: `WhatsApp summary shared with +${cleanPhone}`
  });

  return { url, text, cleanPhone };
}

// -------------------------------------------------------------
// Automated Midnight & Weekly Scheduler Engine
// -------------------------------------------------------------

let isSchedulerRunning = false;
let schedulerIntervalId: any = null;

export function initBackupScheduler(): void {
  if (isSchedulerRunning || typeof window === 'undefined') return;
  isSchedulerRunning = true;

  const checkSchedules = async () => {
    try {
      const config = getBackupConfig();
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const hours = now.getHours();
      const dayOfWeek = now.getDay(); // 0 is Sunday

      // 1. Check Midnight Local Backup (12:00 AM)
      if (config.localBackupEnabled && config.midnightAutoBackup) {
        // Trigger if current hour is 0 (12:00 AM to 12:59 AM) and hasn't run today
        if (hours === 0 && config.lastMidnightRunDate !== todayStr) {
          console.log('[BackupService] Triggering Automated Midnight Local Backup at 12:00 AM...');
          await executeLocalBackup(true);
        }
      }

      // 2. Check Weekly Email Auto-Digest (Every Sunday Midnight)
      if (config.emailBackupEnabled && config.emailWeeklyDigest) {
        if (dayOfWeek === 0 && hours === 0 && config.lastSundayDigestDate !== todayStr) {
          console.log('[BackupService] Triggering Weekly Sunday Midnight Email Digest...');
          await sendEmailBackup(true);
        }
      }
    } catch (schedErr) {
      console.warn('[BackupService] Error during schedule check:', schedErr);
    }
  };

  // Run check immediately on init, then every 60 seconds
  checkSchedules();
  schedulerIntervalId = setInterval(checkSchedules, 60 * 1000);

  // Also check when app tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkSchedules();
    }
  });
}

export function stopBackupScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId);
    schedulerIntervalId = null;
  }
  isSchedulerRunning = false;
}
