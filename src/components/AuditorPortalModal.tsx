import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Download, 
  Search, 
  Clock, 
  Banknote, 
  TrendingUp, 
  TrendingDown, 
  Award,
  Info,
  Flag,
  MessageSquareWarning,
  FolderKanban,
  BookOpen,
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  FolderTree
} from 'lucide-react';
import { Campaign, CreatorProfile, KumtluangExpense } from '../types';
import { 
  getStoredCampaigns,
  getStoredTransactions, 
  getStoredExpenses, 
  lockCampaignAuditPeriod, 
  checkAuditorAccessForCampaign,
  getActiveAuditorGrantsForUser,
  isSuperAdminOrAdminProfile,
  isCampaignCreator,
  saveCampaign,
  markRecordAuditVerification,
  unlockSingleRecord,
  formatRemainingAuditTimeMizo,
  getMembers,
  syncAuditorGrantsAcrossCloud,
  saveMultipleTransactions,
  saveStoredExpenses,
  isTransactionForCampaign,
  isConfirmedTransaction
} from '../utils/storage';
import { syncAllWithServer, RONPAY_SYNC_EVENT } from '../utils/syncEngine';
import { fetchOpeningBalanceFromSupabase, fetchTableData } from '../services/SupabaseSync';
import { fetchExpensesFromFirestore } from '../services/firestoreSync';
import { formatDateDDMMYYYY } from '../utils/date';
import { printHtmlSafely, getTransactionHead, getTransactionMonthYear, getHeadSortPriority } from '../utils/export';

interface AuditorPortalModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  campaigns?: Campaign[];
  onSelectCampaign?: (campaign: Campaign) => void;
  creatorProfile?: CreatorProfile | null;
  onClose: () => void;
  onRecordsUpdated?: () => void;
}

const DEFAULT_CHECKLIST: Record<string, boolean> = {
  bank_reconciliation: true,
  vouchers_receipts: true,
  member_giving_roll: true,
  cash_in_hand: true,
  discrepancy_check: true
};

export const AuditorPortalModal: React.FC<AuditorPortalModalProps> = ({
  isOpen,
  campaign,
  campaigns = [],
  onSelectCampaign,
  creatorProfile,
  onClose,
  onRecordsUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'cashbook' | 'overview' | 'reconcile' | 'transactions' | 'expenses' | 'lock_action' | 'certificate'>('cashbook');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLockStatus, setFilterLockStatus] = useState<'all' | 'locked' | 'unlocked' | 'verified' | 'flagged' | 'unchecked'>('all');

  // Cash Book (Receipts & Payments) Date Range & Audit Status Filter state
  const [cbPreset, setCbPreset] = useState<'all' | 'this_month' | 'last_month' | 'today' | 'custom'>('all');
  const [cbFromDate, setCbFromDate] = useState<string>('');
  const [cbToDate, setCbToDate] = useState<string>('');
  const [cbAuditFilter, setCbAuditFilter] = useState<'all' | 'audited' | 'unaudited' | 'flagged'>('all');
  const [cbViewMode, setCbViewMode] = useState<'ledger' | 'chronological'>('ledger');
  const [cbReceiptsMode, setCbReceiptsMode] = useState<'detailed' | 'head_wise'>('head_wise');
  const [expandedHeads, setExpandedHeads] = useState<Record<string, boolean>>({});
  const [inflowViewMode, setInflowViewMode] = useState<'head_wise' | 'detailed'>('head_wise');
  const [expandedInflowHeads, setExpandedInflowHeads] = useState<Record<string, boolean>>({});
  const [cbFullHeight, setCbFullHeight] = useState<boolean>(false);
  const [mobileLedgerPane, setMobileLedgerPane] = useState<'receipts' | 'payments' | 'both'>('receipts');

  // Local refresh tick & live sync states
  const [tick, setTick] = useState<number>(0);
  const [isSyncingPortal, setIsSyncingPortal] = useState<boolean>(false);
  const [liveOpeningBalance, setLiveOpeningBalance] = useState<number | null>(null);

  const handleSyncPortalData = async () => {
    setIsSyncingPortal(true);
    try {
      await Promise.allSettled([
        syncAuditorGrantsAcrossCloud(),
        syncAllWithServer(true),
        campaign?.id
          ? fetchOpeningBalanceFromSupabase(campaign.id).then(val => {
              if (typeof val === 'number' && !isNaN(val)) {
                setLiveOpeningBalance(val);
              }
            })
          : Promise.resolve(),
        fetchTableData<KumtluangExpense>('expenses').then(fresh => {
          if (Array.isArray(fresh) && fresh.length > 0) {
            saveStoredExpenses(fresh, true);
          }
        }),
        fetchExpensesFromFirestore(true)
      ]);
      setTick(t => t + 1);
      if (onRecordsUpdated) onRecordsUpdated();
    } catch {
      // Ignore network errors cleanly
    } finally {
      setIsSyncingPortal(false);
    }
  };

  // Sync latest auditor grants, transactions, expenses, and opening balance from Server & Supabase when portal opens
  useEffect(() => {
    if (!isOpen) return;
    setLiveOpeningBalance(null);
    handleSyncPortalData();

    const onSyncEvent = () => setTick(t => t + 1);
    window.addEventListener(RONPAY_SYNC_EVENT, onSyncEvent);
    return () => {
      window.removeEventListener(RONPAY_SYNC_EVENT, onSyncEvent);
    };
  }, [isOpen, campaign?.id]);

  // Check access & remaining hours
  const accessInfo = useMemo(() => {
    if (!campaign) return null;
    const phone = creatorProfile?.phone || creatorProfile?.phoneNumber || '';
    return checkAuditorAccessForCampaign(phone, campaign.id);
  }, [campaign, creatorProfile, tick]);

  const isAdmin = useMemo(() => {
    return isSuperAdminOrAdminProfile(creatorProfile);
  }, [creatorProfile]);

  const isCreator = useMemo(() => {
    return campaign ? isCampaignCreator(campaign, creatorProfile || null) : false;
  }, [campaign, creatorProfile]);

  const canAudit = useMemo(() => {
    const phone = creatorProfile?.phone || creatorProfile?.phoneNumber || '';
    const hasAnyActiveGrant = phone ? getActiveAuditorGrantsForUser(phone).length > 0 : false;
    return isAdmin || isCreator || Boolean(accessInfo?.hasAccess) || creatorProfile?.role === 'AUDITOR' || hasAnyActiveGrant;
  }, [isAdmin, isCreator, accessInfo, creatorProfile]);

  // Accessible campaigns for Multi-Bawm Switcher (merges prop campaigns + stored campaigns so no Bawm is missing)
  const accessibleCampaigns = useMemo(() => {
    const stored = getStoredCampaigns();
    const map = new Map<string, Campaign>();
    stored.forEach(c => {
      if (c && c.id) map.set(c.id, c);
    });
    (campaigns || []).forEach(c => {
      if (c && c.id) map.set(c.id, c);
    });
    if (campaign && campaign.id) {
      map.set(campaign.id, campaign);
    }
    const mergedList = Array.from(map.values());
    if (mergedList.length === 0) return campaign ? [campaign] : [];
    if (isAdmin) return mergedList;
    const phone = creatorProfile?.phone || creatorProfile?.phoneNumber || '';
    const activeGrants = getActiveAuditorGrantsForUser(phone);
    const grantCampIds = new Set(activeGrants.map(g => String(g.campaignId || g.campaign_id || '').trim()));
    const filtered = mergedList.filter(
      c => grantCampIds.has(String(c.id).trim()) || isCampaignCreator(c, creatorProfile || null) || (campaign && c.id === campaign.id)
    );
    return filtered.length > 0 ? filtered : (campaign ? [campaign] : []);
  }, [campaigns, campaign, isAdmin, creatorProfile, tick]);

  // Sign & Lock inputs
  const [auditPeriod, setAuditPeriod] = useState<string>(`FY ${new Date().getFullYear() - 1}-${new Date().getFullYear()}`);
  const [auditorName, setAuditorName] = useState<string>(creatorProfile?.name || 'Auditor');
  const [auditorPhone, setAuditorPhone] = useState<string>(creatorProfile?.phone || creatorProfile?.phoneNumber || '');
  const [auditNotes, setAuditNotes] = useState<string>('Accounts and vouchers verified with bank statements and receipts.');
  const [isConfirmingLock, setIsConfirmingLock] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [lockToast, setLockToast] = useState<string | null>(null);

  // Flag query input state
  const [flaggingRecordId, setFlaggingRecordId] = useState<string | null>(null);
  const [flaggingRecordType, setFlaggingRecordType] = useState<'transaction' | 'expense'>('transaction');
  const [flagQueryText, setFlagQueryText] = useState<string>('');

  // Keep auditor details, checklist, and physical cross-check inputs synced when campaign or profile changes
  const [checklist, setChecklist] = useState<Record<string, boolean>>(DEFAULT_CHECKLIST);
  const [bankPassbookInput, setBankPassbookInput] = useState<string>('');
  const [cashInHandInput, setCashInHandInput] = useState<string>('');
  const [reconcileNotesInput, setReconcileNotesInput] = useState<string>('');

  useEffect(() => {
    if (campaign) {
      setChecklist(campaign.auditChecklist || DEFAULT_CHECKLIST);
      if (campaign.lastAuditPeriod) {
        setAuditPeriod(campaign.lastAuditPeriod);
      }
      if (campaign.auditReconciliation) {
        setBankPassbookInput(
          campaign.auditReconciliation.bankBalance !== undefined
            ? String(campaign.auditReconciliation.bankBalance)
            : ''
        );
        setCashInHandInput(
          campaign.auditReconciliation.cashInHand !== undefined
            ? String(campaign.auditReconciliation.cashInHand)
            : ''
        );
        setReconcileNotesInput(campaign.auditReconciliation.notes || '');
      } else {
        setBankPassbookInput('');
        setCashInHandInput('');
        setReconcileNotesInput('');
      }
    }
  }, [campaign?.id]);

  useEffect(() => {
    const grantName = accessInfo?.grant?.auditorName || accessInfo?.grant?.auditor_name;
    const grantPhone = accessInfo?.grant?.auditorPhone || accessInfo?.grant?.auditor_phone;
    if (grantName) {
      setAuditorName(grantName);
    } else if (creatorProfile?.name && creatorProfile.name !== 'Guest User') {
      setAuditorName(creatorProfile.name);
    }
    if (grantPhone) {
      setAuditorPhone(grantPhone);
    } else if (creatorProfile?.phone || creatorProfile?.phoneNumber) {
      setAuditorPhone(creatorProfile.phone || creatorProfile.phoneNumber || '');
    }
  }, [accessInfo, creatorProfile]);

  const toggleChecklistItem = (key: string) => {
    if (!canAudit || !campaign) return;
    setChecklist(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveCampaign({
        ...campaign,
        auditChecklist: next
      });
      if (onRecordsUpdated) onRecordsUpdated();
      return next;
    });
  };

  const handleMarkItem = (
    targetType: 'transaction' | 'expense',
    targetId: string,
    currentMark: 'verified' | 'flagged' | null | undefined,
    desiredMark: 'verified' | 'flagged',
    queryText?: string,
    isCurrentlyLocked?: boolean
  ) => {
    if (!canAudit) return;

    // If record is locked after submission: ADMIN can modify/toggle it; Auditor cannot
    if (isCurrentlyLocked && !isAdmin) {
      setLockToast('🔒 He record hi Audit Submit & Lock tawh a ni a, Admin chiahin a khawih nawn thei.');
      setTimeout(() => setLockToast(null), 3500);
      return;
    }

    // Toggle: if already has this desired mark (or is verified/locked and user clicks 'verified'), toggle it off to undefined!
    const isAlreadyVerified = currentMark === 'verified' || (Boolean(isCurrentlyLocked) && desiredMark === 'verified');
    const isAlreadyFlagged = currentMark === 'flagged' && desiredMark === 'flagged';

    let nextMark: 'verified' | 'flagged' | undefined = desiredMark;
    if (desiredMark === 'verified' && isAlreadyVerified && queryText === undefined) {
      nextMark = undefined; // toggle off (undo / clear mark)
    } else if (desiredMark === 'flagged' && isAlreadyFlagged && queryText === undefined) {
      nextMark = undefined; // toggle off (clear flag)
    }

    const shouldUnlock = nextMark === undefined || (Boolean(isCurrentlyLocked) && isAdmin);

    const ok = markRecordAuditVerification(
      targetId,
      targetType,
      nextMark,
      auditorName || creatorProfile?.name || 'Auditor',
      nextMark === 'flagged' ? (queryText || 'Enfiah ngai / Query awm') : '',
      shouldUnlock
    );
    if (ok) {
      setTick(t => t + 1);
      setFlaggingRecordId(null);
      setFlagQueryText('');
      if (nextMark === undefined) {
        setLockToast('↩️ Audit chhinchhiahna sut (Clear) a ni e.');
        setTimeout(() => setLockToast(null), 2500);
      }
      if (onRecordsUpdated) onRecordsUpdated();
    }
  };

  const handleSingleUnlock = (targetType: 'transaction' | 'expense', targetId: string) => {
    if (!canAudit) return;
    const ok = unlockSingleRecord(
      targetId,
      targetType,
      auditorName || creatorProfile?.name || 'Auditor',
      'Unlocked inside Auditor Portal for correction'
    );
    if (ok) {
      setTick(t => t + 1);
      setLockToast('🔓 Record hi siam that theih turin Unlock lailawk a ni e.');
      if (onRecordsUpdated) onRecordsUpdated();
      setTimeout(() => setLockToast(null), 3500);
    }
  };

  const handleVerifyAllRecords = (targetType: 'transaction' | 'expense') => {
    if (!canAudit) return;
    const records = targetType === 'transaction' ? allTransactions : allExpenses;
    let count = 0;
    records.forEach(r => {
      if (r.audit_mark !== 'verified') {
        markRecordAuditVerification(
          r.id,
          targetType,
          'verified',
          auditorName || creatorProfile?.name || 'Auditor',
          ''
        );
        count++;
      }
    });
    if (count > 0) {
      setTick(t => t + 1);
      setLockToast(`✅ Record ${count} chu '✓ Dik (Verified)' tiin chhinchhiah nghal vek a ni e.`);
      if (onRecordsUpdated) onRecordsUpdated();
      setTimeout(() => setLockToast(null), 3500);
    }
  };

  const checkedCount = useMemo(() => Object.values(checklist).filter(Boolean).length, [checklist]);
  const checklistPercent = useMemo(() => Math.round((checkedCount / 5) * 100), [checkedCount]);

  // Effective Opening Balance (from live Supabase fetch or campaign object)
  const effectiveOpeningBalance = useMemo(() => {
    if (liveOpeningBalance !== null && !isNaN(liveOpeningBalance)) {
      return liveOpeningBalance;
    }
    return Number(campaign?.openingBalance) || 0;
  }, [liveOpeningBalance, campaign?.openingBalance]);

  // Load transactions using isTransactionForCampaign & isConfirmedTransaction so 100% of Bawm records match HomeScreen/ReportsScreen/CashBook
  const allTransactions = useMemo(() => {
    if (!campaign) return [];
    const all = getStoredTransactions();
    return all.filter(t => t && isTransactionForCampaign(t, campaign) && isConfirmedTransaction(t));
  }, [campaign, tick]);

  const allExpenses = useMemo(() => {
    if (!campaign) return [];
    return getStoredExpenses(campaign.id);
  }, [campaign, tick]);

  // Statistics with explicit Counts & Rupee Amounts for Total, Verified, Flagged, Unchecked, Locked
  const stats = useMemo(() => {
    const validStatuses = new Set(['completed', 'confirmed', 'success', 'verified', 'paid', 'approved']);
    const verifiedTx = allTransactions.filter(t => {
      const st = String(t.status || '').toLowerCase().trim();
      return !st || validStatuses.has(st) || (st !== 'failed' && st !== 'rejected' && st !== 'cancelled');
    });

    const sumTx = (list: typeof verifiedTx) => list.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const sumExp = (list: typeof allExpenses) => list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const openingBalance = effectiveOpeningBalance;
    const totalInflow = sumTx(verifiedTx);
    const totalOutflow = sumExp(allExpenses);
    const netBalance = openingBalance + totalInflow - totalOutflow;

    const lockedTxList = verifiedTx.filter(t => t.is_locked);
    const unlockedTxList = verifiedTx.filter(t => !t.is_locked);
    const auditVerifiedTxList = verifiedTx.filter(t => t.audit_mark === 'verified');
    const auditFlaggedTxList = verifiedTx.filter(t => t.audit_mark === 'flagged');
    const uncheckedTxList = verifiedTx.filter(t => !t.audit_mark);

    const lockedExpList = allExpenses.filter(e => e.is_locked);
    const unlockedExpList = allExpenses.filter(e => !e.is_locked);
    const auditVerifiedExpList = allExpenses.filter(e => e.audit_mark === 'verified');
    const auditFlaggedExpList = allExpenses.filter(e => e.audit_mark === 'flagged');
    const uncheckedExpList = allExpenses.filter(e => !e.audit_mark);

    return {
      openingBalance,
      totalInflow,
      totalOutflow,
      netBalance,
      txCount: verifiedTx.length,
      expCount: allExpenses.length,
      lockedTxCount: lockedTxList.length,
      lockedInflowAmount: sumTx(lockedTxList),
      unlockedTxCount: unlockedTxList.length,
      unlockedInflowAmount: sumTx(unlockedTxList),
      auditVerifiedTxCount: auditVerifiedTxList.length,
      verifiedInflowAmount: sumTx(auditVerifiedTxList),
      auditFlaggedTxCount: auditFlaggedTxList.length,
      flaggedInflowAmount: sumTx(auditFlaggedTxList),
      uncheckedTxCount: uncheckedTxList.length,
      uncheckedInflowAmount: sumTx(uncheckedTxList),
      lockedExpCount: lockedExpList.length,
      lockedOutflowAmount: sumExp(lockedExpList),
      unlockedExpCount: unlockedExpList.length,
      unlockedOutflowAmount: sumExp(unlockedExpList),
      auditVerifiedExpCount: auditVerifiedExpList.length,
      verifiedOutflowAmount: sumExp(auditVerifiedExpList),
      auditFlaggedExpCount: auditFlaggedExpList.length,
      flaggedOutflowAmount: sumExp(auditFlaggedExpList),
      uncheckedExpCount: uncheckedExpList.length,
      uncheckedOutflowAmount: sumExp(uncheckedExpList),
      totalRecords: verifiedTx.length + allExpenses.length,
      totalLocked: lockedTxList.length + lockedExpList.length,
      totalUnlocked: unlockedTxList.length + unlockedExpList.length,
      totalAuditVerified: auditVerifiedTxList.length + auditVerifiedExpList.length,
      totalAuditFlagged: auditFlaggedTxList.length + auditFlaggedExpList.length,
      totalUnchecked: uncheckedTxList.length + uncheckedExpList.length
    };
  }, [allTransactions, allExpenses, effectiveOpeningBalance]);

  // Cross-Check & Reconciliation Analytics (Bank/UPI vs Cash, Member Roll, Section-wise, Collector-wise, Anomaly Scanner)
  const crossCheckData = useMemo(() => {
    const validStatuses = new Set(['completed', 'confirmed', 'success', 'verified', 'paid', 'approved']);
    const validTx = allTransactions.filter(t => {
      const st = String(t.status || '').toLowerCase().trim();
      return !st || validStatuses.has(st) || (st !== 'failed' && st !== 'rejected' && st !== 'cancelled');
    });

    const isCashMode = (m?: string) => {
      const s = String(m || '').toLowerCase().trim();
      return s.includes('cash') || s.includes('manual') || s.includes('offline') || s.includes('counter');
    };

    const cashInflowList = validTx.filter(t => isCashMode(t.paymentMethod));
    const onlineInflowList = validTx.filter(t => !isCashMode(t.paymentMethod));

    const cashInflowAmount = cashInflowList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const onlineInflowAmount = onlineInflowList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const cashOutflowList = allExpenses.filter(e => isCashMode(e.paymentMode || (e as any).paymentMethod || 'cash'));
    const onlineOutflowList = allExpenses.filter(e => !isCashMode(e.paymentMode || (e as any).paymentMethod || 'cash'));

    const cashOutflowAmount = cashOutflowList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const onlineOutflowAmount = onlineOutflowList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const openingBalance = Number(campaign?.openingBalance || 0);
    const expectedClosingBalance = openingBalance + stats.totalInflow - stats.totalOutflow;
    const expectedBankBalance = openingBalance + onlineInflowAmount - onlineOutflowAmount;
    const expectedCashInHand = cashInflowAmount - cashOutflowAmount;

    // Member Roll vs Ledger Cross-Check
    const campaignMembers = campaign ? getMembers(campaign.id) : [];
    const memberTxList = validTx.filter(t => Boolean(t.memberId || t.donorType === 'member'));
    const publicTxList = validTx.filter(t => !t.memberId && t.donorType !== 'member');
    const memberGivingAmount = memberTxList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const publicGivingAmount = publicTxList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    // Section / Bial Breakdown
    const sectionMap = new Map<string, { section: string; count: number; amount: number; verifiedCount: number }>();
    validTx.forEach(t => {
      const sec = (t.donorVeng || (t as any).donorSection || 'General / Unassigned').trim();
      const curr = sectionMap.get(sec) || { section: sec, count: 0, amount: 0, verifiedCount: 0 };
      curr.count += 1;
      curr.amount += Number(t.amount) || 0;
      if (t.audit_mark === 'verified') curr.verifiedCount += 1;
      sectionMap.set(sec, curr);
    });
    const sectionBreakdown = Array.from(sectionMap.values()).sort((a, b) => b.amount - a.amount);

    // Collector / Approver Breakdown
    const collectorMap = new Map<string, { collector: string; mode: string; count: number; amount: number }>();
    validTx.forEach(t => {
      const handler =
        t.approved_by ||
        (t as any).approvedBy ||
        t.verifiedBy ||
        (isCashMode(t.paymentMethod) ? 'Manual / Cash Counter' : 'RonPay UPI Gateway');
      const mode = isCashMode(t.paymentMethod) ? 'CASH' : 'UPI / ONLINE';
      const key = `${handler}__${mode}`;
      const curr = collectorMap.get(key) || { collector: String(handler), mode, count: 0, amount: 0 };
      curr.count += 1;
      curr.amount += Number(t.amount) || 0;
      collectorMap.set(key, curr);
    });
    const collectorBreakdown = Array.from(collectorMap.values()).sort((a, b) => b.amount - a.amount);

    // Automated Anomaly & Duplicate Scanner
    const anomalies: Array<{
      id: string;
      type: 'transaction' | 'expense';
      severity: 'high' | 'medium';
      title: string;
      detail: string;
      amount: number;
    }> = [];

    // 1. Duplicate transaction suspects (same donor name + same amount + same date)
    const seenSig = new Map<string, string>();
    validTx.forEach(t => {
      const datePart = String(t.timestamp || '').slice(0, 10);
      const namePart = String(t.donorName || '').toLowerCase().trim();
      const amt = Number(t.amount) || 0;
      if (namePart && namePart !== 'anonymous' && amt > 0) {
        const sig = `${datePart}__${namePart}__${amt}`;
        if (seenSig.has(sig)) {
          anomalies.push({
            id: t.id,
            type: 'transaction',
            severity: 'high',
            title: `Duplicate Suspect: ${t.donorName} (₹${amt.toLocaleString('en-IN')})`,
            detail: `Ni khat (${formatDateDDMMYYYY(t.timestamp)}) chhungin hming leh zat inang chiah vawi 2+ lut (${seenSig.get(sig)} & ${t.id})`,
            amount: amt
          });
        } else {
          seenSig.set(sig, t.id);
        }
      }

      // 2. Online/UPI payment missing UTR / Reference ID
      if (!isCashMode(t.paymentMethod) && !t.utr && !(t as any).utrRef && !t.referenceNo && !t.id.startsWith('tx-')) {
        anomalies.push({
          id: t.id,
          type: 'transaction',
          severity: 'medium',
          title: `UTR / Bank Ref Awm Lo: ${t.donorName}`,
          detail: `UPI/Online payment ni siin UTR/Reference number a awm lo (${t.id})`,
          amount: amt
        });
      }
    });

    // 3. Expenses missing Voucher No or Payee
    allExpenses.forEach(e => {
      if (!e.voucherNo || !(e.paidTo || (e as any).payeeName)) {
        anomalies.push({
          id: e.id,
          type: 'expense',
          severity: 'medium',
          title: `Voucher / Payee Kim Lo: ${e.head || 'Expense'}`,
          detail: `${!e.voucherNo ? 'Voucher No. awm lo' : ''} ${!(e.paidTo || (e as any).payeeName) ? '• Payee hming awm lo' : ''}`.trim(),
          amount: Number(e.amount) || 0
        });
      }
    });

    return {
      openingBalance,
      expectedClosingBalance,
      expectedBankBalance,
      expectedCashInHand,
      onlineInflowCount: onlineInflowList.length,
      onlineInflowAmount,
      cashInflowCount: cashInflowList.length,
      cashInflowAmount,
      onlineOutflowCount: onlineOutflowList.length,
      onlineOutflowAmount,
      cashOutflowCount: cashOutflowList.length,
      cashOutflowAmount,
      totalMembersCount: campaignMembers.length,
      memberTxCount: memberTxList.length,
      memberGivingAmount,
      publicTxCount: publicTxList.length,
      publicGivingAmount,
      sectionBreakdown,
      collectorBreakdown,
      anomalies
    };
  }, [allTransactions, allExpenses, campaign, stats.totalInflow, stats.totalOutflow]);

  const handleSaveReconciliation = () => {
    if (!campaign || !canAudit) return;
    const bankVal = bankPassbookInput.trim() !== '' ? Number(bankPassbookInput) : undefined;
    const cashVal = cashInHandInput.trim() !== '' ? Number(cashInHandInput) : undefined;
    saveCampaign({
      ...campaign,
      auditReconciliation: {
        bankBalance: bankVal,
        cashInHand: cashVal,
        notes: reconcileNotesInput.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: auditorName || creatorProfile?.name || 'Auditor'
      }
    });
    setLockToast('✅ Cross-Check & Bank/Cash Reconciliation dinhmun hi Bawm-ah chhinchhiah fel a ni e!');
    if (onRecordsUpdated) onRecordsUpdated();
    setTimeout(() => setLockToast(null), 3500);
  };

  // Download Audited Ledger CSV
  const handleExportAuditedLedgerCSV = () => {
    if (!campaign) return;
    const headers = ['Type', 'Record ID', 'Date', 'Name / Head', 'Details / Payee', 'Amount (INR)', 'Payment Method', 'Audit Period', 'Lock Status', 'Auditor Marker', 'Auditor Query'];
    const rows: string[][] = [];

    allTransactions.forEach(tx => {
      rows.push([
        'INFLOW',
        tx.id || '',
        formatDateDDMMYYYY(tx.timestamp),
        tx.donorName || 'Anonymous',
        tx.donorComment || tx.subCategory || tx.donorVeng || '',
        String(tx.amount || 0),
        tx.paymentMethod || 'UPI',
        tx.audit_period || 'N/A',
        tx.is_locked ? 'LOCKED' : 'UNLOCKED',
        tx.audit_mark === 'verified' ? 'VERIFIED_OK' : tx.audit_mark === 'flagged' ? 'FLAGGED_DISCREPANCY' : 'UNCHECKED',
        tx.audit_query || ''
      ]);
    });

    allExpenses.forEach(exp => {
      rows.push([
        'OUTFLOW',
        exp.voucherNo || exp.id || '',
        formatDateDDMMYYYY(exp.spentDate || exp.date || exp.createdAt || ''),
        exp.head || exp.expenseHead || 'Expense',
        exp.paidTo || exp.payeeName || exp.purpose || '',
        String(exp.amount || 0),
        'CASH / BANK',
        exp.audit_period || 'N/A',
        exp.is_locked ? 'LOCKED' : 'UNLOCKED',
        exp.audit_mark === 'verified' ? 'VERIFIED_OK' : exp.audit_mark === 'flagged' ? 'FLAGGED_DISCREPANCY' : 'UNCHECKED',
        exp.audit_query || ''
      ]);
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audited_Ledger_${campaign.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      if (filterLockStatus === 'locked' && !t.is_locked) return false;
      if (filterLockStatus === 'unlocked' && t.is_locked) return false;
      if (filterLockStatus === 'verified' && t.audit_mark !== 'verified') return false;
      if (filterLockStatus === 'flagged' && t.audit_mark !== 'flagged') return false;
      if (filterLockStatus === 'unchecked' && Boolean(t.audit_mark)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const donor = (t.donorName || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        const desc = (t.donorComment || t.donorVeng || t.subCategory || '').toLowerCase();
        return donor.includes(q) || id.includes(q) || desc.includes(q);
      }
      return true;
    });
  }, [allTransactions, filterLockStatus, searchQuery]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(e => {
      if (filterLockStatus === 'locked' && !e.is_locked) return false;
      if (filterLockStatus === 'unlocked' && e.is_locked) return false;
      if (filterLockStatus === 'verified' && e.audit_mark !== 'verified') return false;
      if (filterLockStatus === 'flagged' && e.audit_mark !== 'flagged') return false;
      if (filterLockStatus === 'unchecked' && Boolean(e.audit_mark)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const head = (e.head || e.expenseHead || '').toLowerCase();
        const payee = (e.paidTo || e.payeeName || '').toLowerCase();
        const desc = (e.purpose || e.description || '').toLowerCase();
        const id = (e.id || '').toLowerCase();
        return head.includes(q) || payee.includes(q) || desc.includes(q) || id.includes(q);
      }
      return true;
    });
  }, [allExpenses, filterLockStatus, searchQuery]);

  // Group filtered transactions by Head / Category + Month (Monthly) for Head-wise Inflow Auditing
  const inflowHeadGroups = useMemo(() => {
    const map = new Map<string, {
      headName: string;
      baseHead: string;
      monthYearLabel: string;
      sortKey: string;
      totalAmount: number;
      count: number;
      verifiedCount: number;
      flaggedCount: number;
      uncheckedCount: number;
      lockedCount: number;
      latestDisplayDate: string;
      items: any[];
    }>();

    filteredTransactions.forEach(t => {
      const baseHead = getTransactionHead(t, campaign) || 'Thawhlawm / Sum Lut';
      const { monthYearLabel, sortKey } = getTransactionMonthYear(t);
      const headName = `${baseHead} - ${monthYearLabel}`;
      const key = `${baseHead}__${sortKey}`;

      const grp = map.get(key) || {
        headName,
        baseHead,
        monthYearLabel,
        sortKey,
        totalAmount: 0,
        count: 0,
        verifiedCount: 0,
        flaggedCount: 0,
        uncheckedCount: 0,
        lockedCount: 0,
        latestDisplayDate: '',
        items: []
      };

      const amt = Number(t.amount) || 0;
      grp.totalAmount += amt;
      grp.count += 1;
      if (t.audit_mark === 'verified' || t.is_locked) {
        grp.verifiedCount += 1;
      } else if (t.audit_mark === 'flagged') {
        grp.flaggedCount += 1;
      } else {
        grp.uncheckedCount += 1;
      }
      if (t.is_locked) grp.lockedCount += 1;
      grp.latestDisplayDate = formatDateDDMMYYYY(t.timestamp || t.date || t.createdAt);
      grp.items.push(t);
      map.set(key, grp);
    });

    return Array.from(map.values()).sort((a, b) => {
      const pA = getHeadSortPriority(a.baseHead);
      const pB = getHeadSortPriority(b.baseHead);
      if (pA !== pB) return pA - pB;
      if (pA === 10 && a.baseHead !== b.baseHead) return a.baseHead.localeCompare(b.baseHead);
      return a.sortKey.localeCompare(b.sortKey);
    });
  }, [filteredTransactions, campaign]);

  // Unified Cash Book (Receipts & Payments) with Date Range & Audited/Unaudited Distinction
  const cashBookAuditData = useMemo(() => {
    const now = new Date();
    const toDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    let effFrom = '';
    let effTo = '';
    let rangeLabel = 'Hun Chhung Zawng (All Time)';

    if (cbPreset === 'today') {
      effFrom = toDateStr(now);
      effTo = effFrom;
      rangeLabel = `Vawiin (${formatDateDDMMYYYY(effFrom)})`;
    } else if (cbPreset === 'this_month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      effFrom = toDateStr(first);
      effTo = toDateStr(last);
      rangeLabel = `Kumin Thla (${formatDateDDMMYYYY(effFrom)} – ${formatDateDDMMYYYY(effTo)})`;
    } else if (cbPreset === 'last_month') {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      effFrom = toDateStr(first);
      effTo = toDateStr(last);
      rangeLabel = `Thla Hmasa (${formatDateDDMMYYYY(effFrom)} – ${formatDateDDMMYYYY(effTo)})`;
    } else if (cbPreset === 'custom') {
      effFrom = cbFromDate.trim();
      effTo = cbToDate.trim();
      if (effFrom && effTo) {
        rangeLabel = `${formatDateDDMMYYYY(effFrom)} – ${formatDateDDMMYYYY(effTo)}`;
      } else if (effFrom) {
        rangeLabel = `${formatDateDDMMYYYY(effFrom)} aṭanga Vawiin`;
      } else if (effTo) {
        rangeLabel = `${formatDateDDMMYYYY(effTo)} thleng`;
      } else {
        rangeLabel = 'Custom Date Range';
      }
    }

    const validStatuses = new Set(['completed', 'confirmed', 'success', 'verified', 'paid', 'approved']);
    const validTxs = allTransactions.filter(t => {
      const st = String(t.status || '').toLowerCase().trim();
      return !st || validStatuses.has(st) || (st !== 'failed' && st !== 'rejected' && st !== 'cancelled');
    });

    const getTxIsoDate = (t: any): string => {
      const raw = String(t.timestamp || t.date || t.createdAt || '').trim();
      if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return toDateStr(d);
      return '';
    };

    const getExpIsoDate = (e: any): string => {
      const raw = String(e.spentDate || e.date || e.createdAt || '').trim();
      if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return toDateStr(d);
      return '';
    };

    // Compute Opening Balance (B/F) prior to effFrom
    const baseOpening = effectiveOpeningBalance;
    let priorReceipts = 0;
    let priorPayments = 0;

    if (effFrom) {
      validTxs.forEach(t => {
        const d = getTxIsoDate(t);
        if (d && d < effFrom) {
          priorReceipts += Number(t.amount) || 0;
        }
      });
      allExpenses.forEach(e => {
        const d = getExpIsoDate(e);
        if (d && d < effFrom) {
          priorPayments += Number(e.amount) || 0;
        }
      });
    }

    const openingBalance = baseOpening + priorReceipts - priorPayments;

    const isDateInRange = (isoDate: string) => {
      if (!effFrom && !effTo) return true;
      if (!isoDate) return !effFrom && !effTo;
      if (effFrom && isoDate < effFrom) return false;
      if (effTo && isoDate > effTo) return false;
      return true;
    };

    const inRangeTxs = validTxs.filter(t => isDateInRange(getTxIsoDate(t)));
    const inRangeExps = allExpenses.filter(e => isDateInRange(getExpIsoDate(e)));

    type AuditCashBookItem = {
      id: string;
      recordType: 'transaction' | 'expense';
      entryType: 'INFLOW' | 'OUTFLOW';
      isoDate: string;
      displayDate: string;
      timestampMs: number;
      voucherOrRef: string;
      headName: string;
      baseHead?: string;
      monthYearLabel?: string;
      sortKey?: string;
      particulars: string;
      subDetail: string;
      sectionOrHead: string;
      paymentMode: string;
      amount: number;
      audit_mark?: 'verified' | 'flagged' | null;
      audit_remark?: string;
      audited_by?: string;
      is_locked?: boolean;
      auditCategory: 'audited' | 'unaudited' | 'flagged';
      runningBalance: number;
    };

    const rawEntries: AuditCashBookItem[] = [];

    inRangeTxs.forEach(t => {
      const iso = getTxIsoDate(t);
      const isAudited = t.audit_mark === 'verified' || Boolean(t.is_locked);
      const isFlagged = t.audit_mark === 'flagged';
      const auditCategory: 'audited' | 'unaudited' | 'flagged' = isFlagged
        ? 'flagged'
        : isAudited
        ? 'audited'
        : 'unaudited';

      const isGroup = t.donorType === 'group' || (Boolean(t.groupName) && t.groupName!.trim().length > 0) || (Boolean(t.donorName) && t.donorName!.toLowerCase().startsWith('group'));
      const isGeneral = t.donorType === 'general' || Boolean((t as any).generalCollectionTitle) || (Boolean(t.donorName) && (t.donorName!.toLowerCase().includes('inkhawm') || t.donorName!.toLowerCase().includes('inkawm') || t.donorName!.toLowerCase().includes('pathianni') || t.donorName!.toLowerCase().includes('general')));

      const baseHead = getTransactionHead(t, campaign) || 'Thawhlawm / Sum Lut';
      const { monthYearLabel, sortKey } = getTransactionMonthYear(t, iso);
      const headName = `${baseHead} - ${monthYearLabel}`;
      const particulars = `To ${baseHead} (${monthYearLabel})`;

      const donorName = t.donorName || (isGeneral ? ((t as any).generalCollectionTitle || 'General Offering') : isGroup ? (t.groupName || 'Group') : 'Member');
      const secText = t.donorVeng || (t as any).section || '';
      const refText = t.utr || t.referenceNo || t.id.slice(-6).toUpperCase();
      const subDetail = `👤 ${donorName}${secText ? ` • Bial: ${secText}` : ''} • Ref: ${refText}`;

      rawEntries.push({
        id: t.id,
        recordType: 'transaction',
        entryType: 'INFLOW',
        isoDate: iso,
        displayDate: formatDateDDMMYYYY(t.timestamp || t.date || iso),
        timestampMs: new Date(t.timestamp || t.date || iso || 0).getTime(),
        voucherOrRef: t.utr || t.referenceNo || t.id.slice(-8).toUpperCase(),
        headName,
        baseHead,
        monthYearLabel,
        sortKey,
        particulars,
        subDetail,
        sectionOrHead: secText || baseHead,
        paymentMode: String(t.paymentMethod || 'UPI').toUpperCase(),
        amount: Number(t.amount) || 0,
        audit_mark: t.audit_mark,
        audit_remark: (t as any).audit_remark || t.audit_query,
        audited_by: (t as any).audited_by || t.audit_marked_by,
        is_locked: Boolean(t.is_locked),
        auditCategory,
        runningBalance: 0
      });
    });

    inRangeExps.forEach(e => {
      const iso = getExpIsoDate(e);
      const isAudited = e.audit_mark === 'verified' || Boolean(e.is_locked);
      const isFlagged = e.audit_mark === 'flagged';
      const auditCategory: 'audited' | 'unaudited' | 'flagged' = isFlagged
        ? 'flagged'
        : isAudited
        ? 'audited'
        : 'unaudited';

      const payee = e.paidTo || e.payeeName || (e as any).payee || 'Vendor';
      const head = e.head || e.expenseHead || 'Senso';
      rawEntries.push({
        id: e.id,
        recordType: 'expense',
        entryType: 'OUTFLOW',
        isoDate: iso,
        displayDate: formatDateDDMMYYYY(e.spentDate || e.date || e.createdAt || iso),
        timestampMs: new Date(e.spentDate || e.date || e.createdAt || iso || 0).getTime(),
        voucherOrRef: e.voucherNo || e.id.slice(-8).toUpperCase(),
        headName: head,
        particulars: `By ${head} (${payee})`,
        subDetail: `${e.purpose || e.description || head} • Mode: ${String(e.paymentMode || 'CASH').toUpperCase()}`,
        sectionOrHead: head,
        paymentMode: String(e.paymentMode || 'CASH').toUpperCase(),
        amount: Number(e.amount) || 0,
        audit_mark: e.audit_mark,
        audit_remark: (e as any).audit_remark || e.audit_query,
        audited_by: (e as any).audited_by || e.audit_marked_by,
        is_locked: Boolean(e.is_locked),
        auditCategory,
        runningBalance: 0
      });
    });

    // Sort chronologically (oldest to newest) to compute accurate Running Balance
    rawEntries.sort((a, b) => {
      if (a.isoDate !== b.isoDate) return a.isoDate.localeCompare(b.isoDate);
      return a.timestampMs - b.timestampMs;
    });

    let running = openingBalance;
    rawEntries.forEach(item => {
      if (item.entryType === 'INFLOW') {
        running += item.amount;
      } else {
        running -= item.amount;
      }
      item.runningBalance = running;
    });

    const periodReceipts = rawEntries.filter(i => i.entryType === 'INFLOW');
    const periodPayments = rawEntries.filter(i => i.entryType === 'OUTFLOW');

    const periodReceiptsTotal = periodReceipts.reduce((s, i) => s + i.amount, 0);
    const periodPaymentsTotal = periodPayments.reduce((s, i) => s + i.amount, 0);
    const closingBalance = openingBalance + periodReceiptsTotal - periodPaymentsTotal;

    const auditedItems = rawEntries.filter(i => i.auditCategory === 'audited');
    const unauditedItems = rawEntries.filter(i => i.auditCategory === 'unaudited');
    const flaggedItems = rawEntries.filter(i => i.auditCategory === 'flagged');

    const auditedReceiptsAmt = auditedItems.filter(i => i.entryType === 'INFLOW').reduce((s, i) => s + i.amount, 0);
    const auditedPaymentsAmt = auditedItems.filter(i => i.entryType === 'OUTFLOW').reduce((s, i) => s + i.amount, 0);
    const unauditedReceiptsAmt = unauditedItems.filter(i => i.entryType === 'INFLOW').reduce((s, i) => s + i.amount, 0);
    const unauditedPaymentsAmt = unauditedItems.filter(i => i.entryType === 'OUTFLOW').reduce((s, i) => s + i.amount, 0);

    const matchesFilterAndSearch = (item: AuditCashBookItem) => {
      if (cbAuditFilter === 'audited' && item.auditCategory !== 'audited') return false;
      if (cbAuditFilter === 'unaudited' && item.auditCategory !== 'unaudited') return false;
      if (cbAuditFilter === 'flagged' && item.auditCategory !== 'flagged') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.particulars.toLowerCase().includes(q) ||
          item.subDetail.toLowerCase().includes(q) ||
          item.headName.toLowerCase().includes(q) ||
          item.voucherOrRef.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
        );
      }
      return true;
    };

    const filteredChronological = rawEntries.filter(matchesFilterAndSearch);
    const filteredReceipts = periodReceipts.filter(matchesFilterAndSearch);
    const filteredPayments = periodPayments.filter(matchesFilterAndSearch);

    // Group filteredReceipts by Account Head + Month (Monthly) for Head-wise Ledger Summary + Drill-down
    const headGroupsMap = new Map<string, {
      headName: string;
      baseHead: string;
      monthYearLabel: string;
      sortKey: string;
      totalAmount: number;
      count: number;
      auditedCount: number;
      unauditedCount: number;
      flaggedCount: number;
      latestDisplayDate: string;
      items: AuditCashBookItem[];
    }>();

    filteredReceipts.forEach(r => {
      const baseHead = r.baseHead || r.headName || 'General Receipts';
      const monthYearLabel = r.monthYearLabel || '';
      const sortKey = r.sortKey || '9999-99';
      const headName = r.headName || baseHead;
      const key = `${baseHead}__${sortKey}`;
      const grp = headGroupsMap.get(key) || {
        headName,
        baseHead,
        monthYearLabel,
        sortKey,
        totalAmount: 0,
        count: 0,
        auditedCount: 0,
        unauditedCount: 0,
        flaggedCount: 0,
        latestDisplayDate: r.displayDate,
        items: []
      };
      grp.totalAmount += r.amount;
      grp.count += 1;
      if (r.auditCategory === 'audited') grp.auditedCount += 1;
      else if (r.auditCategory === 'flagged') grp.flaggedCount += 1;
      else grp.unauditedCount += 1;
      grp.latestDisplayDate = r.displayDate;
      grp.items.push(r);
      headGroupsMap.set(key, grp);
    });

    const receiptHeadGroups = Array.from(headGroupsMap.values()).sort((a, b) => {
      const pA = getHeadSortPriority(a.baseHead);
      const pB = getHeadSortPriority(b.baseHead);
      if (pA !== pB) return pA - pB;
      if (pA === 10 && a.baseHead !== b.baseHead) return a.baseHead.localeCompare(b.baseHead);
      return a.sortKey.localeCompare(b.sortKey);
    });

    return {
      effFrom,
      effTo,
      rangeLabel,
      openingBalance,
      closingBalance,
      periodReceiptsTotal,
      periodPaymentsTotal,
      totalEntriesCount: rawEntries.length,
      auditedCount: auditedItems.length,
      unauditedCount: unauditedItems.length,
      flaggedCount: flaggedItems.length,
      auditedReceiptsAmt,
      auditedPaymentsAmt,
      unauditedReceiptsAmt,
      unauditedPaymentsAmt,
      inRangeTxs,
      inRangeExps,
      filteredChronological,
      filteredReceipts,
      filteredPayments,
      receiptHeadGroups
    };
  }, [allTransactions, allExpenses, campaign, cbPreset, cbFromDate, cbToDate, cbAuditFilter, searchQuery, effectiveOpeningBalance]);

  // Verify all unaudited Receipts & Payments within the currently selected Cash Book date range
  const handleVerifySelectedRange = () => {
    if (!canAudit) return;
    let verifiedCnt = 0;
    cashBookAuditData.inRangeTxs.forEach(t => {
      if (t.audit_mark !== 'verified') {
        markRecordAuditVerification(
          t.id,
          'transaction',
          'verified',
          auditorName || creatorProfile?.name || 'Auditor',
          ''
        );
        verifiedCnt++;
      }
    });
    cashBookAuditData.inRangeExps.forEach(e => {
      if (e.audit_mark !== 'verified') {
        markRecordAuditVerification(
          e.id,
          'expense',
          'verified',
          auditorName || creatorProfile?.name || 'Auditor',
          ''
        );
        verifiedCnt++;
      }
    });
    if (verifiedCnt > 0) {
      setTick(t => t + 1);
      setLockToast(`✅ Selected Range (${cashBookAuditData.rangeLabel}) chhunga record ${verifiedCnt} chu '✓ Audited' tiin chhinchhiah vek a ni e!`);
      if (onRecordsUpdated) onRecordsUpdated();
      setTimeout(() => setLockToast(null), 4000);
    } else {
      setLockToast(`ℹ️ He range chhunga record zawng zawng hi Audited vek a ni tawh e.`);
      setTimeout(() => setLockToast(null), 3000);
    }
  };

  // Sign & Lock all Receipts & Payments within the currently selected Cash Book date range
  const handleLockSelectedRange = () => {
    if (!canAudit || !campaign) return;
    const nowIso = new Date().toISOString();
    const who = auditorName.trim() || creatorProfile?.name || 'Auditor';
    const txIdsInRange = new Set(cashBookAuditData.inRangeTxs.map(t => String(t.id).toLowerCase().trim()));
    const expIdsInRange = new Set(cashBookAuditData.inRangeExps.map(e => String(e.id).toLowerCase().trim()));

    const allStoredTxs = getStoredTransactions();
    const changedTxs: any[] = [];
    allStoredTxs.forEach(t => {
      if (t && t.id && txIdsInRange.has(String(t.id).toLowerCase().trim())) {
        const updated = {
          ...t,
          audit_mark: 'verified' as const,
          audited_by: who,
          audited_at: nowIso,
          is_locked: true,
          locked_by: who,
          locked_at: nowIso,
          isSynced: false,
          updatedAt: nowIso
        };
        changedTxs.push(updated);
      }
    });
    if (changedTxs.length > 0) {
      saveMultipleTransactions(changedTxs);
    }

    const allStoredExps = getStoredExpenses();
    let expChanged = false;
    const updatedExps = allStoredExps.map(e => {
      if (e && e.id && expIdsInRange.has(String(e.id).toLowerCase().trim())) {
        expChanged = true;
        return {
          ...e,
          audit_mark: 'verified' as const,
          audited_by: who,
          audited_at: nowIso,
          is_locked: true,
          locked_by: who,
          locked_at: nowIso,
          updatedAt: nowIso
        };
      }
      return e;
    });
    if (expChanged) {
      saveStoredExpenses(updatedExps);
    }

    const periodStr = cashBookAuditData.effFrom || cashBookAuditData.effTo
      ? cashBookAuditData.rangeLabel
      : auditPeriod;
    setAuditPeriod(periodStr);

    saveCampaign({
      ...campaign,
      lastAuditedAt: nowIso,
      lastAuditedBy: who,
      lastAuditPeriod: periodStr,
      lastAuditNotes: auditNotes || `Cash Book (${periodStr}) verified and locked.`
    });

    setTick(t => t + 1);
    setLockToast(`🔒 Cash Book Range (${periodStr}) chhunga Receipts (${changedTxs.length}) leh Payments (${expIdsInRange.size}) chu Audit & Lock fel vek a ni e!`);
    if (onRecordsUpdated) onRecordsUpdated();
    setTimeout(() => setLockToast(null), 4500);
  };

  // Print Official Audited Cash Book (Receipts & Payments) for Selected Range
  const handlePrintAuditedCashBook = () => {
    const receiptsRowsHtml = cbReceiptsMode === 'head_wise'
      ? cashBookAuditData.receiptHeadGroups.map(grp => `
        <tr style="background:#f0fdf4;">
          <td>${grp.latestDisplayDate}</td>
          <td>${grp.count} receipts</td>
          <td>
            <strong>To ${grp.headName}</strong><br/>
            <span style="font-size:10px;color:#64748b;">Belhkhawm (${grp.count} receipts)</span>
          </td>
          <td style="text-align:center;">
            <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:${grp.unauditedCount === 0 && grp.flaggedCount === 0 ? '#dcfce7' : '#fef3c7'};color:${grp.unauditedCount === 0 && grp.flaggedCount === 0 ? '#166534' : '#92400e'};">
              ${grp.unauditedCount === 0 && grp.flaggedCount === 0 ? '✓ AUDITED' : `⏳ ${grp.unauditedCount} LA AUDIT LOH`}
            </span>
          </td>
          <td style="text-align:right;font-weight:700;color:#065f46;">₹${grp.totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      `).join('')
      : cashBookAuditData.filteredReceipts.map(r => `
        <tr>
          <td>${r.displayDate}</td>
          <td>${r.voucherOrRef}</td>
          <td>
            <strong>${r.particulars}</strong><br/>
            <span style="font-size:10px;color:#64748b;">${r.subDetail} (${r.paymentMode})</span>
          </td>
          <td style="text-align:center;">
            <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:${r.auditCategory === 'audited' ? '#dcfce7' : r.auditCategory === 'flagged' ? '#fee2e2' : '#fef3c7'};color:${r.auditCategory === 'audited' ? '#166534' : r.auditCategory === 'flagged' ? '#991b1b' : '#92400e'};">
              ${r.auditCategory === 'audited' ? '✓ AUDITED' : r.auditCategory === 'flagged' ? '⚠️ QUERY' : '⏳ LA AUDIT LOH'}
            </span>
          </td>
          <td style="text-align:right;font-weight:700;color:#065f46;">₹${r.amount.toLocaleString('en-IN')}</td>
        </tr>
      `).join('');

    const paymentsRowsHtml = cashBookAuditData.filteredPayments.map(p => `
      <tr>
        <td>${p.displayDate}</td>
        <td>${p.voucherOrRef}</td>
        <td>
          <strong>${p.particulars}</strong><br/>
          <span style="font-size:10px;color:#64748b;">${p.subDetail} (${p.paymentMode})</span>
        </td>
        <td style="text-align:center;">
          <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:${p.auditCategory === 'audited' ? '#dcfce7' : p.auditCategory === 'flagged' ? '#fee2e2' : '#fef3c7'};color:${p.auditCategory === 'audited' ? '#166534' : p.auditCategory === 'flagged' ? '#991b1b' : '#92400e'};">
            ${p.auditCategory === 'audited' ? '✓ AUDITED' : p.auditCategory === 'flagged' ? '⚠️ QUERY' : '⏳ LA AUDIT LOH'}
          </span>
        </td>
        <td style="text-align:right;font-weight:700;color:#9f1239;">₹${p.amount.toLocaleString('en-IN')}</td>
      </tr>
    `).join('');

    const totalSideBalance = cashBookAuditData.openingBalance + cashBookAuditData.periodReceiptsTotal;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Audited Cash Book - ${campaign?.title || ''}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 10px; font-size: 11px; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
          .title { font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase; }
          .sub { font-size: 12px; color: #475569; margin: 4px 0 0 0; font-weight: 600; }
          .summary-bar { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; }
          .ledger-grid { display: flex; gap: 12px; align-items: stretch; }
          .side { flex: 1; border: 1.5px solid #0f172a; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; }
          .side-head { padding: 6px 10px; font-weight: 900; font-size: 11px; text-transform: uppercase; border-bottom: 1.5px solid #0f172a; display: flex; justify-content: space-between; }
          .dr-head { background: #ecfdf5; color: #065f46; }
          .cr-head { background: #fff1f2; color: #9f1239; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th, td { border-bottom: 1px solid #e2e8f0; padding: 5px 6px; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; font-weight: 800; color: #334155; }
          .total-row { background: #f8fafc; border-top: 2px solid #0f172a; font-weight: 900; font-size: 11.5px; padding: 8px 10px; display: flex; justify-content: space-between; }
          .sig-row { margin-top: 28px; display: flex; justify-content: space-between; align-items: flex-end; }
          .sig-box { width: 220px; border-top: 1px solid #0f172a; padding-top: 6px; text-align: center; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${campaign?.title || ''} — CASH BOOK (RECEIPTS &amp; PAYMENTS)</h1>
          <p class="sub">Period / Range: ${cashBookAuditData.rangeLabel} • Audit Status: ✓ Audited (${cashBookAuditData.auditedCount}) | ⏳ La Audit Loh (${cashBookAuditData.unauditedCount})</p>
        </div>
        <div class="summary-bar">
          <div><strong>Opening Balance (B/F):</strong> ₹${cashBookAuditData.openingBalance.toLocaleString('en-IN')}</div>
          <div><strong>Total Receipts (Sum Lut):</strong> +₹${cashBookAuditData.periodReceiptsTotal.toLocaleString('en-IN')}</div>
          <div><strong>Total Payments (Sum Chhuak):</strong> -₹${cashBookAuditData.periodPaymentsTotal.toLocaleString('en-IN')}</div>
          <div><strong>Closing Balance (C/D):</strong> ₹${cashBookAuditData.closingBalance.toLocaleString('en-IN')}</div>
        </div>
        <div class="ledger-grid">
          <div class="side">
            <div>
              <div class="side-head dr-head"><span>Dr. RECEIPTS (SUM LUT / THAWHLAWM)</span><span>Amount (₹)</span></div>
              <table>
                <thead>
                  <tr><th>Date</th><th>Ref/UTR</th><th>Particulars</th><th>Audit</th><th style="text-align:right;">Amount</th></tr>
                </thead>
                <tbody>
                  <tr style="background:#f0fdf4;">
                    <td>${cashBookAuditData.effFrom ? formatDateDDMMYYYY(cashBookAuditData.effFrom) : 'Opening'}</td>
                    <td>B/F</td>
                    <td><strong>To Balance b/d (Opening Balance)</strong></td>
                    <td style="text-align:center;">—</td>
                    <td style="text-align:right;font-weight:800;">₹${cashBookAuditData.openingBalance.toLocaleString('en-IN')}</td>
                  </tr>
                  ${receiptsRowsHtml || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">He hun chhung hian Sum Lut a awm lo</td></tr>'}
                </tbody>
              </table>
            </div>
            <div class="total-row">
              <span>TOTAL RECEIPTS (incl. Opening B/F)</span>
              <span>₹${totalSideBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>
          <div class="side">
            <div>
              <div class="side-head cr-head"><span>Cr. PAYMENTS (SUM CHHUAK / SENSO)</span><span>Amount (₹)</span></div>
              <table>
                <thead>
                  <tr><th>Date</th><th>Voucher</th><th>Particulars</th><th>Audit</th><th style="text-align:right;">Amount</th></tr>
                </thead>
                <tbody>
                  ${paymentsRowsHtml || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">He hun chhung hian Sum Chhuak (Payment) a awm lo</td></tr>'}
                  <tr style="background:#eef2ff;">
                    <td>${cashBookAuditData.effTo ? formatDateDDMMYYYY(cashBookAuditData.effTo) : 'Closing'}</td>
                    <td>C/D</td>
                    <td><strong>By Balance c/d (Closing Balance / Sum Bang)</strong></td>
                    <td style="text-align:center;">✓</td>
                    <td style="text-align:right;font-weight:800;color:#1e40af;">₹${cashBookAuditData.closingBalance.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="total-row">
              <span>TOTAL PAYMENTS (incl. Closing C/D)</span>
              <span>₹${totalSideBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
        <div class="sig-row">
          <div class="sig-box">
            <strong>Treasurer / Bawm Vawngtu</strong><br/>
            <span style="color:#64748b;font-size:10px;">${(campaign as any)?.createdByName || campaign?.createdBy || 'Treasurer'}</span>
          </div>
          <div class="sig-box">
            <strong>${auditorName}</strong><br/>
            <span style="color:#64748b;font-size:10px;">Sum Endiktu (Auditor) • Ph: ${auditorPhone || 'N/A'}</span>
          </div>
        </div>
      </body>
      </html>
    `;
    printHtmlSafely(html);
  };

  if (!isOpen || !campaign) return null;

  // Handle Sign & Lock Action
  const handleExecuteLock = () => {
    if (!campaign || !canAudit) return;
    setIsLocking(true);
    try {
      const result = lockCampaignAuditPeriod(
        campaign.id,
        auditorName.trim(),
        auditPeriod.trim(),
        auditNotes.trim()
      );

      setTick(t => t + 1);
      setIsConfirmingLock(false);
      setLockToast(`✅ Audit nemngheh fel a ni e! Record ${result.lockedTransactionsCount + result.lockedExpensesCount} Lock nghal a ni.`);
      if (onRecordsUpdated) onRecordsUpdated();
      setTimeout(() => setLockToast(null), 4000);
    } catch (err: any) {
      setLockToast(`⚠️ ${err?.message || 'Lock operation failed'}`);
    } finally {
      setIsLocking(false);
    }
  };

  // Generate & Print Official Audit Certificate
  const handlePrintCertificate = () => {
    const certHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Audit Certificate - ${campaign.title}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 20px; line-height: 1.5; }
          .header-box { border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
          .badge { display: inline-block; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
          .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0; }
          .subtitle { font-size: 14px; color: #475569; margin: 0; }
          .grid { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
          .stat-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; background: #f8fafc; }
          .stat-label { font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; }
          .stat-val { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 4px; }
          .stat-val.green { color: #059669; }
          .stat-val.red { color: #dc2626; }
          .stat-val.blue { color: #2563eb; }
          .cert-statement { border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 20px; background: #ffffff; margin-bottom: 28px; }
          .cert-title { font-size: 14px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin-bottom: 10px; }
          .cert-body { font-size: 13px; color: #334155; line-height: 1.7; }
          .signature-section { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
          .sig-box { width: 220px; border-top: 1px solid #0f172a; padding-top: 8px; text-align: center; font-size: 12px; }
          .seal-box { border: 2px solid #059669; border-radius: 50%; width: 95px; height: 95px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #059669; font-size: 9px; font-weight: 900; letter-spacing: 0.5px; transform: rotate(-8deg); }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="badge">Official Financial Audit Certificate</div>
          <h1 class="title">${campaign.title}</h1>
          <p class="subtitle">Bawm Category: ${campaign.category.toUpperCase()} • Campaign ID: ${campaign.id}</p>
        </div>

        <div class="grid">
          <div class="stat-box">
            <div class="stat-label">Total Inflow (Dawn Zat)</div>
            <div class="stat-val green">₹${stats.totalInflow.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Records: ${stats.txCount}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Total Outflow (Senso)</div>
            <div class="stat-val red">₹${stats.totalOutflow.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Vouchers: ${stats.expCount}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Net Closing Balance</div>
            <div class="stat-val blue">₹${stats.netBalance.toLocaleString('en-IN')}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Accounts Balanced</div>
          </div>
        </div>

        <div class="cert-statement">
          <div class="cert-title">⚖️ Auditor's Verification & Compliance Report</div>
          <div class="cert-body">
            He lehkha hmang hian <strong>${campaign.title}</strong> accounts hi <strong>${auditPeriod}</strong> chhung a tan enfiah a, audit fel a ni tih ka nemnghet e. 
            Receipt, voucher leh financial transaction zawng zawngte hi uluk taka endik a ni a, accounts record te hi a dik tawk a ni tih hriatpui a ni.
            <br><br>
            <strong>Auditor Observations / Notes:</strong><br>
            <em>${auditNotes || 'Records and balances verified in order.'}</em>
            <br><br>
            <strong>Total Locked Audited Records:</strong> ${stats.totalLocked} records frozen under Tamper-Proof Financial Lock (${stats.totalAuditVerified} items explicitly checked).
          </div>
        </div>

        <div class="signature-section">
          <div>
            <div class="seal-box">
              <div>RONPAY</div>
              <div style="font-size: 12px;">★ ★ ★</div>
              <div>AUDITED</div>
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 6px;">Certified via RonPay Audit Engine</div>
          </div>

          <div class="sig-box">
            <div style="font-weight: 700; color: #0f172a;">${auditorName}</div>
            <div style="color: #64748b;">Sum Endiktu (Auditor)</div>
            <div style="color: #64748b; font-size: 11px;">Phone: ${auditorPhone || 'N/A'}</div>
            <div style="color: #94a3b8; font-size: 10px; margin-top: 4px;">Date: ${formatDateDDMMYYYY(new Date().toISOString())}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printHtmlSafely(certHtml);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-2.5 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 w-full sm:w-[98vw] max-w-7xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[96vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-4 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-inner shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-lg tracking-tight">
                  Online Financial Audit Portal
                </h3>
                {accessInfo?.hasAccess && !isAdmin && (
                  <span
                    title={accessInfo.grant?.expiresAt ? `Permit tawp hun: ${formatDateDDMMYYYY(accessInfo.grant.expiresAt)}` : 'Auditor Permit Active'}
                    className="text-[9.5px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Permit: {accessInfo.remainingLabel || formatRemainingAuditTimeMizo(accessInfo.grant?.expiresAt)}</span>
                  </span>
                )}
                {isAdmin && (
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    Admin Full Access
                  </span>
                )}
                {!canAudit && (
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    View-Only Mode
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
                {accessibleCampaigns.length > 1 && onSelectCampaign ? (
                  <div className="flex items-center gap-1 bg-white/10 border border-white/15 rounded-xl px-2 py-0.5">
                    <FolderKanban className="w-3 h-3 text-indigo-300 shrink-0" />
                    <select
                      value={campaign.id}
                      onChange={e => {
                        const found = accessibleCampaigns.find(c => c.id === e.target.value);
                        if (found) onSelectCampaign(found);
                      }}
                      className="bg-transparent text-[11px] font-bold text-white focus:outline-none cursor-pointer pr-1"
                    >
                      {accessibleCampaigns.map(c => (
                        <option key={c.id} value={c.id} className="text-slate-900 font-bold">
                          {c.title} ({c.category.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-[11px] sm:text-xs text-indigo-200/80 font-medium truncate">
                    {campaign.title} • {campaign.category.toUpperCase()}
                  </p>
                )}
                <span className="text-[10px] sm:text-[11px] text-indigo-300/90 font-semibold truncate">
                  • Receipts: {stats.txCount} | Vouchers: {stats.expCount} | Closing Bal: ₹{stats.netBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncPortalData}
              disabled={isSyncingPortal}
              title="Server leh Cloud aṭangin record thar ber sync rawh"
              className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPortal ? 'animate-spin text-emerald-300' : 'text-indigo-200'}`} />
              <span className="hidden sm:inline">{isSyncingPortal ? 'Syncing...' : 'Sync Data'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition shrink-0 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Access / Expiry Banner if View-Only */}
        {!canAudit && (
          <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-5 py-2 text-amber-900 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>View-Only Access:</strong> He Bawm-ah hian active Auditor phalna (time-bound grant) i nei rih lo a. Record i thlir thei a, mahse Lock/Verify turin Bawm neitu hnenah phalna dil rawh.
              </span>
            </div>
          </div>
        )}

        {/* Toast */}
        {lockToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-2.5 px-4 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lockToast}</span>
          </div>
        )}

        {/* Tab Navigation — 1-row horizontal scroll on mobile, wrap on desktop */}
        <div className="bg-slate-100 border-b border-slate-200 px-2 sm:px-4 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('cashbook')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-black border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'cashbook'
                ? 'border-indigo-600 text-white bg-indigo-600 shadow-2xs'
                : 'border-indigo-200 text-indigo-800 hover:bg-indigo-100 bg-indigo-50/80'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">📖 Cash Book (Receipts &amp; Payments)</span>
            <span className="inline sm:hidden">📖 Cash Book</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview'
                ? 'border-slate-900 text-white bg-slate-900 shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:bg-white bg-white/70'
            }`}
          >
            <Banknote className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Accounts Overview</span>
            <span className="inline sm:hidden">Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reconcile')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'reconcile'
                ? 'border-emerald-600 text-white bg-emerald-600 shadow-2xs'
                : 'border-emerald-200 text-emerald-800 hover:bg-emerald-100 bg-emerald-50/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">🔍 Cross-Check &amp; Enfiahna</span>
            <span className="inline sm:hidden">🔍 Cross-Check</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transactions'
                ? 'border-emerald-700 text-white bg-emerald-700 shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:bg-white bg-white/70'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Inflow / Thawhlawm ({stats.txCount})</span>
            <span className="inline sm:hidden">Inflow ({stats.txCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'expenses'
                ? 'border-rose-700 text-white bg-rose-700 shadow-2xs'
                : 'border-slate-200 text-slate-700 hover:bg-white bg-white/70'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Outflow / Senso ({stats.expCount})</span>
            <span className="inline sm:hidden">Outflow ({stats.expCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lock_action')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'lock_action'
                ? 'border-amber-600 text-white bg-amber-600 shadow-2xs'
                : 'border-amber-200 text-amber-900 hover:bg-amber-100 bg-amber-50/70'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Sign &amp; Lock Period</span>
            <span className="inline sm:hidden">Sign &amp; Lock</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('certificate')}
            className={`py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'certificate'
                ? 'border-purple-700 text-white bg-purple-700 shadow-2xs'
                : 'border-purple-200 text-purple-900 hover:bg-purple-100 bg-purple-50/70'
            }`}
          >
            <Award className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Audit Certificate</span>
            <span className="inline sm:hidden">Certificate</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-2 sm:p-4 overflow-y-auto space-y-3.5 sm:space-y-5 flex-1">
          {/* TAB: CASH BOOK (RECEIPTS & PAYMENTS) - PRIMARY AUDITOR VIEW */}
          {activeTab === 'cashbook' && (
            <div className="space-y-3 sm:space-y-4">
              {/* Top Control Bar: Date Range Selector + View Toggle + Print */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:p-4 space-y-2.5 sm:space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                  <div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-base flex items-center gap-1.5 sm:gap-2">
                      <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>CASH BOOK (RECEIPTS &amp; PAYMENTS) — AUDIT CHHAWP CHHUAHNA</span>
                    </h4>
                    <p className="text-[10px] sm:text-[11px] text-slate-600">
                      Hun chhung (Range) thlang la, Sum Lut (Receipts) leh Sum Chhuak (Payments) te sawi buai ngai lovin Cash Book aṭang hian Audit nghal rawh.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-start">
                    <div className="inline-flex rounded-xl bg-white border border-slate-300 p-0.5 flex-1 sm:flex-initial">
                      <button
                        type="button"
                        onClick={() => setCbViewMode('ledger')}
                        className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black transition cursor-pointer text-center ${
                          cbViewMode === 'ledger'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="hidden sm:inline">📖 Dr. Receipts / Cr. Payments</span>
                        <span className="sm:hidden">📖 Receipts/Payments</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCbViewMode('chronological')}
                        className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black transition cursor-pointer text-center ${
                          cbViewMode === 'chronological'
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="hidden sm:inline">📋 Chronological (Running Bal)</span>
                        <span className="sm:hidden">📋 Chronological</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCbFullHeight(f => !f)}
                        className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          cbFullHeight
                            ? 'bg-indigo-50 text-indigo-800 border-indigo-300'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {cbFullHeight ? '↕️ Compact' : '↕️ Expand'}
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintAuditedCashBook}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] sm:text-[11px] rounded-xl flex items-center gap-1 cursor-pointer"
                      >
                        <Printer className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Date Range Presets + Responsive Dedicated Custom Date Card */}
                <div className="pt-2.5 border-t border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-[11px] sm:text-xs font-black text-slate-800 flex items-center gap-1 shrink-0 mr-0.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Hun:</span>
                    </span>
                    {[
                      { id: 'all', label: 'A Zavai (All)' },
                      { id: 'this_month', label: 'Kumin Thla' },
                      { id: 'last_month', label: 'Thla Hmasa' },
                      { id: 'today', label: 'Vawiin' },
                      { id: 'custom', label: '📅 Custom Range' }
                    ].map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setCbPreset(p.id as any)}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10.5px] sm:text-[11px] font-bold border transition cursor-pointer ${
                          cbPreset === p.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-black'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}

                    {/* Current Range Label Badge */}
                    <div className="w-full sm:w-auto sm:ml-auto mt-1 sm:mt-0 flex items-center gap-1 text-[10.5px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                      <span className="shrink-0">📍</span>
                      <span className="truncate">Active: <strong className="font-extrabold">{cashBookAuditData.rangeLabel}</strong></span>
                    </div>
                  </div>

                  {/* Dedicated, Full-Width Custom Date Picker Card when 'custom' is active */}
                  {cbPreset === 'custom' && (
                    <div className="w-full bg-white border-2 border-indigo-400/90 rounded-2xl p-3 sm:p-3.5 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span>📅 Hun Thlan Bik (Custom Date Range)</span>
                        </div>
                        {(cbFromDate || cbToDate) && (
                          <button
                            type="button"
                            onClick={() => { setCbFromDate(''); setCbToDate(''); }}
                            className="text-[11px] font-black text-rose-600 hover:text-rose-800 underline cursor-pointer"
                          >
                            Clear Dates
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="bg-slate-50 border border-slate-300 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2">
                          <label className="text-[11px] font-black text-slate-700 shrink-0 flex items-center gap-1">
                            <span>Atanga (From):</span>
                          </label>
                          <input
                            type="date"
                            value={cbFromDate}
                            onChange={e => setCbFromDate(e.target.value)}
                            className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          />
                        </div>
                        <div className="bg-slate-50 border border-slate-300 rounded-xl p-2 sm:p-2.5 flex items-center justify-between gap-2">
                          <label className="text-[11px] font-black text-slate-700 shrink-0 flex items-center gap-1">
                            <span>Thleng (To):</span>
                          </label>
                          <input
                            type="date"
                            value={cbToDate}
                            onChange={e => setCbToDate(e.target.value)}
                            className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Quick Date Presets for Mobile */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10.5px]">
                        <span className="font-extrabold text-slate-500">Awlsam:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const y = now.getFullYear();
                            setCbFromDate(`${y}-01-01`);
                            setCbToDate(`${y}-12-31`);
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer"
                        >
                          Kumin Pum ({new Date().getFullYear()})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const past = new Date();
                            past.setDate(past.getDate() - 30);
                            const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            setCbFromDate(toIso(past));
                            setCbToDate(toIso(now));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer"
                        >
                          Ni 30 Kalta
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date();
                            const past = new Date();
                            past.setDate(past.getDate() - 90);
                            const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                            setCbFromDate(toIso(past));
                            setCbToDate(toIso(now));
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border border-slate-200 cursor-pointer"
                        >
                          Ni 90 Kalta
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audit Chin vs La Audit Loh Filter Bar + Search + Batch Range Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCbAuditFilter('all')}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black border transition cursor-pointer ${
                        cbAuditFilter === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Zavai ({cashBookAuditData.totalEntriesCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCbAuditFilter('audited')}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black border transition cursor-pointer ${
                        cbAuditFilter === 'audited'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      }`}
                    >
                      ✓ Audit ({cashBookAuditData.auditedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCbAuditFilter('unaudited')}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black border transition cursor-pointer ${
                        cbAuditFilter === 'unaudited'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      ⏳ Loh ({cashBookAuditData.unauditedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCbAuditFilter('flagged')}
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] sm:text-[11px] font-black border transition cursor-pointer ${
                        cbAuditFilter === 'flagged'
                          ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                          : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                      }`}
                    >
                      ⚠️ Query ({cashBookAuditData.flaggedCount})
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 min-w-[140px]">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Hming, Head, UTR..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                      />
                    </div>
                    {canAudit && cashBookAuditData.unauditedCount > 0 && (
                      <button
                        type="button"
                        onClick={handleVerifySelectedRange}
                        className="px-2.5 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] sm:text-[11px] rounded-xl shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>✓ Audit Vek</span>
                      </button>
                    )}
                    {canAudit && cashBookAuditData.totalEntriesCount > 0 && (
                      <button
                        type="button"
                        onClick={handleLockSelectedRange}
                        className="px-2.5 sm:px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10.5px] sm:text-[11px] rounded-xl shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>🔒 Lock</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 4-Card Cash Book Summary Strip (Opening B/F, Receipts, Payments, Closing C/D) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 sm:p-3">
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-500 block truncate">Opening (B/F)</span>
                  <span className="text-sm sm:text-base font-black text-slate-900 tabular-nums">
                    ₹{cashBookAuditData.openingBalance.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[9.5px] text-slate-500 block mt-0.5 truncate">
                    {cashBookAuditData.effFrom ? `${formatDateDDMMYYYY(cashBookAuditData.effFrom)} hma` : 'Bawm B/F'}
                  </span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-2.5 sm:p-3">
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-emerald-800 block truncate">Dr. Receipts (Lut)</span>
                  <span className="text-sm sm:text-base font-black text-emerald-700 tabular-nums">
                    +₹{cashBookAuditData.periodReceiptsTotal.toLocaleString('en-IN')}
                  </span>
                  <div className="flex justify-between text-[9px] sm:text-[10px] font-bold mt-0.5">
                    <span className="text-emerald-800">✓ ₹{cashBookAuditData.auditedReceiptsAmt.toLocaleString('en-IN')}</span>
                    <span className="text-amber-800">⏳ ₹{cashBookAuditData.unauditedReceiptsAmt.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-2.5 sm:p-3">
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-rose-800 block truncate">Cr. Payments (Chhuak)</span>
                  <span className="text-sm sm:text-base font-black text-rose-700 tabular-nums">
                    -₹{cashBookAuditData.periodPaymentsTotal.toLocaleString('en-IN')}
                  </span>
                  <div className="flex justify-between text-[9px] sm:text-[10px] font-bold mt-0.5">
                    <span className="text-emerald-800">✓ ₹{cashBookAuditData.auditedPaymentsAmt.toLocaleString('en-IN')}</span>
                    <span className="text-amber-800">⏳ ₹{cashBookAuditData.unauditedPaymentsAmt.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-2.5 sm:p-3">
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-indigo-800 block truncate">Closing Bal (C/D)</span>
                  <span className="text-sm sm:text-base font-black text-indigo-950 tabular-nums">
                    ₹{cashBookAuditData.closingBalance.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[9.5px] font-bold text-indigo-700 block mt-0.5 truncate">
                    ✓ {cashBookAuditData.auditedCount} | ⏳ {cashBookAuditData.unauditedCount}
                  </span>
                </div>
              </div>

              {/* Flag Query Inline Modal inside Cash Book if triggered */}
              {flaggingRecordId && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                      <MessageSquareWarning className="w-4 h-4 text-rose-600" />
                      <span>Auditor Query / Thil Fiah Duh Ziaktu (ID: {flaggingRecordId}):</span>
                    </div>
                    <input
                      type="text"
                      value={flagQueryText}
                      onChange={e => setFlagQueryText(e.target.value)}
                      placeholder="Entirnan: Receipt / Voucher no. a inmil lo, enfiah nawn rawh..."
                      className="w-full px-3 py-1.5 rounded-xl border border-rose-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMarkItem(flaggingRecordType, flaggingRecordId, null, 'flagged', flagQueryText || 'Enfiah ngai / Query awm')}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl cursor-pointer"
                    >
                      ⚠️ Save Query
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFlaggingRecordId(null);
                        setFlagQueryText('');
                      }}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW MODE 1: TRADITIONAL TWO-COLUMN CASH BOOK (Dr. RECEIPTS | Cr. PAYMENTS) */}
              {cbViewMode === 'ledger' ? (
                <div className="space-y-3">
                  {/* Mobile Screen Pane Selector (Receipts vs Payments vs Both) */}
                  <div className="xl:hidden flex items-center bg-slate-100 p-1 rounded-xl border border-slate-300 text-xs font-black gap-1">
                    <button
                      type="button"
                      onClick={() => setMobileLedgerPane('receipts')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-center transition flex items-center justify-center gap-1 cursor-pointer ${
                        mobileLedgerPane === 'receipts'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span className="truncate">Dr. Receipts ({cashBookAuditData.filteredReceipts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileLedgerPane('payments')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-center transition flex items-center justify-center gap-1 cursor-pointer ${
                        mobileLedgerPane === 'payments'
                          ? 'bg-rose-700 text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      <span className="truncate">Cr. Payments ({cashBookAuditData.filteredPayments.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileLedgerPane('both')}
                      className={`py-1.5 px-2.5 rounded-lg text-center transition cursor-pointer ${
                        mobileLedgerPane === 'both'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span>Pahnihin</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                    {/* LEFT SIDE: Dr. RECEIPTS (SUM LUT) */}
                    <div className={`bg-white border-2 border-emerald-700/80 rounded-2xl overflow-hidden flex-col justify-between shadow-2xs ${
                      mobileLedgerPane === 'payments' ? 'hidden xl:flex' : 'flex'
                    }`}>
                      <div>
                        <div className="bg-emerald-900 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between gap-2 flex-wrap">
                          <div className="font-black text-xs sm:text-sm tracking-wide flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-300 shrink-0" />
                            <span>Dr. RECEIPTS (SUM LUT / THAWHLAWM)</span>
                            <span className="text-[11px] font-bold text-emerald-200">
                              ({cashBookAuditData.filteredReceipts.length})
                            </span>
                          </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="inline-flex rounded-lg bg-emerald-950/80 p-0.5 border border-emerald-700">
                            <button
                              type="button"
                              onClick={() => setCbReceiptsMode('head_wise')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer ${
                                cbReceiptsMode === 'head_wise'
                                  ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                                  : 'text-emerald-200 hover:text-white'
                              }`}
                            >
                              📂 Head-wise ({cashBookAuditData.receiptHeadGroups.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setCbReceiptsMode('detailed')}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer ${
                                cbReceiptsMode === 'detailed'
                                  ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                                  : 'text-emerald-200 hover:text-white'
                              }`}
                            >
                              📋 Subsidiary (Mi Mal)
                            </button>
                          </div>
                          {cbReceiptsMode === 'head_wise' && cashBookAuditData.receiptHeadGroups.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const allExp = Object.keys(expandedHeads).length === cashBookAuditData.receiptHeadGroups.length;
                                if (allExp) {
                                  setExpandedHeads({});
                                } else {
                                  const next: Record<string, boolean> = {};
                                  cashBookAuditData.receiptHeadGroups.forEach(g => { next[g.headName] = true; });
                                  setExpandedHeads(next);
                                }
                              }}
                              className="text-[9.5px] font-bold text-emerald-200 hover:text-white underline cursor-pointer"
                            >
                              {Object.keys(expandedHeads).length === cashBookAuditData.receiptHeadGroups.length ? 'Phuih vek' : 'Hawng vek'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className={`overflow-x-auto ${cbFullHeight ? '' : 'max-h-[58vh] overflow-y-auto'}`}>
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 z-10 bg-emerald-50 border-b border-emerald-200 text-[10px] font-black uppercase text-emerald-950">
                            <tr>
                              <th className="p-2">Date &amp; Ref</th>
                              <th className="p-2">Particulars (Sum Lut)</th>
                              <th className="p-2 text-center">Audit</th>
                              <th className="p-2 text-right">Amount (₹)</th>
                              {canAudit && <th className="p-2 text-center">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {/* Opening Balance B/F Row */}
                            <tr className="bg-emerald-50/40 font-bold">
                              <td className="p-2 whitespace-nowrap text-[11px] text-slate-600">
                                <div>{cashBookAuditData.effFrom ? formatDateDDMMYYYY(cashBookAuditData.effFrom) : 'Opening'}</div>
                                <div className="text-[9.5px] font-mono text-slate-400">B/F</div>
                              </td>
                              <td className="p-2 text-slate-900">
                                <div className="font-black">To Balance b/d (Opening Balance)</div>
                                <div className="text-[10px] text-slate-500">Hun hma sum bang rawn kai chhuak</div>
                              </td>
                              <td className="p-2 text-center">
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                                  OPENING
                                </span>
                              </td>
                              <td className="p-2 text-right font-black text-slate-900 whitespace-nowrap tabular-nums">
                                ₹{cashBookAuditData.openingBalance.toLocaleString('en-IN')}
                              </td>
                              {canAudit && <td className="p-2 text-center text-slate-400">—</td>}
                            </tr>

                            {cashBookAuditData.filteredReceipts.length === 0 ? (
                              <tr>
                                <td colSpan={canAudit ? 5 : 4} className="p-6 text-center text-slate-400 font-semibold">
                                  He filter/range chhungah hian Receipts (Sum Lut) a awm rih lo.
                                </td>
                              </tr>
                            ) : cbReceiptsMode === 'head_wise' ? (
                              cashBookAuditData.receiptHeadGroups.map((grp, grpIdx) => {
                                const isExpanded = Boolean(expandedHeads[grp.headName]);
                                const allHeadAudited = grp.unauditedCount === 0 && grp.flaggedCount === 0;
                                return (
                                  <React.Fragment key={grp.headName}>
                                    <tr
                                      className="bg-emerald-50/60 hover:bg-emerald-100/60 transition cursor-pointer font-bold"
                                      onClick={() => setExpandedHeads(prev => ({ ...prev, [grp.headName]: !prev[grp.headName] }))}
                                    >
                                      <td className="p-2 whitespace-nowrap align-top">
                                        <div className="font-bold text-slate-800 text-[11px]">{grp.monthYearLabel || grp.latestDisplayDate}</div>
                                        <div className="text-[9.5px] font-mono text-emerald-700">{grp.count} receipts</div>
                                      </td>
                                      <td className="p-2 align-top">
                                        <div className="font-black text-slate-900 flex items-center gap-1">
                                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-emerald-700 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                                          <span>{grpIdx + 1}. To {grp.baseHead} ({grp.monthYearLabel})</span>
                                        </div>
                                        <div className="text-[10px] text-slate-600">
                                          ✓ Audit: {grp.auditedCount} • ⏳ La Audit Loh: {grp.unauditedCount} (Subsidiary: {grp.count} entries)
                                        </div>
                                      </td>
                                      <td className="p-2 text-center align-top whitespace-nowrap">
                                        {allHeadAudited ? (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            <span>✓ AUDITED</span>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                            <span>⏳ {grp.unauditedCount} LEFT</span>
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 text-right font-black text-emerald-800 align-top whitespace-nowrap tabular-nums">
                                        ₹{grp.totalAmount.toLocaleString('en-IN')}
                                      </td>
                                      {canAudit && (
                                        <td className="p-2 text-center align-top whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                          {grp.unauditedCount > 0 ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                grp.items.forEach(item => {
                                                  if (item.auditCategory !== 'audited') {
                                                    markRecordAuditVerification(
                                                      item.id,
                                                      'transaction',
                                                      'verified',
                                                      auditorName || creatorProfile?.name || 'Auditor',
                                                      ''
                                                    );
                                                  }
                                                });
                                                setTick(t => t + 1);
                                                if (onRecordsUpdated) onRecordsUpdated();
                                              }}
                                              className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                            >
                                              ✓ Audit Head
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (grp.items.some(i => i.is_locked) && !isAdmin) {
                                                  setLockToast('🔒 He Head chhunga record hi Lock tawh a ni a, Admin chiahin a khawih nawn thei.');
                                                  setTimeout(() => setLockToast(null), 3500);
                                                  return;
                                                }
                                                grp.items.forEach(item => {
                                                  markRecordAuditVerification(
                                                    item.id,
                                                    'transaction',
                                                    undefined,
                                                    auditorName || creatorProfile?.name || 'Auditor',
                                                    '',
                                                    true
                                                  );
                                                });
                                                setTick(t => t + 1);
                                                setLockToast(`↩️ '${grp.headName}' Head audit-na sut (Undo) a ni e.`);
                                                if (onRecordsUpdated) onRecordsUpdated();
                                                setTimeout(() => setLockToast(null), 3000);
                                              }}
                                              title="Audit tawh a ni. Click la sut rawh."
                                              className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-100 hover:bg-amber-100 text-emerald-800 hover:text-amber-900 border border-emerald-300 hover:border-amber-400 cursor-pointer transition"
                                            >
                                              ✓ Audited (Undo)
                                            </button>
                                          )}
                                        </td>
                                      )}
                                    </tr>
                                    {isExpanded && grp.items.map(r => (
                                      <tr key={r.id} className="bg-white hover:bg-slate-50 text-[11px]">
                                        <td className="p-2 pl-4 whitespace-nowrap align-top text-slate-600">
                                          <div>{r.displayDate}</div>
                                          <div className="text-[9px] font-mono text-slate-400">{r.voucherOrRef}</div>
                                        </td>
                                        <td className="p-2 align-top">
                                          <div className="font-extrabold text-slate-900">{r.subDetail}</div>
                                          <div className="text-[10px] text-slate-500">{r.particulars} • Mode: {r.paymentMode}</div>
                                        </td>
                                        <td className="p-2 text-center align-top whitespace-nowrap">
                                          {r.auditCategory === 'audited' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">✓ Audited</span>
                                          ) : r.auditCategory === 'flagged' ? (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">⚠️ Query</span>
                                          ) : (
                                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">⏳ Loh</span>
                                          )}
                                        </td>
                                        <td className="p-2 text-right font-bold text-emerald-700 align-top whitespace-nowrap tabular-nums">
                                          ₹{r.amount.toLocaleString('en-IN')}
                                        </td>
                                        {canAudit && (
                                          <td className="p-2 text-center align-top whitespace-nowrap">
                                            <button
                                              type="button"
                                              onClick={() => handleMarkItem('transaction', r.id, r.audit_mark, 'verified', undefined, r.is_locked)}
                                              title={r.is_locked && !isAdmin ? "Audit Submit & Lock tawh a ni (Admin chiahin a khawih theih)" : (r.auditCategory === 'audited' ? "Audit tawh a ni (Click nawn la, sut rawh)" : "Audit / Dik tiin chhinchhiah rawh")}
                                              disabled={r.is_locked && !isAdmin}
                                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-black border transition cursor-pointer ${
                                                r.auditCategory === 'audited'
                                                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                                  : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                              } ${r.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                              ✓ Dik
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              cashBookAuditData.filteredReceipts.map(r => (
                                <tr
                                  key={r.id}
                                  className={`hover:bg-slate-50 transition ${
                                    r.auditCategory === 'audited'
                                      ? 'bg-emerald-50/20'
                                      : r.auditCategory === 'flagged'
                                      ? 'bg-rose-50/30'
                                      : ''
                                  }`}
                                >
                                  <td className="p-2 whitespace-nowrap align-top">
                                    <div className="font-bold text-slate-800 text-[11px]">{r.displayDate}</div>
                                    <div className="text-[9.5px] font-mono text-slate-500">{r.voucherOrRef}</div>
                                  </td>
                                  <td className="p-2 align-top">
                                    <div className="font-extrabold text-slate-900">{r.particulars}</div>
                                    <div className="text-[10.5px] text-slate-500">{r.subDetail} • {r.paymentMode}</div>
                                    {r.audit_remark && (
                                      <div className="mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 inline-block">
                                        ⚠️ Query: {r.audit_remark}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 text-center align-top whitespace-nowrap">
                                    {r.auditCategory === 'audited' ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        {r.is_locked ? <Lock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                        <span>✓ AUDITED</span>
                                      </span>
                                    ) : r.auditCategory === 'flagged' ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                        <span>⚠️ QUERY AWM</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                        <span>⏳ LA AUDIT LOH</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right font-black text-emerald-700 align-top whitespace-nowrap tabular-nums">
                                    ₹{r.amount.toLocaleString('en-IN')}
                                  </td>
                                  {canAudit && (
                                    <td className="p-2 text-center align-top whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleMarkItem('transaction', r.id, r.audit_mark, 'verified', undefined, r.is_locked)}
                                          title={r.is_locked && !isAdmin ? "Audit Submit & Lock tawh a ni (Admin chiahin a khawih theih)" : (r.auditCategory === 'audited' ? "Audit tawh a ni (Click nawn la, sut rawh)" : "Audit / Dik tiin chhinchhiah rawh")}
                                          disabled={r.is_locked && !isAdmin}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                            r.auditCategory === 'audited'
                                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                          } ${r.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          ✓ Dik
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFlaggingRecordType('transaction');
                                            setFlaggingRecordId(r.id);
                                            setFlagQueryText(r.audit_remark || '');
                                          }}
                                          title="Query / Enfiah ngai"
                                          className={`px-1.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition ${
                                            r.audit_mark === 'flagged'
                                              ? 'bg-rose-600 text-white border-rose-600'
                                              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                                          }`}
                                        >
                                          ⚠️
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Dr. Side Balanced Footer */}
                    <div className="bg-emerald-950 text-white px-4 py-3 flex items-center justify-between border-t-2 border-emerald-800 text-xs">
                      <span className="font-black uppercase tracking-wide">
                        Total Receipts (Opening + Sum Lut)
                      </span>
                      <span className="text-sm sm:text-base font-black text-emerald-300 tabular-nums">
                        ₹{(cashBookAuditData.openingBalance + cashBookAuditData.periodReceiptsTotal).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                    {/* RIGHT SIDE: Cr. PAYMENTS (SUM CHHUAK / SENSO) */}
                    <div className={`bg-white border-2 border-rose-700/80 rounded-2xl overflow-hidden flex-col justify-between shadow-2xs ${
                      mobileLedgerPane === 'receipts' ? 'hidden xl:flex' : 'flex'
                    }`}>
                      <div>
                        <div className="bg-rose-900 text-white px-3 sm:px-3.5 py-2 sm:py-2.5 flex items-center justify-between">
                          <div className="font-black text-xs sm:text-sm tracking-wide flex items-center gap-1.5">
                            <TrendingDown className="w-4 h-4 text-rose-300 shrink-0" />
                            <span>Cr. PAYMENTS (SUM CHHUAK / SENSO)</span>
                          </div>
                          <span className="text-[11px] font-bold text-rose-200">
                            {cashBookAuditData.filteredPayments.length} vouchers
                          </span>
                        </div>

                      <div className={`overflow-x-auto ${cbFullHeight ? '' : 'max-h-[58vh] overflow-y-auto'}`}>
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 z-10 bg-rose-50 border-b border-rose-200 text-[10px] font-black uppercase text-rose-950">
                            <tr>
                              <th className="p-2">Date &amp; Voucher</th>
                              <th className="p-2">Particulars (Sum Chhuak)</th>
                              <th className="p-2 text-center">Audit</th>
                              <th className="p-2 text-right">Amount (₹)</th>
                              {canAudit && <th className="p-2 text-center">Action</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {cashBookAuditData.filteredPayments.length === 0 ? (
                              <tr>
                                <td colSpan={canAudit ? 5 : 4} className="p-6 text-center text-slate-400 font-semibold">
                                  He filter/range chhungah hian Payments (Sum Chhuak) a awm rih lo.
                                </td>
                              </tr>
                            ) : (
                              cashBookAuditData.filteredPayments.map(p => (
                                <tr
                                  key={p.id}
                                  className={`hover:bg-slate-50 transition ${
                                    p.auditCategory === 'audited'
                                      ? 'bg-emerald-50/20'
                                      : p.auditCategory === 'flagged'
                                      ? 'bg-rose-50/30'
                                      : ''
                                  }`}
                                >
                                  <td className="p-2 whitespace-nowrap align-top">
                                    <div className="font-bold text-slate-800 text-[11px]">{p.displayDate}</div>
                                    <div className="text-[9.5px] font-mono text-slate-500">{p.voucherOrRef}</div>
                                  </td>
                                  <td className="p-2 align-top">
                                    <div className="font-extrabold text-slate-900">{p.particulars}</div>
                                    <div className="text-[10.5px] text-slate-500">{p.subDetail}</div>
                                    {p.audit_remark && (
                                      <div className="mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5 inline-block">
                                        ⚠️ Query: {p.audit_remark}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2 text-center align-top whitespace-nowrap">
                                    {p.auditCategory === 'audited' ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        {p.is_locked ? <Lock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                        <span>✓ AUDITED</span>
                                      </span>
                                    ) : p.auditCategory === 'flagged' ? (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                        <span>⚠️ QUERY AWM</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                        <span>⏳ LA AUDIT LOH</span>
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-right font-black text-rose-700 align-top whitespace-nowrap tabular-nums">
                                    ₹{p.amount.toLocaleString('en-IN')}
                                  </td>
                                  {canAudit && (
                                    <td className="p-2 text-center align-top whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleMarkItem('expense', p.id, p.audit_mark, 'verified', undefined, p.is_locked)}
                                          title={p.is_locked && !isAdmin ? "Audit Submit & Lock tawh a ni (Admin chiahin a khawih theih)" : (p.auditCategory === 'audited' ? "Audit tawh a ni (Click nawn la, sut rawh)" : "Audit / Dik tiin chhinchhiah rawh")}
                                          disabled={p.is_locked && !isAdmin}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                            p.auditCategory === 'audited'
                                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                          } ${p.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          ✓ Dik
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFlaggingRecordType('expense');
                                            setFlaggingRecordId(p.id);
                                            setFlagQueryText(p.audit_remark || '');
                                          }}
                                          title="Query / Enfiah ngai"
                                          className={`px-1.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition ${
                                            p.audit_mark === 'flagged'
                                              ? 'bg-rose-600 text-white border-rose-600'
                                              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                                          }`}
                                        >
                                          ⚠️
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              ))
                            )}

                            {/* Closing Balance C/D Row */}
                            <tr className="bg-indigo-50/70 font-bold border-t border-indigo-200">
                              <td className="p-2 whitespace-nowrap text-[11px] text-indigo-900">
                                <div>{cashBookAuditData.effTo ? formatDateDDMMYYYY(cashBookAuditData.effTo) : 'Closing'}</div>
                                <div className="text-[9.5px] font-mono text-indigo-600">C/D</div>
                              </td>
                              <td className="p-2 text-indigo-950">
                                <div className="font-black">By Balance c/d (Closing Balance / Sum Bang)</div>
                                <div className="text-[10px] text-indigo-700">Receipts Total ₹{cashBookAuditData.periodReceiptsTotal.toLocaleString('en-IN')} − Payments ₹{cashBookAuditData.periodPaymentsTotal.toLocaleString('en-IN')}</div>
                              </td>
                              <td className="p-2 text-center">
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900">
                                  CLOSING
                                </span>
                              </td>
                              <td className="p-2 text-right font-black text-indigo-900 whitespace-nowrap tabular-nums">
                                ₹{cashBookAuditData.closingBalance.toLocaleString('en-IN')}
                              </td>
                              {canAudit && <td className="p-2 text-center text-slate-400">—</td>}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Cr. Side Balanced Footer */}
                    <div className="bg-rose-950 text-white px-4 py-3 flex items-center justify-between border-t-2 border-rose-800 text-xs">
                      <span className="font-black uppercase tracking-wide">
                        Total Payments + Closing Balance
                      </span>
                      <span className="text-sm sm:text-base font-black text-rose-300 tabular-nums">
                        ₹{(cashBookAuditData.openingBalance + cashBookAuditData.periodReceiptsTotal).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SUBSIDIARY CASH LEDGER (A HNUAIA HEAD & THLA BI CHIPCHIAR ENNA) */}
                {cashBookAuditData.receiptHeadGroups.length > 0 && (
                  <div className="mt-4 bg-white border-2 border-slate-300 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="font-black text-xs sm:text-sm tracking-wide uppercase flex items-center gap-2">
                          <span>📋 SUBSIDIARY CASH LEDGER (HEAD &amp; THLA BI CHIPCHIAR)</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                            {cashBookAuditData.receiptHeadGroups.length} Monthly Heads • {cashBookAuditData.filteredReceipts.length} Entries
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Main Cash Book-a Head &amp; Thla bi belhkhawm chhunga mimal / pawl / inkhawm thawhlawm lut chipchiar enfiahna:
                        </p>
                      </div>
                    </div>
                    <div className="p-3 sm:p-4 space-y-3 bg-slate-50/60 max-h-[55vh] overflow-y-auto">
                      {cashBookAuditData.receiptHeadGroups.map((grp, grpIdx) => {
                        const allHeadAudited = grp.unauditedCount === 0 && grp.flaggedCount === 0;
                        return (
                          <div key={`sub_sched_${grp.headName}`} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <div className="bg-emerald-950/90 text-white px-3.5 py-2 flex items-center justify-between flex-wrap gap-2">
                              <div className="font-black text-xs flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px] font-black">
                                  #{grpIdx + 1}
                                </span>
                                <span>{grp.baseHead} — {grp.monthYearLabel}</span>
                                <span className="text-[10px] text-emerald-300 font-bold">({grp.count} entries)</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {allHeadAudited ? (
                                  <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/40">
                                    ✓ AUDITED ({grp.auditedCount}/{grp.count})
                                  </span>
                                ) : (
                                  <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40">
                                    ⏳ {grp.unauditedCount} LA AUDIT LOH
                                  </span>
                                )}
                                <span className="font-black text-xs sm:text-sm text-emerald-300 tabular-nums">
                                  Total: ₹{grp.totalAmount.toLocaleString('en-IN')}
                                </span>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-[11px]">
                                <thead className="bg-slate-100 border-b border-slate-200 text-[9.5px] font-black uppercase text-slate-600">
                                  <tr>
                                    <th className="py-1.5 px-2.5 w-10">#</th>
                                    <th className="py-1.5 px-2.5">Date &amp; Ref</th>
                                    <th className="py-1.5 px-2.5">Pek Tu / Hming &amp; Bial</th>
                                    <th className="py-1.5 px-2.5 text-center">Mode</th>
                                    <th className="py-1.5 px-2.5 text-center">Audit</th>
                                    <th className="py-1.5 px-2.5 text-right">Amount (₹)</th>
                                    {canAudit && <th className="py-1.5 px-2.5 text-center">Action</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {grp.items.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                      <td className="py-1.5 px-2.5 font-mono text-slate-400">{idx + 1}</td>
                                      <td className="py-1.5 px-2.5 whitespace-nowrap">
                                        <span className="font-bold text-slate-800">{item.displayDate}</span>
                                        <span className="ml-1.5 text-[9.5px] font-mono text-slate-400">{item.voucherOrRef}</span>
                                      </td>
                                      <td className="py-1.5 px-2.5 font-bold text-slate-800">{item.subDetail}</td>
                                      <td className="py-1.5 px-2.5 text-center font-mono text-[10px] text-slate-600">{item.paymentMode}</td>
                                      <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                        {item.auditCategory === 'audited' ? (
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">✓ AUDITED</span>
                                        ) : item.auditCategory === 'flagged' ? (
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">⚠️ QUERY</span>
                                        ) : (
                                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">⏳ LA AUDIT LOH</span>
                                        )}
                                      </td>
                                      <td className="py-1.5 px-2.5 text-right font-black text-emerald-700 tabular-nums">
                                        ₹{item.amount.toLocaleString('en-IN')}
                                      </td>
                                      {canAudit && (
                                        <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                                          <button
                                            type="button"
                                            onClick={() => handleMarkItem('transaction', item.id, item.audit_mark, 'verified', undefined, item.is_locked)}
                                            disabled={item.is_locked && !isAdmin}
                                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-black border transition cursor-pointer ${
                                              item.auditCategory === 'audited'
                                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                                : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                            } ${item.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                          >
                                            ✓ Dik
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              ) : (
                /* VIEW MODE 2: CHRONOLOGICAL SINGLE CASH BOOK WITH RUNNING BALANCE */
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                    <span className="font-black text-xs sm:text-sm">
                      📋 CHRONOLOGICAL CASH BOOK (RECEIPTS, PAYMENTS &amp; RUNNING BALANCE)
                    </span>
                    <span className="text-[11px] font-bold text-indigo-200">
                      {cashBookAuditData.filteredChronological.length} entries
                    </span>
                  </div>
                  <div className={`overflow-x-auto ${cbFullHeight ? '' : 'max-h-[60vh] overflow-y-auto'}`}>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-700">
                        <tr>
                          <th className="p-2.5">Date &amp; Ref</th>
                          <th className="p-2.5">Particulars</th>
                          <th className="p-2.5 text-center">Audit Status</th>
                          <th className="p-2.5 text-right text-emerald-800">Receipts (+₹)</th>
                          <th className="p-2.5 text-right text-rose-800">Payments (-₹)</th>
                          <th className="p-2.5 text-right text-indigo-900">Balance (₹)</th>
                          {canAudit && <th className="p-2.5 text-center">Audit Action</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr className="bg-slate-50 font-bold">
                          <td className="p-2.5 text-[11px]">{cashBookAuditData.effFrom ? formatDateDDMMYYYY(cashBookAuditData.effFrom) : 'Opening'}</td>
                          <td className="p-2.5 font-black text-slate-800">Opening Balance (B/F)</td>
                          <td className="p-2.5 text-center">—</td>
                          <td className="p-2.5 text-right">—</td>
                          <td className="p-2.5 text-right">—</td>
                          <td className="p-2.5 text-right font-black text-slate-900 tabular-nums">₹{cashBookAuditData.openingBalance.toLocaleString('en-IN')}</td>
                          {canAudit && <td className="p-2.5 text-center">—</td>}
                        </tr>
                        {cashBookAuditData.filteredChronological.map(item => (
                          <tr key={`${item.recordType}_${item.id}`} className="hover:bg-slate-50">
                            <td className="p-2.5 whitespace-nowrap">
                              <div className="font-bold text-slate-800 text-[11px]">{item.displayDate}</div>
                              <div className="text-[9.5px] font-mono text-slate-500">{item.voucherOrRef}</div>
                            </td>
                            <td className="p-2.5">
                              <div className="font-extrabold text-slate-900">{item.particulars}</div>
                              <div className="text-[10.5px] text-slate-500">{item.subDetail}</div>
                            </td>
                            <td className="p-2.5 text-center whitespace-nowrap">
                              {item.auditCategory === 'audited' ? (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  {item.is_locked ? <Lock className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                                  <span>✓ AUDITED</span>
                                </span>
                              ) : item.auditCategory === 'flagged' ? (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                  <span>⚠️ QUERY AWM</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                  <span>⏳ LA AUDIT LOH</span>
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-right font-black text-emerald-700 whitespace-nowrap tabular-nums">
                              {item.entryType === 'INFLOW' ? `+₹${item.amount.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-black text-rose-700 whitespace-nowrap tabular-nums">
                              {item.entryType === 'OUTFLOW' ? `-₹${item.amount.toLocaleString('en-IN')}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-black text-indigo-950 whitespace-nowrap tabular-nums">
                              ₹{item.runningBalance.toLocaleString('en-IN')}
                            </td>
                            {canAudit && (
                              <td className="p-2.5 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkItem(item.recordType, item.id, item.audit_mark, 'verified', undefined, item.is_locked)}
                                    title={item.is_locked && !isAdmin ? "Audit Submit & Lock tawh a ni (Admin chiahin a khawih theih)" : (item.auditCategory === 'audited' ? "Audit tawh a ni (Click nawn la, sut rawh)" : "Audit / Dik tiin chhinchhiah rawh")}
                                    disabled={item.is_locked && !isAdmin}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                      item.auditCategory === 'audited'
                                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                        : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                    } ${item.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                  >
                                    ✓ Dik
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFlaggingRecordType(item.recordType);
                                      setFlaggingRecordId(item.id);
                                      setFlagQueryText(item.audit_remark || '');
                                    }}
                                    className={`px-1.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer ${
                                      item.audit_mark === 'flagged'
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                                    }`}
                                  >
                                    ⚠️
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-2xs space-y-1.5">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Total Inflow (Sum Lut Zawng Zawng)</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-950 tabular-nums">
                    ₹{stats.totalInflow.toLocaleString('en-IN')}
                  </div>
                  <div className="pt-1 border-t border-emerald-200/70 space-y-1 text-[11px]">
                    <div className="flex justify-between text-emerald-900 font-bold">
                      <span>✓ Endik Fel (Verified: {stats.auditVerifiedTxCount}):</span>
                      <span>₹{stats.verifiedInflowAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>⚠️ Query Awm (Flagged: {stats.auditFlaggedTxCount}):</span>
                      <span>₹{stats.flaggedInflowAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-semibold">
                      <span>⏳ Endik Loh (Pending: {stats.uncheckedTxCount}):</span>
                      <span>₹{stats.uncheckedInflowAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 shadow-2xs space-y-1.5">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    <span>Total Outflow (Sum Chhuak / Senso)</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-950 tabular-nums">
                    ₹{stats.totalOutflow.toLocaleString('en-IN')}
                  </div>
                  <div className="pt-1 border-t border-rose-200/70 space-y-1 text-[11px]">
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>✓ Endik Fel (Verified: {stats.auditVerifiedExpCount}):</span>
                      <span>₹{stats.verifiedOutflowAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>⚠️ Query Awm (Flagged: {stats.auditFlaggedExpCount}):</span>
                      <span>₹{stats.flaggedOutflowAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 font-semibold">
                      <span>⏳ Endik Loh (Pending: {stats.uncheckedExpCount}):</span>
                      <span>₹{stats.uncheckedOutflowAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 shadow-2xs space-y-1.5">
                  <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-indigo-600" />
                    <span>Net Closing Balance (Sum Bang)</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-950 tabular-nums">
                    ₹{stats.netBalance.toLocaleString('en-IN')}
                  </div>
                  <div className="pt-1 border-t border-indigo-200/70 space-y-1 text-[11px]">
                    <div className="flex justify-between text-slate-700 font-bold">
                      <span>Opening Balance (B/F):</span>
                      <span>₹{stats.openingBalance.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-emerald-800 font-bold">
                      <span>✓ Verified Net Balance:</span>
                      <span>₹{(stats.openingBalance + stats.verifiedInflowAmount - stats.verifiedOutflowAmount).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-indigo-700 font-semibold">
                      <span>Total Records:</span>
                      <span>{stats.totalRecords} ({stats.totalAuditVerified} ✓ | {stats.totalAuditFlagged} ⚠️)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column-wise Audit Verification Summary Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs sm:text-sm font-black flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Endikna Dinhmun Kimchang (Column-wise Audit Verification Table)</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-indigo-200">
                    Verified &amp; Flagged Zat (Count leh ₹ Amount)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-700">
                        <th className="p-3">Account Head</th>
                        <th className="p-3 text-right">Total Zawng Zawng</th>
                        <th className="p-3 text-right bg-emerald-50/80 text-emerald-900">✓ Verified (Dik)</th>
                        <th className="p-3 text-right bg-rose-50/80 text-rose-900">⚠️ Flagged (Query)</th>
                        <th className="p-3 text-right bg-slate-50 text-slate-700">⏳ Endik Loh (Pending)</th>
                        <th className="p-3 text-right bg-amber-50/80 text-amber-900">🔒 Locked (Frozen)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {stats.openingBalance > 0 && (
                        <tr className="bg-slate-50/80">
                          <td className="p-3 font-extrabold text-slate-800">
                            0. Opening Balance (Brought Forward)
                          </td>
                          <td className="p-3 text-right font-black text-slate-900">
                            ₹{stats.openingBalance.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right bg-emerald-50/40 font-black text-emerald-700">
                            ₹{stats.openingBalance.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right bg-rose-50/40 text-slate-400">—</td>
                          <td className="p-3 text-right text-slate-400">—</td>
                          <td className="p-3 text-right bg-amber-50/40 text-slate-500">B/F</td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/80">
                        <td className="p-3 font-extrabold text-emerald-900">
                          1. Inflow (Thawhlawm / Sum Lut)
                        </td>
                        <td className="p-3 text-right">
                          <div className="font-black text-slate-900">₹{stats.totalInflow.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-500">{stats.txCount} records</div>
                        </td>
                        <td className="p-3 text-right bg-emerald-50/40">
                          <div className="font-black text-emerald-700">₹{stats.verifiedInflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] font-bold text-emerald-600">{stats.auditVerifiedTxCount} ✓ dik</div>
                        </td>
                        <td className="p-3 text-right bg-rose-50/40">
                          <div className="font-black text-rose-700">₹{stats.flaggedInflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] font-bold text-rose-600">{stats.auditFlaggedTxCount} ⚠️ query</div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="font-bold text-slate-700">₹{stats.uncheckedInflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-500">{stats.uncheckedTxCount} endik loh</div>
                        </td>
                        <td className="p-3 text-right bg-amber-50/40">
                          <div className="font-black text-amber-800">₹{stats.lockedInflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] font-bold text-amber-700">{stats.lockedTxCount} locked</div>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/80">
                        <td className="p-3 font-extrabold text-rose-900">
                          2. Outflow (Senso / Sum Chhuak)
                        </td>
                        <td className="p-3 text-right">
                          <div className="font-black text-slate-900">₹{stats.totalOutflow.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-500">{stats.expCount} vouchers</div>
                        </td>
                        <td className="p-3 text-right bg-emerald-50/40">
                          <div className="font-black text-emerald-700">₹{stats.verifiedOutflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] font-bold text-emerald-600">{stats.auditVerifiedExpCount} ✓ dik</div>
                        </td>
                        <td className="p-3 text-right bg-rose-50/40">
                          <div className="font-black text-rose-700">₹{stats.flaggedOutflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] font-bold text-rose-600">{stats.auditFlaggedExpCount} ⚠️ query</div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="font-bold text-slate-700">₹{stats.uncheckedOutflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] text-slate-500">{stats.uncheckedExpCount} endik loh</div>
                        </td>
                        <td className="p-3 text-right bg-amber-50/40">
                          <div className="font-black text-amber-800">₹{stats.lockedOutflowAmount.toLocaleString('en-IN')}</div>
                          <div className="text-[10px] font-bold text-amber-700">{stats.lockedExpCount} locked</div>
                        </td>
                      </tr>
                      <tr className="bg-indigo-50/60 font-black border-t-2 border-indigo-200">
                        <td className="p-3 text-indigo-950">
                          3. Net Closing Balance (Opening + Lut - Chhuak)
                        </td>
                        <td className="p-3 text-right text-indigo-950">
                          ₹{stats.netBalance.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-emerald-800">
                          ₹{(stats.openingBalance + stats.verifiedInflowAmount - stats.verifiedOutflowAmount).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right text-rose-800">
                          ₹{(stats.flaggedInflowAmount + stats.flaggedOutflowAmount).toLocaleString('en-IN')} (Queries)
                        </td>
                        <td className="p-3 text-right text-slate-700">
                          {stats.totalUnchecked} items left
                        </td>
                        <td className="p-3 text-right text-amber-900">
                          {stats.totalLocked} / {stats.totalRecords} Locked
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Audit Lock Status Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Financial Tamper-Proof Lock Status</span>
                  </h4>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    {campaign.lastAuditedBy && (
                      <span className="text-[11px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-200">
                        Last Audited by: {campaign.lastAuditedBy}
                      </span>
                    )}
                    <span>{stats.totalLocked} of {stats.totalRecords} records locked</span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full transition-all duration-500"
                    style={{ width: `${stats.totalRecords > 0 ? (stats.totalLocked / stats.totalRecords) * 100 : 0}%` }}
                  />
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('lock_action')}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Audit Sign &amp; Lock Records</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAuditedLedgerCSV}
                    className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Audited Ledger (CSV)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('certificate')}
                    className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Print Audit Certificate</span>
                  </button>
                </div>
              </div>

              {/* Interactive Audit Verification Checklist */}
              <div className="bg-white border border-indigo-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span>Audit Verification Checklist (Saved to Bawm)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Checklist hi ziak felin audit nemnghehna neih nan hmang rawh
                    </p>
                  </div>
                  <span className="text-xs font-black px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {checkedCount} / 5 Verified ({checklistPercent}%)
                  </span>
                </div>

                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${checklistPercent}%` }}
                  />
                </div>

                <div className="space-y-2 text-xs pt-1">
                  {[
                    { key: 'bank_reconciliation', label: 'Bank Passbook & e-Statement Reconciled with Inflow / Outflow' },
                    { key: 'vouchers_receipts', label: 'Physical Vouchers & Online Payment Receipts Verified' },
                    { key: 'member_giving_roll', label: 'Member Roll Monthly Giving & Donation Receipts Cross-Checked' },
                    { key: 'cash_in_hand', label: 'Physical Cash Balance in Hand & Bank Balance Confirmed' },
                    { key: 'discrepancy_check', label: 'Zero Unauthorized Alterations or Discrepancies Detected' },
                  ].map(item => (
                    <label 
                      key={item.key} 
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition select-none ${
                        canAudit ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                      } ${
                        checklist[item.key]
                          ? 'bg-emerald-50/60 border-emerald-300 text-emerald-950 font-bold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        disabled={!canAudit}
                        checked={Boolean(checklist[item.key])}
                        onChange={() => toggleChecklistItem(item.key)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="flex-1">{item.label}</span>
                      {checklist[item.key] && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              </div>

              {/* Auditor Guidance Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3 flex-1 min-w-[240px]">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-blue-950">Auditor Tan Sum Dik Leh Dik Loh Cross-Check Dan:</div>
                    <p className="leading-relaxed text-blue-800">
                      <strong>"🔍 Cross-Check &amp; Enfiahna"</strong> tab-ah lutin Bank Passbook, Treasurer Pawisa Fai (Cash-in-Hand), Member Roll, Bial/Section pekna, leh Collector Receipt Book te nena a inmil leh mil loh enfiah theih a ni.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('reconcile')}
                  className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-2xs transition shrink-0 cursor-pointer"
                >
                  🔍 Cross-Check Hub Hawng Rawh →
                </button>
              </div>
            </div>
          )}

          {/* TAB: CROSS-CHECK & RECONCILIATION HUB */}
          {activeTab === 'reconcile' && (
            <div className="space-y-6">
              {/* 1. Physical Bank Passbook & Cash-in-Hand Cross-Check Calculator */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      Step 1 • Physical Balance Verification
                    </span>
                    <h4 className="font-black text-sm sm:text-base mt-1.5">
                      1. Bank Passbook &amp; Pawisa Fai (Cash-in-Hand) Cross-Check Calculator
                    </h4>
                    <p className="text-xs text-indigo-200/90 mt-0.5">
                      System-a sum awm tur zat leh Treasurer kuta Bank Statement + Cash awm tak tak zat chhut milna
                    </p>
                  </div>
                  <div className="text-right bg-white/10 border border-white/15 rounded-xl px-3.5 py-2">
                    <span className="text-[10px] text-indigo-200 uppercase font-bold block">System Closing Balance (Awm Tur)</span>
                    <span className="text-lg sm:text-xl font-black text-emerald-300">
                      ₹{crossCheckData.expectedClosingBalance.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* System Expected Split: Online/Bank vs Cash */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white/10 border border-white/15 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-indigo-200 uppercase block">
                      A. Bank / Online UPI Balance Tur
                    </span>
                    <div className="text-base font-black text-white">
                      ₹{crossCheckData.expectedBankBalance.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10.5px] text-indigo-200/80 space-y-0.5 pt-1 border-t border-white/10">
                      <div>Opening: ₹{crossCheckData.openingBalance.toLocaleString('en-IN')}</div>
                      <div>+ UPI/Online Lut ({crossCheckData.onlineInflowCount}): ₹{crossCheckData.onlineInflowAmount.toLocaleString('en-IN')}</div>
                      <div>- Bank/UPI Senso ({crossCheckData.onlineOutflowCount}): ₹{crossCheckData.onlineOutflowAmount.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <div className="bg-white/10 border border-white/15 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-amber-200 uppercase block">
                      B. Pawisa Fai (Cash-in-Hand) Tur
                    </span>
                    <div className="text-base font-black text-amber-300">
                      ₹{crossCheckData.expectedCashInHand.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10.5px] text-indigo-200/80 space-y-0.5 pt-1 border-t border-white/10">
                      <div>+ Cash Receipt Lut ({crossCheckData.cashInflowCount}): ₹{crossCheckData.cashInflowAmount.toLocaleString('en-IN')}</div>
                      <div>- Cash Voucher Senso ({crossCheckData.cashOutflowCount}): ₹{crossCheckData.cashOutflowAmount.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  <div className="bg-white/10 border border-white/15 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase block">
                      C. Verified vs Total Records
                    </span>
                    <div className="text-base font-black text-emerald-300">
                      {stats.totalAuditVerified} / {stats.totalRecords} Checked
                    </div>
                    <div className="text-[10.5px] text-indigo-200/80 space-y-0.5 pt-1 border-t border-white/10">
                      <div>✓ Verified Lut: ₹{stats.verifiedInflowAmount.toLocaleString('en-IN')}</div>
                      <div>✓ Verified Senso: ₹{stats.verifiedOutflowAmount.toLocaleString('en-IN')}</div>
                      <div>⚠️ Flagged Queries: {stats.totalAuditFlagged} items</div>
                    </div>
                  </div>
                </div>

                {/* Auditor Physical Count Input */}
                <div className="bg-white text-slate-900 rounded-xl p-3.5 space-y-3">
                  <div className="text-xs font-black text-slate-800 flex items-center justify-between flex-wrap gap-2">
                    <span>✍️ Auditor-in Bank Passbook leh Pawisa Fai a chhiar zat chhut luhna:</span>
                    {campaign.auditReconciliation?.updatedAt && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Last Saved: {formatDateDDMMYYYY(campaign.auditReconciliation.updatedAt)} ({campaign.auditReconciliation.updatedBy})
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        1. Bank Passbook / Statement Balance Awm Zat (₹)
                      </label>
                      <input
                        type="number"
                        disabled={!canAudit}
                        value={bankPassbookInput}
                        onChange={e => setBankPassbookInput(e.target.value)}
                        placeholder={`Expected: ${crossCheckData.expectedBankBalance}`}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        2. Treasurer Kuta Pawisa Fai (Cash-in-Hand) Awm Zat (₹)
                      </label>
                      <input
                        type="number"
                        disabled={!canAudit}
                        value={cashInHandInput}
                        onChange={e => setCashInHandInput(e.target.value)}
                        placeholder={`Expected: ${crossCheckData.expectedCashInHand}`}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Live Discrepancy Result */}
                  {(bankPassbookInput.trim() !== '' || cashInHandInput.trim() !== '') && (() => {
                    const actualBank = Number(bankPassbookInput) || 0;
                    const actualCash = Number(cashInHandInput) || 0;
                    const actualTotal = actualBank + actualCash;
                    const diff = actualTotal - crossCheckData.expectedClosingBalance;
                    const isExactMatch = Math.abs(diff) < 1;
                    return (
                      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        isExactMatch
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : 'bg-rose-50 border-rose-300 text-rose-950'
                      }`}>
                        <div className="space-y-0.5">
                          <div className="font-black text-sm flex items-center gap-1.5">
                            {isExactMatch ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>✅ A INMIL THLAP! (System Balance leh Pawisa Awm Zat ₹0 Difference)</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>
                                  ⚠️ A INMIL LO! Difference: ₹{Math.abs(diff).toLocaleString('en-IN')} ({diff > 0 ? 'Pawisa awm a tam zawk / Excess' : 'Pawisa awm a tlem zawk / Shortage'})
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-[11px] opacity-90">
                            System Closing Balance: <strong>₹{crossCheckData.expectedClosingBalance.toLocaleString('en-IN')}</strong> • Actual Chhiar Zat (Bank ₹{actualBank.toLocaleString('en-IN')} + Cash ₹{actualCash.toLocaleString('en-IN')}): <strong>₹{actualTotal.toLocaleString('en-IN')}</strong>
                          </p>
                        </div>
                        {canAudit && (
                          <button
                            type="button"
                            onClick={handleSaveReconciliation}
                            className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shrink-0 cursor-pointer"
                          >
                            💾 Save Cross-Check
                          </button>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 2. Automated Anomaly & Duplicate Scanner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>2. Auto-Audit Scanner (Duplicate, UTR &amp; Voucher Enfiahna)</span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      System-in entry rinhlelhawm (ni khata hming leh zat inang lut nawn, UTR awm lo, Voucher No. kim lo) a scan chhuah te
                    </p>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                    crossCheckData.anomalies.length === 0
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}>
                    {crossCheckData.anomalies.length === 0 ? '✅ Anomaly 0 (Fihlim)' : `⚠️ ${crossCheckData.anomalies.length} Items Enfiah Ngai`}
                  </span>
                </div>

                {crossCheckData.anomalies.length === 0 ? (
                  <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Duplicate entry emaw, UPI UTR kim lo emaw, Expense Voucher kim lo hmuh a ni lo.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                    {crossCheckData.anomalies.map((anom, idx) => (
                      <div key={`${anom.id}_${idx}`} className="p-3 bg-white hover:bg-slate-50 flex items-center justify-between gap-3 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              anom.severity === 'high' ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {anom.severity === 'high' ? 'HIGH RISK' : 'CHECK'}
                            </span>
                            <span>{anom.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">{anom.detail}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery(anom.id);
                            setActiveTab(anom.type === 'transaction' ? 'transactions' : 'expenses');
                          }}
                          className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 shrink-0 cursor-pointer"
                        >
                          Enfiah Rawh →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Member Roll vs Ledger & Section/Bial Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                      3. Bial / Section-wise Sum Lut Cross-Check
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      Bial Collector List nena milna
                    </span>
                  </div>
                  <div className="text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between">
                    <span>Member Roll Lut ({crossCheckData.memberTxCount} receipts): <strong>₹{crossCheckData.memberGivingAmount.toLocaleString('en-IN')}</strong></span>
                    <span>Public/General ({crossCheckData.publicTxCount}): <strong>₹{crossCheckData.publicGivingAmount.toLocaleString('en-IN')}</strong></span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                          <th className="p-2.5">Bial / Section</th>
                          <th className="p-2.5 text-right">Receipts</th>
                          <th className="p-2.5 text-right">Verified</th>
                          <th className="p-2.5 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {crossCheckData.sectionBreakdown.map(sec => (
                          <tr key={sec.section} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{sec.section}</td>
                            <td className="p-2.5 text-right text-slate-600">{sec.count}</td>
                            <td className="p-2.5 text-right text-emerald-700 font-bold">{sec.verifiedCount}/{sec.count} ✓</td>
                            <td className="p-2.5 text-right font-black text-slate-900">₹{sec.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Collector / Approver & Payment Channel Breakdown */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                      4. Collector / Receipt Book Cross-Check
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      Pawisa Khawntu / Gateway milna
                    </span>
                  </div>
                  <div className="text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between">
                    <span>UPI/Online: <strong>₹{crossCheckData.onlineInflowAmount.toLocaleString('en-IN')}</strong></span>
                    <span>Cash/Manual: <strong>₹{crossCheckData.cashInflowAmount.toLocaleString('en-IN')}</strong></span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
                          <th className="p-2.5">Collector / Channel</th>
                          <th className="p-2.5">Mode</th>
                          <th className="p-2.5 text-right">Receipts</th>
                          <th className="p-2.5 text-right">Total (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {crossCheckData.collectorBreakdown.map((col, idx) => (
                          <tr key={`${col.collector}_${idx}`} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-800">{col.collector}</td>
                            <td className="p-2.5">
                              <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded ${
                                col.mode === 'CASH' ? 'bg-amber-100 text-amber-900' : 'bg-indigo-100 text-indigo-900'
                              }`}>
                                {col.mode}
                              </span>
                            </td>
                            <td className="p-2.5 text-right text-slate-600">{col.count}</td>
                            <td className="p-2.5 text-right font-black text-slate-900">₹{col.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
              {/* Column-wise Summary Bar for Inflow */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Sum Lut ({stats.txCount})</span>
                  <span className="text-sm font-black text-slate-900">₹{stats.totalInflow.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">✓ Dik / Verified ({stats.auditVerifiedTxCount})</span>
                  <span className="text-sm font-black text-emerald-700">₹{stats.verifiedInflowAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-rose-50/80 p-2.5 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">⚠️ Query / Flagged ({stats.auditFlaggedTxCount})</span>
                  <span className="text-sm font-black text-rose-700">₹{stats.flaggedInflowAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">⏳ Endik Loh ({stats.uncheckedTxCount})</span>
                    <span className="text-sm font-black text-amber-800">₹{stats.uncheckedInflowAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {canAudit && stats.uncheckedTxCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleVerifyAllRecords('transaction')}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg shadow-2xs shrink-0 cursor-pointer"
                    >
                      ✓ Endik Vek Rawh
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by donor name, phone, tx ID..."
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('all')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'all' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    All ({allTransactions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('verified')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'verified' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    ✓ Dik ({stats.auditVerifiedTxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('flagged')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'flagged' ? 'bg-white shadow-2xs text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    ⚠️ Query ({stats.auditFlaggedTxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('unchecked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'unchecked' ? 'bg-white shadow-2xs text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    ⏳ Endik Loh ({stats.uncheckedTxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('locked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'locked' ? 'bg-white shadow-2xs text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    🔒 Locked ({stats.lockedTxCount})
                  </button>
                </div>
              </div>

              {/* View Mode Toggle: Head / Category-wise (Default) vs Mimal Tin */}
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setInflowViewMode('head_wise')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                      inflowViewMode === 'head_wise'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <FolderTree className="w-3.5 h-3.5" />
                    <span>📂 Head-wise ({inflowHeadGroups.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInflowViewMode('detailed')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                      inflowViewMode === 'detailed'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>👤 Mimal Tin ({filteredTransactions.length})</span>
                  </button>
                </div>

                {inflowViewMode === 'head_wise' && inflowHeadGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const allExp = Object.keys(expandedInflowHeads).length === inflowHeadGroups.length;
                      if (allExp) {
                        setExpandedInflowHeads({});
                      } else {
                        const next: Record<string, boolean> = {};
                        inflowHeadGroups.forEach(g => { next[g.headName] = true; });
                        setExpandedInflowHeads(next);
                      }
                    }}
                    className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                  >
                    {Object.keys(expandedInflowHeads).length === inflowHeadGroups.length ? 'Phuih vek (Collapse All)' : 'Hawng vek (Expand All)'}
                  </button>
                )}
              </div>

              {inflowViewMode === 'head_wise' ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[55vh] overflow-y-auto">
                  {inflowHeadGroups.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No transactions found matching filter.
                    </div>
                  ) : (
                    inflowHeadGroups.map(grp => {
                      const isExp = Boolean(expandedInflowHeads[grp.headName]);
                      const allAudited = grp.uncheckedCount === 0 && grp.flaggedCount === 0;
                      return (
                        <div key={grp.headName} className="bg-white">
                          <div
                            onClick={() => setExpandedInflowHeads(prev => ({ ...prev, [grp.headName]: !prev[grp.headName] }))}
                            className="p-3 hover:bg-emerald-50/50 transition cursor-pointer flex items-center justify-between gap-3 flex-wrap"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                                {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="font-black text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                  <span>To {grp.headName}</span>
                                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    {grp.count} receipts
                                  </span>
                                </div>
                                <div className="text-[10.5px] text-slate-500 flex items-center gap-2 flex-wrap">
                                  <span>Hman hnuhnun: {grp.latestDisplayDate}</span>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-bold">✓ Verified: {grp.verifiedCount}</span>
                                  {grp.flaggedCount > 0 && <span className="text-rose-700 font-bold">• ⚠️ Query: {grp.flaggedCount}</span>}
                                  {grp.uncheckedCount > 0 && <span className="text-amber-700 font-bold">• ⏳ La Audit Loh: {grp.uncheckedCount}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                              <div className="text-right">
                                <div className="font-black text-emerald-900 text-base tabular-nums">
                                  ₹{grp.totalAmount.toLocaleString('en-IN')}
                                </div>
                                <div>
                                  {allAudited ? (
                                    <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      ✓ AUDITED
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                      ⏳ {grp.uncheckedCount} LA AUDIT LOH
                                    </span>
                                  )}
                                </div>
                              </div>

                              {canAudit && (
                                <div>
                                  {grp.uncheckedCount > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        grp.items.forEach(t => {
                                          if (t.audit_mark !== 'verified') {
                                            markRecordAuditVerification(
                                              t.id,
                                              'transaction',
                                              'verified',
                                              auditorName || creatorProfile?.name || 'Auditor',
                                              ''
                                            );
                                          }
                                        });
                                        setTick(t => t + 1);
                                        setLockToast(`✅ '${grp.headName}' chhunga record ${grp.uncheckedCount} chu '✓ Audited' tiin chhinchhiah a ni e!`);
                                        if (onRecordsUpdated) onRecordsUpdated();
                                        setTimeout(() => setLockToast(null), 3500);
                                      }}
                                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-2xs cursor-pointer transition"
                                    >
                                      ✓ Audit Head
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (grp.items.some(i => i.is_locked) && !isAdmin) {
                                          setLockToast('🔒 He Head chhunga record hi Lock tawh a ni a, Admin chiahin a khawih nawn thei.');
                                          setTimeout(() => setLockToast(null), 3500);
                                          return;
                                        }
                                        grp.items.forEach(t => {
                                          markRecordAuditVerification(
                                            t.id,
                                            'transaction',
                                            undefined,
                                            auditorName || creatorProfile?.name || 'Auditor',
                                            '',
                                            true
                                          );
                                        });
                                        setTick(t => t + 1);
                                        setLockToast(`↩️ '${grp.headName}' Head audit-na sut (Undo) a ni e.`);
                                        if (onRecordsUpdated) onRecordsUpdated();
                                        setTimeout(() => setLockToast(null), 3000);
                                      }}
                                      title="Audit tawh a ni. Click la sut rawh."
                                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-amber-100 text-emerald-800 hover:text-amber-900 border border-emerald-300 hover:border-amber-400 font-black text-xs rounded-xl cursor-pointer transition"
                                    >
                                      ✓ Audited (Undo)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded Subsidiary Members under this Head */}
                          {isExp && (
                            <div className="bg-slate-50/70 border-t border-slate-100 p-2 space-y-1.5 pl-4 sm:pl-8">
                              <div className="text-[10px] font-black uppercase text-slate-500 pb-1">
                                📋 Subsidiary Member Receipts ({grp.items.length})
                              </div>
                              {grp.items.map(tx => (
                                <div key={tx.id} className="p-2.5 bg-white border border-slate-200/80 rounded-xl text-xs flex items-center justify-between gap-2 flex-wrap">
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-extrabold text-slate-900">{tx.donorName || 'Member'}</span>
                                      {tx.donorPhone && <span className="text-[10px] text-slate-400 font-mono">({tx.donorPhone})</span>}
                                      {tx.memberId && <span className="text-[9.5px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200">Roll: {tx.memberId}</span>}
                                      {(tx.donorVeng || (tx as any).donorSection) && <span className="text-[9.5px] text-slate-600 bg-slate-100 px-1 rounded">Bial: {tx.donorVeng || (tx as any).donorSection}</span>}
                                    </div>
                                    <div className="text-[10.5px] text-slate-500 flex items-center gap-2">
                                      <span>{formatDateDDMMYYYY(tx.timestamp || tx.date)}</span>
                                      <span>•</span>
                                      <span className="uppercase text-[9px] font-bold text-slate-600 bg-slate-100 px-1 rounded">{tx.paymentMethod}</span>
                                      {(tx.utr || tx.referenceNo) && <span className="font-mono text-emerald-700">Ref: {tx.utr || tx.referenceNo}</span>}
                                    </div>
                                    {tx.audit_query && (
                                      <div className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                                        ⚠️ Query: {tx.audit_query}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="font-black text-slate-900 text-sm tabular-nums">
                                      ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                                    </div>
                                    {canAudit && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleMarkItem('transaction', tx.id, tx.audit_mark, 'verified', undefined, tx.is_locked)}
                                          title={tx.is_locked && !isAdmin ? "Audit Submit & Lock tawh a ni (Admin chiahin a khawih theih)" : (tx.audit_mark === 'verified' ? "Audit tawh a ni (Click nawn la, sut rawh)" : "Audit / Dik tiin chhinchhiah rawh")}
                                          disabled={tx.is_locked && !isAdmin}
                                          className={`px-2 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                            tx.audit_mark === 'verified'
                                              ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                              : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                                          } ${tx.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        >
                                          ✓ Dik
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFlaggingRecordType('transaction');
                                            setFlaggingRecordId(tx.id);
                                            setFlagQueryText(tx.audit_query || '');
                                          }}
                                          title="Query / Enfiah ngai"
                                          className={`px-1.5 py-1 rounded-lg text-[10px] font-black border transition cursor-pointer ${
                                            tx.audit_mark === 'flagged'
                                              ? 'bg-rose-600 text-white border-rose-600'
                                              : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                                          }`}
                                        >
                                          ⚠️
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[52vh] overflow-y-auto">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No transactions found matching filter.
                    </div>
                  ) : (
                    filteredTransactions.map(tx => (
                      <div key={tx.id} className="p-3 bg-white hover:bg-slate-50 transition text-xs space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 truncate">
                                {tx.donorName || 'Anonymous Donor'}
                              </span>
                              {tx.donorPhone && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({tx.donorPhone})
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">
                                • {tx.id}
                              </span>
                              {tx.audit_mark === 'verified' && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  ✓ AUDITOR VERIFIED
                                </span>
                              )}
                              {tx.audit_mark === 'flagged' && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                  ⚠️ QUERY / FLAGGED
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                              <span>{formatDateDDMMYYYY(tx.timestamp)}</span>
                              <span>•</span>
                              <span className="uppercase text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                {tx.paymentMethod}
                              </span>
                              {tx.memberId && (
                                <span className="text-[9.5px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                  Roll: {tx.memberId}
                                </span>
                              )}
                              {(tx.donorVeng || (tx as any).donorSection) && (
                                <span className="text-[9.5px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  Bial: {tx.donorVeng || (tx as any).donorSection}
                                </span>
                              )}
                              {(tx.utr || (tx as any).utrRef || tx.referenceNo) && (
                                <span className="text-[9.5px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                  UTR/Ref: {tx.utr || (tx as any).utrRef || tx.referenceNo}
                                </span>
                              )}
                              {(tx.approved_by || (tx as any).approvedBy || tx.verifiedBy) && (
                                <span className="text-[9.5px] text-slate-600">
                                  Collector/Verified: <strong>{tx.approved_by || (tx as any).approvedBy || tx.verifiedBy}</strong>
                                </span>
                              )}
                              {tx.audit_period && (
                                <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  {tx.audit_period}
                                </span>
                              )}
                            </div>
                            {tx.audit_query && (
                              <div className="mt-1 text-[11px] bg-rose-50 text-rose-900 border border-rose-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                                <MessageSquareWarning className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span><strong>Auditor Query:</strong> {tx.audit_query}</span>
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0 space-y-1">
                            <div className="font-black text-slate-900 text-sm">
                              ₹{Number(tx.amount || 0).toLocaleString('en-IN')}
                            </div>
                            <div className="flex items-center justify-end gap-1 flex-wrap">
                              {tx.is_locked ? (
                                <>
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5 text-amber-700" />
                                    <span>LOCKED</span>
                                  </span>
                                  {canAudit && (
                                    <button
                                      type="button"
                                      onClick={() => handleSingleUnlock('transaction', tx.id)}
                                      title="Unlock this record for correction"
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                    >
                                      Unlock
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                  <Unlock className="w-2.5 h-2.5 text-slate-400" />
                                  <span>UNLOCKED</span>
                                </span>
                              )}
                            </div>
                            {canAudit && (
                              <div className="flex items-center justify-end gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMarkItem('transaction', tx.id, tx.audit_mark, 'verified', undefined, tx.is_locked)}
                                  title={tx.is_locked && !isAdmin ? "Audit Submit & Lock tawh a ni (Admin chiahin a khawih theih)" : (tx.audit_mark === 'verified' ? "Audit tawh a ni (Click nawn la, sut rawh)" : "Audit / Dik tiin chhinchhiah rawh")}
                                  disabled={tx.is_locked && !isAdmin}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                    tx.audit_mark === 'verified'
                                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                  } ${tx.is_locked && !isAdmin ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                  ✓ Dik
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (flaggingRecordId === tx.id) {
                                      setFlaggingRecordId(null);
                                    } else {
                                      setFlaggingRecordType('transaction');
                                      setFlaggingRecordId(tx.id);
                                      setFlagQueryText(tx.audit_query || '');
                                    }
                                  }}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition flex items-center gap-1 ${
                                    tx.audit_mark === 'flagged'
                                      ? 'bg-rose-600 text-white border-rose-600'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                                  }`}
                                >
                                  <Flag className="w-2.5 h-2.5" />
                                  <span>Query</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {flaggingRecordId === tx.id && flaggingRecordType === 'transaction' && (
                          <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="text"
                              value={flagQueryText}
                              onChange={e => setFlagQueryText(e.target.value)}
                              placeholder="Enfiah ngai chhan ziak rawh (e.g., Receipt mil lo, Amount fiah ngai)..."
                              className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleMarkItem('transaction', tx.id, tx.audit_mark, 'flagged', flagQueryText || 'Enfiah ngai')}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg"
                              >
                                Save Query
                              </button>
                              {tx.audit_mark === 'flagged' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkItem('transaction', tx.id, 'flagged', 'flagged')}
                                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-300"
                                >
                                  Clear Flag
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              {/* Column-wise Summary Bar for Outflow */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Senso ({stats.expCount})</span>
                  <span className="text-sm font-black text-rose-900">₹{stats.totalOutflow.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">✓ Dik / Verified ({stats.auditVerifiedExpCount})</span>
                  <span className="text-sm font-black text-emerald-700">₹{stats.verifiedOutflowAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-rose-50/80 p-2.5 rounded-xl border border-rose-200">
                  <span className="text-[10px] font-bold text-rose-800 uppercase block">⚠️ Query / Flagged ({stats.auditFlaggedExpCount})</span>
                  <span className="text-sm font-black text-rose-700">₹{stats.flaggedOutflowAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-amber-900 uppercase block">⏳ Endik Loh ({stats.uncheckedExpCount})</span>
                    <span className="text-sm font-black text-amber-800">₹{stats.uncheckedOutflowAmount.toLocaleString('en-IN')}</span>
                  </div>
                  {canAudit && stats.uncheckedExpCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleVerifyAllRecords('expense')}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-lg shadow-2xs shrink-0 cursor-pointer"
                    >
                      ✓ Endik Vek Rawh
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by expense head, payee, description..."
                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('all')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'all' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    All ({allExpenses.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('verified')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'verified' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    ✓ Dik ({stats.auditVerifiedExpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('flagged')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'flagged' ? 'bg-white shadow-2xs text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    ⚠️ Query ({stats.auditFlaggedExpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('unchecked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'unchecked' ? 'bg-white shadow-2xs text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    ⏳ Endik Loh ({stats.uncheckedExpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('locked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'locked' ? 'bg-white shadow-2xs text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    🔒 Locked ({stats.lockedExpCount})
                  </button>
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[52vh] overflow-y-auto">
                {filteredExpenses.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No expense vouchers found matching filter.
                  </div>
                ) : (
                  filteredExpenses.map(exp => (
                    <div key={exp.id} className="p-3 bg-white hover:bg-slate-50 transition text-xs space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-slate-900 truncate">
                              {exp.head || exp.expenseHead || 'Expenditure'}
                            </span>
                            {(exp.paidTo || exp.payeeName) && (
                              <span className="text-[10px] text-slate-500">
                                (Payee: {exp.paidTo || exp.payeeName})
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              • {exp.voucherNo || exp.id}
                            </span>
                            {exp.audit_mark === 'verified' && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ VOUCHER VERIFIED
                              </span>
                            )}
                            {exp.audit_mark === 'flagged' && (
                              <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                ⚠️ QUERY / FLAGGED
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span>{formatDateDDMMYYYY(exp.spentDate || exp.date || exp.createdAt || '')}</span>
                            {(exp.purpose || exp.description) && (
                              <>
                                <span>•</span>
                                <span className="truncate">{exp.purpose || exp.description}</span>
                              </>
                            )}
                            {exp.audit_period && (
                              <span className="text-[9.5px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                {exp.audit_period}
                              </span>
                            )}
                          </div>
                          {exp.audit_query && (
                            <div className="mt-1 text-[11px] bg-rose-50 text-rose-900 border border-rose-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                              <MessageSquareWarning className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span><strong>Auditor Query:</strong> {exp.audit_query}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <div className="font-black text-rose-700 text-sm">
                            ₹{Number(exp.amount || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {exp.is_locked ? (
                              <>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5 text-amber-700" />
                                  <span>LOCKED</span>
                                </span>
                                {canAudit && (
                                  <button
                                    type="button"
                                    onClick={() => handleSingleUnlock('expense', exp.id)}
                                    title="Unlock this voucher for correction"
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                  >
                                    Unlock
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
                                <Unlock className="w-2.5 h-2.5 text-slate-400" />
                                <span>UNLOCKED</span>
                              </span>
                            )}
                          </div>
                          {canAudit && (
                            <div className="flex items-center justify-end gap-1 pt-0.5">
                              <button
                                type="button"
                                onClick={() => handleMarkItem('expense', exp.id, exp.audit_mark, 'verified')}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                                  exp.audit_mark === 'verified'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                ✓ Dik
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (flaggingRecordId === exp.id) {
                                    setFlaggingRecordId(null);
                                  } else {
                                    setFlaggingRecordType('expense');
                                    setFlaggingRecordId(exp.id);
                                    setFlagQueryText(exp.audit_query || '');
                                  }
                                }}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition flex items-center gap-1 ${
                                  exp.audit_mark === 'flagged'
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200'
                                }`}
                              >
                                <Flag className="w-2.5 h-2.5" />
                                <span>Query</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {flaggingRecordId === exp.id && flaggingRecordType === 'expense' && (
                        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={flagQueryText}
                            onChange={e => setFlagQueryText(e.target.value)}
                            placeholder="Voucher enfiah ngai chhan ziak rawh (e.g., Cash memo kim lo, Signature awm lo)..."
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMarkItem('expense', exp.id, exp.audit_mark, 'flagged', flagQueryText || 'Voucher enfiah ngai')}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] rounded-lg"
                            >
                              Save Query
                            </button>
                            {exp.audit_mark === 'flagged' && (
                              <button
                                type="button"
                                onClick={() => handleMarkItem('expense', exp.id, 'flagged', 'flagged')}
                                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-300"
                              >
                                Clear Flag
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB: SIGN & LOCK ACTION */}
          {activeTab === 'lock_action' && (
            <div className="space-y-5 max-w-xl mx-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm sm:text-base">
                      Audit Sign-off & Financial Freeze
                    </h4>
                    <p className="text-xs text-amber-900">
                      Record la lock loh zawng zawng hi audit zawh hnuah lock chhan tlatna
                    </p>
                  </div>
                </div>

                <div className="text-xs text-amber-950/80 bg-white/70 p-3 rounded-xl border border-amber-200/60 leading-relaxed">
                  He action hian he Bawm hnuaia transaction la lock loh <strong>({stats.unlockedTxCount})</strong> leh expense voucher la lock loh <strong>({stats.unlockedExpCount})</strong> zawng zawng a freeze ang a, auto-update leh accidental script update lak ata a veng tlat ang.
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      Audit Financial Period *
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setAuditPeriod(`FY ${new Date().getFullYear() - 1}-${new Date().getFullYear()}`)}
                        className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                      >
                        FY {new Date().getFullYear() - 1}-{new Date().getFullYear()}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditPeriod(`${new Date().toLocaleString('default', { month: 'short' })} ${new Date().getFullYear()}`)}
                        className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                      >
                        Thla Bi ({new Date().toLocaleString('default', { month: 'short' })})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditPeriod(`All Time (${new Date().getFullYear()})`)}
                        className="text-[9.5px] font-extrabold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                      >
                        All Time
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={auditPeriod}
                    onChange={e => setAuditPeriod(e.target.value)}
                    placeholder="Entirnan: FY 2024-2025 / Jan - Dec 2024"
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Auditor Hming *
                    </label>
                    <input
                      type="text"
                      value={auditorName}
                      onChange={e => setAuditorName(e.target.value)}
                      placeholder="Sum Endiktu Hming"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Auditor Phone Number
                    </label>
                    <input
                      type="tel"
                      value={auditorPhone}
                      onChange={e => setAuditorPhone(e.target.value)}
                      placeholder="10 digit phone number"
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Auditor Notes & Observations
                  </label>
                  <textarea
                    value={auditNotes}
                    onChange={e => setAuditNotes(e.target.value)}
                    rows={3}
                    placeholder="Observations, remarks, or verification notes..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {isConfirmingLock ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
                    <div className="text-xs font-bold text-rose-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        I chiang chiah em? {stats.totalUnlocked > 0 ? `Record ${stats.totalUnlocked} lock nghal a ni ang a,` : 'Record zawng zawng lock fel sa a ni a,'} Audit Sign-off nemngheh a ni dawn e.
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Record te hi lock an nih hnuah chuan Admin approval (Maker-Checker request) lovin direct edit theih an ni tawh lovang.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingLock(false)}
                        className="py-2 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Thulh Leh Rawh
                      </button>
                      <button
                        type="button"
                        disabled={isLocking || !canAudit}
                        onClick={handleExecuteLock}
                        className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{isLocking ? 'Locking...' : 'Aw, Audit Sign & Lock Rawh'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canAudit || !auditorName.trim()}
                    onClick={() => setIsConfirmingLock(true)}
                    className="w-full py-3.5 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {!canAudit
                        ? 'Auditor Phalna Active A Awm Lo (View-Only)'
                        : stats.totalUnlocked > 0
                        ? `✍️ Audit Sign & Freeze Unlocked Records (${stats.totalUnlocked} Records)`
                        : `✍️ Audit Sign-Off & Update Certificate (${stats.totalLocked} Locked)`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB: AUDIT CERTIFICATE */}
          {activeTab === 'certificate' && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="bg-slate-50 border border-slate-300 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="text-center border-b border-slate-200 pb-4">
                  <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-slate-900 text-white">
                    Official Audit Certificate
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-3">
                    {campaign.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Category: {campaign.category.toUpperCase()} • ID: {campaign.id}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Inflow</span>
                    <span className="text-base font-black text-emerald-800">₹{stats.totalInflow.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Outflow</span>
                    <span className="text-base font-black text-rose-800">₹{stats.totalOutflow.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Balance</span>
                    <span className="text-base font-black text-indigo-900">₹{stats.netBalance.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-white text-xs text-slate-700 space-y-2">
                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Auditor Verification Statement</span>
                  </div>
                  <p className="leading-relaxed">
                    He lehkha hmang hian <strong>{campaign.title}</strong> accounts hi <strong>{auditPeriod}</strong> a tan enfiah leh audit fel a ni tih nemngheh a ni. Records zawng zawng hi uluk taka endik a ni a, total of <strong>{stats.totalLocked} records</strong> hi tamper-proof audit lock hmangin freeze a ni.
                  </p>
                  {auditNotes && (
                    <div className="text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      "{auditNotes}"
                    </div>
                  )}
                </div>

                <div className="flex items-end justify-between pt-4">
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>Date: <span className="font-bold text-slate-800">{formatDateDDMMYYYY(new Date().toISOString())}</span></div>
                    <div>Digital Stamp: <span className="text-emerald-700 font-bold">RONPAY VERIFIED</span></div>
                  </div>
                  <div className="text-right border-t border-slate-900 pt-1.5 min-w-[160px]">
                    <div className="font-bold text-xs text-slate-900">{auditorName}</div>
                    <div className="text-[10px] text-slate-500">Sum Endiktu (Auditor)</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintCertificate}
                  className="py-3 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow transition flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save PDF Certificate</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
