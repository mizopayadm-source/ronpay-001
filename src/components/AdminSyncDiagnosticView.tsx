import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Activity, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Database, 
  Cloud, 
  Smartphone, 
  Globe, 
  ArrowRight, 
  Search, 
  Filter, 
  Zap, 
  Check, 
  Copy, 
  Layers,
  ArrowUpDown,
  Trash2,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Info
} from 'lucide-react';
import { Campaign, Transaction } from '../types';
import { 
  getStoredTransactions, 
  getStoredCampaigns, 
  saveTransaction, 
  saveStoredTransactions,
  saveStoredCampaigns,
  getDeletedTransactionIds,
  markTransactionAsDeleted,
  isConfirmedTransaction
} from '../utils/storage';
import { 
  fetchFirestoreDiagnosticData, 
  FirestoreDiagnosticData, 
  performDeepAuditAndAutoRepair,
  DeepAuditResult,
  syncTransactionToFirestore, 
  syncCampaignToFirestore,
  deleteTransactionFromFirestore,
  deleteCampaignFromFirestore
} from '../services/firestoreSync';
import { 
  syncAllWithServer, 
  saveTransactionToServer, 
  saveCampaignToServer 
} from '../utils/syncEngine';
import { formatDateTimeDDMMYYYY } from '../utils/date';

export type DiscrepancyType = 
  | 'missing_in_cloud' 
  | 'missing_in_local' 
  | 'missing_in_server'
  | 'status_mismatch' 
  | 'amount_mismatch' 
  | 'tombstone_conflict';

export interface DiscrepancyItem {
  id: string;
  type: 'transaction' | 'campaign';
  title: string;
  subTitle?: string;
  discrepancyType: DiscrepancyType;
  severity: 'alert' | 'warning' | 'info';
  localData?: any;
  cloudData?: any;
  serverData?: any;
  description: string;
  descriptionMizo: string;
  suggestedAction: 'push_to_cloud' | 'pull_to_local' | 'push_to_server' | 'purge';
}

interface AdminSyncDiagnosticViewProps {
  localTransactions?: Transaction[];
  localCampaigns?: Campaign[];
  onRefreshParent?: () => void;
  onClose?: () => void;
}

export const AdminSyncDiagnosticView: React.FC<AdminSyncDiagnosticViewProps> = ({
  localTransactions: propLocalTx,
  localCampaigns: propLocalCamps,
  onRefreshParent,
  onClose
}) => {
  // Scanning state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScannedTime, setLastScannedTime] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Layer data states
  const [localTxList, setLocalTxList] = useState<Transaction[]>(() => propLocalTx || getStoredTransactions());
  const [localCampList, setLocalCampList] = useState<Campaign[]>(() => propLocalCamps || getStoredCampaigns());
  
  const [serverTxList, setServerTxList] = useState<Transaction[]>([]);
  const [serverCampList, setServerCampList] = useState<Campaign[]>([]);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  
  const [cloudTxList, setCloudTxList] = useState<Transaction[]>([]);
  const [cloudCampList, setCloudCampList] = useState<Campaign[]>([]);
  const [cloudTombstones, setCloudTombstones] = useState<string[]>([]);
  const [cloudStatus, setCloudStatus] = useState<string>('checking');
  const [cloudLatencyMs, setCloudLatencyMs] = useState<number>(0);

  // UI state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'discrepancies' | 'transactions' | 'campaigns'>('discrepancies');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<string>('all');
  const [reSyncingId, setReSyncingId] = useState<string | null>(null);
  const [isReSyncingAll, setIsReSyncingAll] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Deep Audit & Auto-Repair state
  const [auditResult, setAuditResult] = useState<DeepAuditResult | null>(null);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

  // Copy helper
  const handleCopyId = (id: string) => {
    navigator.clipboard?.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Run full cross-layer diagnostic scan
  const runDiagnosticScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);

    try {
      // 1. Refresh Local State
      const freshLocalTx = getStoredTransactions();
      const freshLocalCamps = getStoredCampaigns();
      setLocalTxList(freshLocalTx);
      setLocalCampList(freshLocalCamps);

      // 2. Fetch Server/Mock DB Layer (/api/data/sync)
      try {
        setServerStatus('checking');
        const serverState = await syncAllWithServer(false);
        if (serverState) {
          setServerTxList(serverState.transactions || []);
          setServerCampList(serverState.campaigns || []);
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch (srvErr) {
        console.warn('Server diagnostic sync note:', srvErr);
        setServerStatus('offline');
      }

      // 3. Fetch Cloud Firestore Production Layer (Direct server bypass)
      try {
        setCloudStatus('checking');
        const firestoreDiag = await fetchFirestoreDiagnosticData(5000);
        setCloudTxList(firestoreDiag.firestoreTransactions || []);
        setCloudCampList(firestoreDiag.firestoreCampaigns || []);
        setCloudTombstones(firestoreDiag.deletedTransactionIds || []);
        setCloudStatus(firestoreDiag.firestoreStatus);
        setCloudLatencyMs(firestoreDiag.latencyMs);
      } catch (cldErr: any) {
        console.warn('Firestore diagnostic read error:', cldErr);
        setCloudStatus('error');
      }

      setLastScannedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      setScanError(err?.message || 'Failed to complete diagnostic scan');
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Automated Deep Audit & Auto-Repair Engine Trigger
  const handleDeepAuditAndRepair = async () => {
    setIsScanning(true);
    setScanError(null);
    setActionNotice(null);

    try {
      // 1. Run Server-Authoritative Deep Audit & Auto-Repair
      const result = await performDeepAuditAndAutoRepair();
      setAuditResult(result);
      setShowAuditModal(true);

      // 2. Update local state with the single verified source of truth
      setLocalTxList(result.reconciledTransactions);
      setCloudTxList(result.reconciledTransactions);
      setCloudStatus('connected');
      setLastScannedTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // 3. Update server state
      try {
        setServerStatus('checking');
        const serverState = await syncAllWithServer(false);
        if (serverState) {
          setServerTxList(serverState.transactions || []);
          setServerCampList(serverState.campaigns || []);
          setServerStatus('online');
        } else {
          setServerStatus('offline');
        }
      } catch {
        setServerStatus('offline');
      }

      // 4. Update Toast notification
      setActionNotice({
        message: result.message,
        type: 'success'
      });

      // 5. Notify parent component to reload state across all screens
      if (onRefreshParent) {
        onRefreshParent();
      }
    } catch (err: any) {
      console.error('Deep audit error:', err);
      setScanError(err?.message || 'Failed to complete Deep Audit & Auto-Repair');
      setActionNotice({
        message: `❌ Audit failed: ${err?.message || 'Network error'}`,
        type: 'error'
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Run initial scan on mount
  useEffect(() => {
    runDiagnosticScan();
  }, [runDiagnosticScan]);

  // Compute Discrepancies across Local, Cloud Firestore, and Server DB
  const discrepancies = useMemo(() => {
    const items: DiscrepancyItem[] = [];
    const deletedTxIds = getDeletedTransactionIds();
    const cloudTombstoneSet = new Set(cloudTombstones.map(s => s.toLowerCase().trim()));

    // Create lookup maps
    const localTxMap = new Map<string, Transaction>();
    localTxList.forEach(t => {
      if (t && t.id) localTxMap.set(String(t.id).toLowerCase().trim(), t);
    });

    const cloudTxMap = new Map<string, Transaction>();
    cloudTxList.forEach(t => {
      if (t && t.id) cloudTxMap.set(String(t.id).toLowerCase().trim(), t);
    });

    const serverTxMap = new Map<string, Transaction>();
    serverTxList.forEach(t => {
      if (t && t.id) serverTxMap.set(String(t.id).toLowerCase().trim(), t);
    });

    // 1. Analyze Transactions: Check all known IDs
    const allTxIds = new Set<string>([
      ...Array.from(localTxMap.keys()),
      ...Array.from(cloudTxMap.keys()),
      ...Array.from(serverTxMap.keys())
    ]);

    const isCloudActive = cloudStatus === 'connected' || cloudTxList.length > 0;

    allTxIds.forEach(cleanId => {
      const isDeletedLocally = deletedTxIds.has(cleanId);
      const isDeletedInCloud = cloudTombstoneSet.has(cleanId);

      const localTx = localTxMap.get(cleanId);
      const cloudTx = cloudTxMap.get(cleanId);
      const serverTx = serverTxMap.get(cleanId);

      // Check tombstone conflicts
      if (isDeletedLocally && cloudTx && !isDeletedInCloud) {
        items.push({
          id: cloudTx.id,
          type: 'transaction',
          title: `Donation ₹${cloudTx.amount?.toLocaleString('en-IN') || 0} (${cloudTx.donorName || 'Anonymous'})`,
          subTitle: `Campaign: ${cloudTx.campaignTitle || cloudTx.campaignId}`,
          discrepancyType: 'tombstone_conflict',
          severity: 'alert',
          localData: null,
          cloudData: cloudTx,
          serverData: serverTx,
          description: `Deleted on local app, but still active in Cloud Firestore.`,
          descriptionMizo: `App-ah paih tawh a ni a, mahse Cloud Firestore-ah a la awm reng.`,
          suggestedAction: 'purge'
        });
        return;
      }

      // If deleted locally and not in cloud, it's properly purged
      if (isDeletedLocally && !cloudTx) return;

      // 1. Check Missing in Central Server DB
      if (localTx && !serverTx && serverStatus === 'online') {
        items.push({
          id: localTx.id,
          type: 'transaction',
          title: `Donation ₹${localTx.amount?.toLocaleString('en-IN') || 0} (${localTx.donorName || 'Anonymous'})`,
          subTitle: `Campaign: ${localTx.campaignTitle || localTx.campaignId}`,
          discrepancyType: 'missing_in_server',
          severity: 'alert',
          localData: localTx,
          cloudData: cloudTx,
          serverData: null,
          description: `Transaction exists locally, but is MISSING from central database.`,
          descriptionMizo: `He transaction hi he device-ah a awm a, central server-ah a la lut lo.`,
          suggestedAction: 'push_to_server'
        });
        return;
      }

      // 2. Check Missing in Local from Server
      if (serverTx && !localTx && !isDeletedLocally) {
        items.push({
          id: serverTx.id,
          type: 'transaction',
          title: `Donation ₹${serverTx.amount?.toLocaleString('en-IN') || 0} (${serverTx.donorName || 'Anonymous'})`,
          subTitle: `Campaign: ${serverTx.campaignTitle || serverTx.campaignId}`,
          discrepancyType: 'missing_in_local',
          severity: 'warning',
          localData: null,
          cloudData: cloudTx,
          serverData: serverTx,
          description: `Transaction exists in central server database, but is MISSING from local device storage.`,
          descriptionMizo: `Central server-ah a awm a, mahse he device Local Storage-ah a la awm lo.`,
          suggestedAction: 'pull_to_local'
        });
        return;
      }

      // 3. Check Missing in Cloud (only if Cloud is actively connected)
      if (isCloudActive && localTx && !cloudTx) {
        items.push({
          id: localTx.id,
          type: 'transaction',
          title: `Donation ₹${localTx.amount?.toLocaleString('en-IN') || 0} (${localTx.donorName || 'Anonymous'})`,
          subTitle: `Campaign: ${localTx.campaignTitle || localTx.campaignId}`,
          discrepancyType: 'missing_in_cloud',
          severity: 'alert',
          localData: localTx,
          cloudData: null,
          serverData: serverTx,
          description: `Transaction exists in Local Storage/App, but is MISSING in Cloud Firestore.`,
          descriptionMizo: `He transaction hi Local Database-ah a awm a, mahse Cloud Firestore-ah a la lut lo.`,
          suggestedAction: 'push_to_cloud'
        });
        return;
      }

      // 4. Check Missing in Local from Cloud (only if Cloud is actively connected)
      if (isCloudActive && cloudTx && !localTx && !isDeletedLocally) {
        items.push({
          id: cloudTx.id,
          type: 'transaction',
          title: `Donation ₹${cloudTx.amount?.toLocaleString('en-IN') || 0} (${cloudTx.donorName || 'Anonymous'})`,
          subTitle: `Campaign: ${cloudTx.campaignTitle || cloudTx.campaignId}`,
          discrepancyType: 'missing_in_local',
          severity: 'warning',
          localData: null,
          cloudData: cloudTx,
          serverData: serverTx,
          description: `Transaction exists in Cloud Firestore, but is MISSING from local device storage.`,
          descriptionMizo: `Cloud Firestore-ah a awm a, mahse he device Local Storage-ah a la awm lo.`,
          suggestedAction: 'pull_to_local'
        });
        return;
      }

      // Both local and cloud exist: check for status discrepancies
      if (localTx && cloudTx) {
        const localStatus = (localTx.status || '').toLowerCase().trim();
        const cloudStatusVal = (cloudTx.status || '').toLowerCase().trim();

        const isLocalVerified = localStatus === 'completed' || localStatus === 'verified';
        const isCloudVerified = cloudStatusVal === 'completed' || cloudStatusVal === 'verified';

        if (isLocalVerified !== isCloudVerified) {
          items.push({
            id: localTx.id,
            type: 'transaction',
            title: `Donation ₹${localTx.amount?.toLocaleString('en-IN') || 0} (${localTx.donorName || 'Anonymous'})`,
            subTitle: `Campaign: ${localTx.campaignTitle || localTx.campaignId}`,
            discrepancyType: 'status_mismatch',
            severity: 'alert',
            localData: localTx,
            cloudData: cloudTx,
            serverData: serverTx,
            description: `Status mismatch: Local is '${localTx.status}', but Cloud Firestore is '${cloudTx.status}'.`,
            descriptionMizo: `Status inmil lo: Local chu '${localTx.status}' a ni a, Cloud-ah '${cloudTx.status}' a ni lawi a.`,
            suggestedAction: isLocalVerified ? 'push_to_cloud' : 'pull_to_local'
          });
          return;
        }

        // Check amount mismatch
        if (Number(localTx.amount) !== Number(cloudTx.amount)) {
          items.push({
            id: localTx.id,
            type: 'transaction',
            title: `Donation ₹${localTx.amount?.toLocaleString('en-IN')} vs ₹${cloudTx.amount?.toLocaleString('en-IN')}`,
            subTitle: `Campaign: ${localTx.campaignTitle || localTx.campaignId}`,
            discrepancyType: 'amount_mismatch',
            severity: 'alert',
            localData: localTx,
            cloudData: cloudTx,
            serverData: serverTx,
            description: `Amount mismatch: Local is ₹${localTx.amount}, but Cloud Firestore is ₹${cloudTx.amount}.`,
            descriptionMizo: `Pawisa zat inmil lo: Local chu ₹${localTx.amount} a ni a, Cloud chu ₹${cloudTx.amount} a ni.`,
            suggestedAction: 'push_to_cloud'
          });
        }
      }
    });

    // 2. Analyze Campaigns
    const localCampMap = new Map<string, Campaign>();
    localCampList.forEach(c => {
      if (c && c.id) localCampMap.set(String(c.id).toLowerCase().trim(), c);
    });

    const cloudCampMap = new Map<string, Campaign>();
    cloudCampList.forEach(c => {
      if (c && c.id) cloudCampMap.set(String(c.id).toLowerCase().trim(), c);
    });

    const serverCampMap = new Map<string, Campaign>();
    serverCampList.forEach(c => {
      if (c && c.id) serverCampMap.set(String(c.id).toLowerCase().trim(), c);
    });

    const allCampIds = new Set<string>([
      ...Array.from(localCampMap.keys()),
      ...Array.from(cloudCampMap.keys()),
      ...Array.from(serverCampMap.keys())
    ]);

    const isCloudCampActive = cloudStatus === 'connected' || cloudCampList.length > 0;

    allCampIds.forEach(cleanId => {
      const localCamp = localCampMap.get(cleanId);
      const cloudCamp = cloudCampMap.get(cleanId);
      const serverCamp = serverCampMap.get(cleanId);

      // 1. Check Missing in Central Server
      if (localCamp && !serverCamp && serverStatus === 'online') {
        items.push({
          id: localCamp.id,
          type: 'campaign',
          title: localCamp.title || 'Untitled Campaign',
          subTitle: `Category: ${localCamp.category} • Location: ${localCamp.location || 'Mizoram'}`,
          discrepancyType: 'missing_in_server',
          severity: 'alert',
          localData: localCamp,
          cloudData: cloudCamp,
          serverData: null,
          description: `Campaign exists in Local Storage/App, but is MISSING from central server database.`,
          descriptionMizo: `He Bawm/QR hi he device-ah a awm a, central server database-ah a la awm lo.`,
          suggestedAction: 'push_to_server'
        });
        return;
      }

      // 2. Check Missing in Local from Server
      if (serverCamp && !localCamp) {
        items.push({
          id: serverCamp.id,
          type: 'campaign',
          title: serverCamp.title || 'Untitled Campaign',
          subTitle: `Category: ${serverCamp.category} • Location: ${serverCamp.location || 'Mizoram'}`,
          discrepancyType: 'missing_in_local',
          severity: 'warning',
          localData: null,
          cloudData: cloudCamp,
          serverData: serverCamp,
          description: `Campaign exists in central server database, but is MISSING from local device storage.`,
          descriptionMizo: `He Bawm/QR hi central server-ah a awm a, mahse he device Local Storage-ah a la awm lo.`,
          suggestedAction: 'pull_to_local'
        });
        return;
      }

      // 3. Check Missing in Cloud (only if Cloud is actively connected)
      if (isCloudCampActive && localCamp && !cloudCamp) {
        items.push({
          id: localCamp.id,
          type: 'campaign',
          title: localCamp.title || 'Untitled Campaign',
          subTitle: `Category: ${localCamp.category} • Location: ${localCamp.location || 'Mizoram'}`,
          discrepancyType: 'missing_in_cloud',
          severity: 'alert',
          localData: localCamp,
          cloudData: null,
          serverData: serverCamp,
          description: `Campaign exists in Local Storage/App, but is MISSING in Cloud Firestore.`,
          descriptionMizo: `He Bawm/QR hi Local-ah a awm a, Cloud Firestore-ah a la awm lo.`,
          suggestedAction: 'push_to_cloud'
        });
        return;
      }

      // 4. Check Missing in Local from Cloud (only if Cloud is actively connected)
      if (isCloudCampActive && cloudCamp && !localCamp) {
        items.push({
          id: cloudCamp.id,
          type: 'campaign',
          title: cloudCamp.title || 'Untitled Campaign',
          subTitle: `Category: ${cloudCamp.category} • Location: ${cloudCamp.location || 'Mizoram'}`,
          discrepancyType: 'missing_in_local',
          severity: 'warning',
          localData: null,
          cloudData: cloudCamp,
          serverData: serverCamp,
          description: `Campaign exists in Cloud Firestore, but is MISSING from local device storage.`,
          descriptionMizo: `Cloud Firestore-ah a awm a, mahse he device Local Storage-ah a la lut lo.`,
          suggestedAction: 'pull_to_local'
        });
        return;
      }

      // Check Status or Approval Mismatch
      if (localCamp && cloudCamp) {
        const localApproved = Boolean(localCamp.isApproved);
        const cloudApproved = Boolean(cloudCamp.isApproved);

        if (localApproved !== cloudApproved) {
          items.push({
            id: localCamp.id,
            type: 'campaign',
            title: localCamp.title || 'Untitled Campaign',
            subTitle: `Category: ${localCamp.category}`,
            discrepancyType: 'status_mismatch',
            severity: 'alert',
            localData: localCamp,
            cloudData: cloudCamp,
            serverData: serverCamp,
            description: `Approval status mismatch: Local isApproved=${localApproved}, Cloud isApproved=${cloudApproved}.`,
            descriptionMizo: `Pawmpuina (Approval) inmil lo: Local=${localApproved ? 'Approved' : 'Pending'}, Cloud=${cloudApproved ? 'Approved' : 'Pending'}.`,
            suggestedAction: localApproved ? 'push_to_cloud' : 'pull_to_local'
          });
          return;
        }

        // Check Target Amount Mismatch
        const localTarget = localCamp.targetAmount || 0;
        const cloudTarget = cloudCamp.targetAmount || 0;
        if (localTarget !== cloudTarget) {
          items.push({
            id: localCamp.id,
            type: 'campaign',
            title: localCamp.title || 'Untitled Campaign',
            subTitle: `Target: ₹${localTarget.toLocaleString('en-IN')} vs ₹${cloudTarget.toLocaleString('en-IN')}`,
            discrepancyType: 'amount_mismatch',
            severity: 'warning',
            localData: localCamp,
            cloudData: cloudCamp,
            serverData: serverCamp,
            description: `Target amount mismatch: Local is ₹${localTarget}, Cloud is ₹${cloudTarget}.`,
            descriptionMizo: `Target zat inmil lo: Local chu ₹${localTarget} a ni a, Cloud chu ₹${cloudTarget} a ni.`,
            suggestedAction: 'push_to_cloud'
          });
        }
      }
    });

    return items;
  }, [localTxList, localCampList, cloudTxList, cloudCampList, serverTxList, serverCampList, cloudTombstones]);

  // One-click Re-sync single item
  const handleReSyncItem = async (item: DiscrepancyItem) => {
    setReSyncingId(item.id);
    setActionNotice(null);

    try {
      if (item.type === 'transaction') {
        if ((item.suggestedAction === 'push_to_cloud' || item.suggestedAction === 'push_to_server') && item.localData) {
          // Push local record to Server and Firestore
          await saveTransactionToServer(item.localData);
          await syncTransactionToFirestore(item.localData);
        } else if (item.suggestedAction === 'pull_to_local' && (item.serverData || item.cloudData)) {
          // Adopt server/cloud record locally
          saveTransaction(item.serverData || item.cloudData);
        } else if (item.suggestedAction === 'purge') {
          // Enforce deletion tombstone everywhere
          markTransactionAsDeleted(item.id);
          await deleteTransactionFromFirestore(item.id);
        }
      } else if (item.type === 'campaign') {
        if ((item.suggestedAction === 'push_to_cloud' || item.suggestedAction === 'push_to_server') && item.localData) {
          await saveCampaignToServer(item.localData);
          await syncCampaignToFirestore(item.localData);
        } else if (item.suggestedAction === 'pull_to_local' && (item.serverData || item.cloudData)) {
          const targetCamp = item.serverData || item.cloudData;
          const fresh = getStoredCampaigns();
          const merged = fresh.filter(c => c.id !== targetCamp.id);
          merged.push(targetCamp);
          saveStoredCampaigns(merged);
        }
      }

      setActionNotice({ 
        message: `✅ ${item.id} hi hlawhtling takin re-sync fel a ni ta! (Successfully re-synced)`, 
        type: 'success' 
      });

      // Trigger local storage and parent update
      if (onRefreshParent) onRefreshParent();
      try {
        window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
      } catch {}

      // Refresh diagnostic scan after 500ms
      setTimeout(() => {
        runDiagnosticScan();
      }, 500);

    } catch (err: any) {
      setActionNotice({ 
        message: `❌ Re-sync failed for ${item.id}: ${err?.message || 'Network error'}`, 
        type: 'error' 
      });
    } finally {
      setReSyncingId(null);
    }
  };

  // Re-sync all discrepancies in one click
  const handleReSyncAll = async () => {
    if (discrepancies.length === 0) return;
    setIsReSyncingAll(true);
    setActionNotice(null);

    let successCount = 0;
    let failCount = 0;

    for (const item of discrepancies) {
      try {
        if (item.type === 'transaction') {
          if ((item.suggestedAction === 'push_to_cloud' || item.suggestedAction === 'push_to_server') && item.localData) {
            await saveTransactionToServer(item.localData);
            await syncTransactionToFirestore(item.localData);
            successCount++;
          } else if (item.suggestedAction === 'pull_to_local' && (item.serverData || item.cloudData)) {
            saveTransaction(item.serverData || item.cloudData);
            successCount++;
          } else if (item.suggestedAction === 'purge') {
            markTransactionAsDeleted(item.id);
            await deleteTransactionFromFirestore(item.id);
            successCount++;
          }
        } else if (item.type === 'campaign') {
          if ((item.suggestedAction === 'push_to_cloud' || item.suggestedAction === 'push_to_server') && item.localData) {
            await saveCampaignToServer(item.localData);
            await syncCampaignToFirestore(item.localData);
            successCount++;
          } else if (item.suggestedAction === 'pull_to_local' && (item.serverData || item.cloudData)) {
            const targetCamp = item.serverData || item.cloudData;
            const fresh = getStoredCampaigns();
            const merged = fresh.filter(c => c.id !== targetCamp.id);
            merged.push(targetCamp);
            saveStoredCampaigns(merged);
            successCount++;
          }
        }
      } catch (e) {
        failCount++;
      }
    }

    setIsReSyncingAll(false);
    setActionNotice({
      message: `⚡ Force Re-sync fel ta: ${successCount} re-synced, ${failCount} failed.`,
      type: failCount === 0 ? 'success' : 'error'
    });

    if (onRefreshParent) onRefreshParent();
    try {
      window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
    } catch {}

    setTimeout(() => {
      runDiagnosticScan();
    }, 700);
  };

  // Filtered list
  const filteredDiscrepancies = useMemo(() => {
    return discrepancies.filter(item => {
      // Type filter
      if (typeFilter === 'transactions' && item.type !== 'transaction') return false;
      if (typeFilter === 'campaigns' && item.type !== 'campaign') return false;
      
      // Discrepancy sub-filter
      if (discrepancyFilter !== 'all' && item.discrepancyType !== discrepancyFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = item.id.toLowerCase().includes(q);
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        return matchId || matchTitle || matchDesc;
      }

      return true;
    });
  }, [discrepancies, typeFilter, discrepancyFilter, searchQuery]);

  // Overall Health Score Calculation
  const totalChecked = (localTxList.length + cloudTxList.length) / 2 + (localCampList.length + cloudCampList.length) / 2;
  const healthPercent = totalChecked > 0 ? Math.max(0, Math.round(((totalChecked - discrepancies.length) / totalChecked) * 100)) : 100;
  const isHealthy = discrepancies.length === 0;

  return (
    <div className="space-y-4 text-xs font-sans pb-8">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-600/40 border border-indigo-400/30 text-indigo-300">
              <Activity className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              Admin Sync Diagnostic & Consistency Monitor
            </h2>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Pre-UAT & Live Ready
            </span>
          </div>
          <p className="text-slate-300 text-xs leading-relaxed">
            Mobile App, Web Browser local storage, Express Server DB, leh Firebase Cloud Firestore inkara data inmil lo (mismatches) enfiahna leh siamthatna.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDeepAuditAndRepair}
            disabled={isScanning}
            title="Automated Deep Audit & Auto-Repair Engine"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Auditing & Repairing...' : 'Scan Now'}</span>
          </button>

          {discrepancies.length > 0 && (
            <button
              type="button"
              onClick={handleReSyncAll}
              disabled={isReSyncingAll || isScanning}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isReSyncingAll ? 'Re-syncing...' : `Re-sync All (${discrepancies.length})`}</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all shadow-xs ${
          actionNotice.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {actionNotice.type === 'success' ? (
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
            )}
            <div>
              <p className="font-black">{actionNotice.message}</p>
              {auditResult && actionNotice.type === 'success' && (
                <p className="text-[11px] font-extrabold text-emerald-700 italic">
                  "{auditResult.messageMizo}"
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {auditResult && actionNotice.type === 'success' && (
              <button
                type="button"
                onClick={() => setShowAuditModal(true)}
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
              >
                View Report
              </button>
            )}
            <button 
              type="button" 
              onClick={() => setActionNotice(null)}
              className="text-xs opacity-60 hover:opacity-100 cursor-pointer p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Automated Deep Audit & Auto-Repair Summary Modal */}
      {showAuditModal && auditResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-indigo-100 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Deep Sync & Auto-Repair Complete
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-bold text-emerald-700">
                    Cloud & Local State 100% Synchronized
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Main Result Banners */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{auditResult.message}</span>
              </div>
              <p className="text-[11px] font-extrabold text-emerald-800 italic pl-6">
                "{auditResult.messageMizo}"
              </p>
            </div>

            {/* Audit Verified Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Verified Cloud Txns</span>
                <span className="text-base font-black text-slate-900">{auditResult.totalValidTxns}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">True Public Pool</span>
                <span className="text-base font-black text-emerald-700">₹{auditResult.totalValidAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                <span className="text-[9px] font-bold uppercase text-slate-400 block">Today's Txns</span>
                <span className="text-base font-black text-indigo-700">{auditResult.todayTxns}</span>
              </div>
            </div>

            {/* Restored Records Section */}
            {auditResult.restoredCount > 0 ? (
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                  <span>✨ Missing Records Restored ({auditResult.restoredCount}):</span>
                  <span className="text-[10px] text-amber-700 font-bold">Force Injected & Unblocked</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {auditResult.restoredIds.map(id => (
                    <span key={id} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-900 shadow-2xs">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2 text-[11px] text-slate-600 font-bold">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Zero missing records: All cloud records already present locally.</span>
              </div>
            )}

            {/* Pruned Records Section */}
            {auditResult.prunedCount > 0 && (
              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-black text-rose-900">
                  <span>🗑️ Ghost/Orphan Records Pruned ({auditResult.prunedCount}):</span>
                  <span className="text-[10px] text-rose-700 font-bold">Wiped Out from Local Cache</span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {auditResult.prunedIds.map(id => (
                    <span key={id} className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-rose-300 text-rose-800 shadow-2xs">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Screen Re-render & Counter Confirmation */}
            <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10.5px]">
              <span className="font-bold text-indigo-950 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>stats/public_pool Overwrite & Screen Re-render:</span>
              </span>
              <span className="font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200 text-center">
                100% Synced across Home, Reports & Tabs
              </span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition active:scale-95 cursor-pointer"
              >
                Khawl Siamthatna Pawm / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Layer Consistency Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Layer 1: Local Client / Mobile App Cache */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Smartphone className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-black text-slate-800 text-xs">Local Client Layer</h3>
            </div>
            <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active Storage
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 font-medium">
            Mobile App & Web browser Indexed/LocalStorage
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Transactions</span>
              <span className="text-sm font-black text-slate-900">{localTxList.length}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Campaigns</span>
              <span className="text-sm font-black text-slate-900">{localCampList.length}</span>
            </div>
          </div>
        </div>

        {/* Layer 2: Server API & Mock DB Layer */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Globe className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-black text-slate-800 text-xs">Server / API Layer</h3>
            </div>
            <span className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md border ${
              serverStatus === 'online' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {serverStatus === 'online' ? 'Pre-UAT / Express OK' : 'Checking...'}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 font-medium">
            Express /api/data/sync & ronpay_db.json
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Transactions</span>
              <span className="text-sm font-black text-slate-900">{serverTxList.length}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Campaigns</span>
              <span className="text-sm font-black text-slate-900">{serverCampList.length}</span>
            </div>
          </div>
        </div>

        {/* Layer 3: Cloud Firestore Production Layer */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                <Cloud className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-black text-slate-800 text-xs">Cloud Firestore Layer</h3>
            </div>
            <span className={`text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-md border ${
              cloudStatus === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {cloudStatus === 'connected' ? `Live (${cloudLatencyMs}ms)` : cloudStatus}
            </span>
          </div>
          <p className="text-[10.5px] text-slate-500 font-medium">
            Firebase Project: ronpay-7fc69
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Transactions</span>
              <span className="text-sm font-black text-slate-900">{cloudTxList.length}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[9px] text-slate-400 block font-bold uppercase">Campaigns</span>
              <span className="text-sm font-black text-slate-900">{cloudCampList.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Health Overview Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        isHealthy 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
          : 'bg-rose-50/90 border-rose-200 text-rose-950'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl text-white shrink-0 ${
              isHealthy ? 'bg-emerald-600 shadow-sm' : 'bg-rose-600 shadow-sm animate-pulse'
            }`}>
              {isHealthy ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm">
                  {isHealthy ? 'All Systems In-Sync (100% Consistent)' : `Sync Discrepancies Detected (${discrepancies.length} Issues)`}
                </h4>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  isHealthy ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-rose-100 border-rose-300 text-rose-800'
                }`}>
                  Health: {healthPercent}%
                </span>
              </div>
              <p className="text-[11px] opacity-80 mt-0.5">
                {isHealthy 
                  ? 'Mobile App, Web Browser, Server API, leh Firebase Cloud Firestore records zawng zawng an inmil thlap e.'
                  : `${discrepancies.length} items te hi Cloud Firestore emaw Local database-ah an in-sync lo a, a hnuaia 'Force Re-sync' hmang hian i siamtha nghal thei e.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[11px]">
            <span className="text-slate-500 font-mono">
              Last check: <strong>{lastScannedTime || 'Just now'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
        <div className="flex flex-col md:flex-row gap-2 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, title, donor phone, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full md:w-auto">
            <button
              type="button"
              onClick={() => setTypeFilter('discrepancies')}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1 shrink-0 ${
                typeFilter === 'discrepancies' 
                  ? 'bg-rose-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Discrepancies ({discrepancies.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
                typeFilter === 'all' 
                  ? 'bg-indigo-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('transactions')}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
                typeFilter === 'transactions' 
                  ? 'bg-indigo-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Transactions
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('campaigns')}
              className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer shrink-0 ${
                typeFilter === 'campaigns' 
                  ? 'bg-indigo-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Campaigns
            </button>
          </div>
        </div>
      </div>

      {/* Discrepancy Items List */}
      <div className="space-y-2.5">
        {filteredDiscrepancies.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <h4 className="font-black text-slate-800 text-sm">
              {discrepancies.length === 0 
                ? 'Harsatna hmuh a ni lo (Zero Discrepancies)' 
                : 'Zawnna mil a awm lo (No matching items found)'}
            </h4>
            <p className="text-slate-500 text-xs max-w-md mx-auto">
              {discrepancies.length === 0
                ? 'Cloud Firestore leh Local Database records zawng zawng an in-sync thlap e. Harsatna a awm lo.'
                : 'Filter emaw search query i hman hi tidanglam deuh rawh le.'}
            </p>
          </div>
        ) : (
          filteredDiscrepancies.map(item => {
            const isAlert = item.severity === 'alert';
            const isReSyncingThis = reSyncingId === item.id;

            return (
              <div
                key={`${item.type}-${item.id}`}
                className={`p-3.5 rounded-2xl border transition-all shadow-2xs space-y-3 ${
                  isAlert 
                    ? 'bg-rose-50/40 border-rose-200/90 hover:border-rose-400' 
                    : 'bg-amber-50/40 border-amber-200/90 hover:border-amber-400'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className={`p-1.5 rounded-xl text-white shrink-0 mt-0.5 ${
                      isAlert ? 'bg-rose-600 shadow-2xs' : 'bg-amber-500 shadow-2xs'
                    }`}>
                      {item.type === 'transaction' ? <Smartphone className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-xs truncate">
                          {item.title}
                        </span>
                        
                        {/* Discrepancy Badge */}
                        <span className={`text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md border ${
                          item.discrepancyType === 'missing_in_cloud'
                            ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                            : item.discrepancyType === 'status_mismatch'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : item.discrepancyType === 'amount_mismatch'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : item.discrepancyType === 'tombstone_conflict'
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-slate-100 text-slate-800 border-slate-300'
                        }`}>
                          {item.discrepancyType.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {item.subTitle && (
                        <p className="text-[10.5px] text-slate-500 font-medium">
                          {item.subTitle}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ID + Copy Button */}
                  <div className="flex items-center gap-1.5 shrink-0 pl-8 md:pl-0">
                    <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                      {item.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(item.id)}
                      title="Copy ID"
                      className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                    >
                      {copiedId === item.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>

                    {/* One-Click Force Re-sync Button */}
                    <button
                      type="button"
                      onClick={() => handleReSyncItem(item)}
                      disabled={isReSyncingThis || isReSyncingAll}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] flex items-center gap-1 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer ml-1"
                    >
                      <Zap className={`w-3 h-3 text-amber-300 ${isReSyncingThis ? 'animate-spin' : ''}`} />
                      <span>{isReSyncingThis ? 'Re-syncing...' : 'Force Re-sync'}</span>
                    </button>
                  </div>
                </div>

                {/* Explanation text */}
                <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200/80 text-[11px] space-y-1">
                  <p className="text-slate-700 font-medium leading-relaxed">
                    <strong>Cause:</strong> {item.description}
                  </p>
                  <p className="text-indigo-900 font-bold text-[10.5px]">
                    💡 <em>{item.descriptionMizo}</em>
                  </p>
                </div>

                {/* Side-by-side comparison across 3 layers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[10.5px]">
                  {/* Local Value */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">📱 Local Cache</span>
                    {item.localData ? (
                      <div className="space-y-0.5">
                        <p><strong className="text-slate-800">Status:</strong> <span className="font-mono text-indigo-700 font-bold">{item.localData.status || (item.localData.isApproved ? 'Approved' : 'Pending')}</span></p>
                        {item.localData.amount !== undefined && (
                          <p><strong className="text-slate-800">Amount:</strong> <span className="font-bold text-emerald-700">₹{item.localData.amount}</span></p>
                        )}
                        {item.localData.timestamp && (
                          <p className="text-[9px] text-slate-400 font-mono">{formatDateTimeDDMMYYYY(item.localData.timestamp)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-rose-500 font-bold italic">Not in Local Storage</span>
                    )}
                  </div>

                  {/* Cloud Firestore Value */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">☁️ Cloud Firestore</span>
                    {item.cloudData ? (
                      <div className="space-y-0.5">
                        <p><strong className="text-slate-800">Status:</strong> <span className="font-mono text-indigo-700 font-bold">{item.cloudData.status || (item.cloudData.isApproved ? 'Approved' : 'Pending')}</span></p>
                        {item.cloudData.amount !== undefined && (
                          <p><strong className="text-slate-800">Amount:</strong> <span className="font-bold text-emerald-700">₹{item.cloudData.amount}</span></p>
                        )}
                        {item.cloudData.timestamp && (
                          <p className="text-[9px] text-slate-400 font-mono">{formatDateTimeDDMMYYYY(item.cloudData.timestamp)}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-rose-500 font-bold italic">Missing in Firestore</span>
                    )}
                  </div>

                  {/* Server API Value */}
                  <div className="bg-white p-2 rounded-xl border border-slate-200 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">🌐 Server DB / Mock</span>
                    {item.serverData ? (
                      <div className="space-y-0.5">
                        <p><strong className="text-slate-800">Status:</strong> <span className="font-mono text-indigo-700 font-bold">{item.serverData.status || (item.serverData.isApproved ? 'Approved' : 'Pending')}</span></p>
                        {item.serverData.amount !== undefined && (
                          <p><strong className="text-slate-800">Amount:</strong> <span className="font-bold text-emerald-700">₹{item.serverData.amount}</span></p>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Not in Server DB</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pre-UAT Mock & Live Production Compatibility Note */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[10.5px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
          <span>
            <strong>Pre-UAT & Live Integration:</strong> Hei hian Live Cloud Firestore production database leh Pre-UAT mock database (/api/data/sync) te parallel-in a check reng a, data inthlauh palh lakah automatic safeguards a pe a ni.
          </span>
        </div>
      </div>
    </div>
  );
};
