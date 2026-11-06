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
  FolderKanban
} from 'lucide-react';
import { Campaign, CreatorProfile } from '../types';
import { 
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
  saveStoredAuditorGrants
} from '../utils/storage';
import { formatDateDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'expenses' | 'lock_action' | 'certificate'>('overview');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterLockStatus, setFilterLockStatus] = useState<'all' | 'locked' | 'unlocked' | 'verified' | 'flagged'>('all');

  // Local refresh tick
  const [tick, setTick] = useState<number>(0);

  // Sync latest auditor grants from backend when portal opens
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/auditor-grants')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && Array.isArray(data.auditorGrants)) {
          saveStoredAuditorGrants(data.auditorGrants);
          setTick(t => t + 1);
        }
      })
      .catch(() => {});
  }, [isOpen]);

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
    return isAdmin || isCreator || Boolean(accessInfo?.hasAccess);
  }, [isAdmin, isCreator, accessInfo]);

  // Accessible campaigns for Multi-Bawm Switcher
  const accessibleCampaigns = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return campaign ? [campaign] : [];
    if (isAdmin) return campaigns;
    const phone = creatorProfile?.phone || creatorProfile?.phoneNumber || '';
    const activeGrants = getActiveAuditorGrantsForUser(phone);
    const grantCampIds = new Set(activeGrants.map(g => g.campaignId || g.campaign_id));
    const filtered = campaigns.filter(
      c => grantCampIds.has(c.id) || isCampaignCreator(c, creatorProfile || null) || (campaign && c.id === campaign.id)
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

  // Keep auditor details and checklist synced when campaign or profile changes
  const [checklist, setChecklist] = useState<Record<string, boolean>>(DEFAULT_CHECKLIST);

  useEffect(() => {
    if (campaign) {
      setChecklist(campaign.auditChecklist || DEFAULT_CHECKLIST);
      if (campaign.lastAuditPeriod) {
        setAuditPeriod(campaign.lastAuditPeriod);
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
    queryText?: string
  ) => {
    if (!canAudit) return;
    const nextMark = currentMark === desiredMark && queryText === undefined ? undefined : desiredMark;
    const ok = markRecordAuditVerification(
      targetId,
      targetType,
      nextMark,
      auditorName || creatorProfile?.name || 'Auditor',
      nextMark === 'flagged' ? (queryText || 'Enfiah ngai / Query awm') : ''
    );
    if (ok) {
      setTick(t => t + 1);
      setFlaggingRecordId(null);
      setFlagQueryText('');
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

  const checkedCount = useMemo(() => Object.values(checklist).filter(Boolean).length, [checklist]);
  const checklistPercent = useMemo(() => Math.round((checkedCount / 5) * 100), [checkedCount]);

  // Load transactions and expenses
  const allTransactions = useMemo(() => {
    if (!campaign) return [];
    const all = getStoredTransactions();
    return all.filter(t => t.campaignId === campaign.id);
  }, [campaign, tick]);

  const allExpenses = useMemo(() => {
    if (!campaign) return [];
    return getStoredExpenses(campaign.id);
  }, [campaign, tick]);

  // Statistics
  const stats = useMemo(() => {
    const verifiedTx = allTransactions.filter(t => t.status === 'confirmed' || t.status === 'success' || !t.status);
    const totalInflow = verifiedTx.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalOutflow = allExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netBalance = totalInflow - totalOutflow;

    const lockedTxCount = verifiedTx.filter(t => t.is_locked).length;
    const unlockedTxCount = verifiedTx.length - lockedTxCount;
    const auditVerifiedTxCount = verifiedTx.filter(t => t.audit_mark === 'verified').length;
    const auditFlaggedTxCount = verifiedTx.filter(t => t.audit_mark === 'flagged').length;

    const lockedExpCount = allExpenses.filter(e => e.is_locked).length;
    const unlockedExpCount = allExpenses.length - lockedExpCount;
    const auditVerifiedExpCount = allExpenses.filter(e => e.audit_mark === 'verified').length;
    const auditFlaggedExpCount = allExpenses.filter(e => e.audit_mark === 'flagged').length;

    return {
      totalInflow,
      totalOutflow,
      netBalance,
      txCount: verifiedTx.length,
      expCount: allExpenses.length,
      lockedTxCount,
      unlockedTxCount,
      auditVerifiedTxCount,
      auditFlaggedTxCount,
      lockedExpCount,
      unlockedExpCount,
      auditVerifiedExpCount,
      auditFlaggedExpCount,
      totalRecords: verifiedTx.length + allExpenses.length,
      totalLocked: lockedTxCount + lockedExpCount,
      totalUnlocked: unlockedTxCount + unlockedExpCount,
      totalAuditVerified: auditVerifiedTxCount + auditVerifiedExpCount,
      totalAuditFlagged: auditFlaggedTxCount + auditFlaggedExpCount
    };
  }, [allTransactions, allExpenses]);

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
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-auto flex flex-col max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base sm:text-xl tracking-tight">
                  Online Financial Audit Portal
                </h3>
                {accessInfo?.hasAccess && !isAdmin && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{accessInfo.remainingHours}h la awm</span>
                  </span>
                )}
                {isAdmin && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    Admin Full Access
                  </span>
                )}
                {!canAudit && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    View-Only Mode
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {accessibleCampaigns.length > 1 && onSelectCampaign ? (
                  <div className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded-xl px-2.5 py-1">
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <select
                      value={campaign.id}
                      onChange={e => {
                        const found = accessibleCampaigns.find(c => c.id === e.target.value);
                        if (found) onSelectCampaign(found);
                      }}
                      className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-2"
                    >
                      {accessibleCampaigns.map(c => (
                        <option key={c.id} value={c.id} className="text-slate-900 font-bold">
                          {c.title} ({c.category.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p className="text-xs text-indigo-200/80 font-medium truncate">
                    {campaign.title} • {campaign.category.toUpperCase()}
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-white/80 transition shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access / Expiry Banner if View-Only */}
        {!canAudit && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-amber-900 text-xs flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>View-Only Access:</strong> He Bawm-ah hian active Auditor phalna (time-bound grant) i nei rih lo a, a nih loh leh a hun a tawp tawh. Record i thlir thei a, mahse Lock/Verify turin Bawm neitu (Creator) hnenah phalna dil belh rawh.
              </span>
            </div>
          </div>
        )}

        {/* Toast */}
        {lockToast && (
          <div className="bg-emerald-50 border-b border-emerald-200 p-3 px-5 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lockToast}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 flex items-center gap-1 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Accounts Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'transactions'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Inflow / Thawhlawm ({stats.txCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'expenses'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingDown className="w-4 h-4" />
            <span>Outflow / Senso ({stats.expCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lock_action')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'lock_action'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4 text-amber-600" />
            <span>Sign & Lock Period</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('certificate')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'certificate'
                ? 'border-indigo-600 text-indigo-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-purple-600" />
            <span>Audit Certificate</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Total Inflow (Dawn Zat)</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">
                    ₹{stats.totalInflow.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                    Verified {stats.txCount} transactions ({stats.auditVerifiedTxCount} checked)
                  </div>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                    <span>Total Outflow (Senso)</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-rose-950 mt-1">
                    ₹{stats.totalOutflow.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-rose-700 mt-1 font-medium">
                    Vouchers {stats.expCount} recorded ({stats.auditVerifiedExpCount} checked)
                  </div>
                </div>

                <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Banknote className="w-4 h-4 text-indigo-600" />
                    <span>Net Closing Balance</span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-indigo-950 mt-1">
                    ₹{stats.netBalance.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-indigo-700 mt-1 font-medium">
                    {stats.totalAuditFlagged > 0 ? (
                      <span className="text-rose-600 font-bold">⚠️ {stats.totalAuditFlagged} Flagged Queries</span>
                    ) : (
                      'Cash in Hand / Bank verified'
                    )}
                  </div>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Locked Inflow</span>
                    <span className="font-bold text-slate-800">{stats.lockedTxCount} records</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Unlocked Inflow</span>
                    <span className="font-bold text-amber-700">{stats.unlockedTxCount} records</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Auditor Verified</span>
                    <span className="font-bold text-emerald-700">{stats.totalAuditVerified} items ✓</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block text-[10px]">Flagged / Query</span>
                    <span className="font-bold text-rose-700">{stats.totalAuditFlagged} items ⚠️</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('lock_action')}
                    className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Audit Sign & Lock Records</span>
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
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-blue-950">Auditor Tan Hriattur:</div>
                  <p className="leading-relaxed text-blue-800">
                    Inflow leh Outflow tab-ah lutin record tin hi <strong>"✓ Dik"</strong> tih emaw, enfiah ngai a awm chuan <strong>"⚠️ Query"</strong> hmangin i chhinchhiah thei a. I check fel vek hnuah <strong>"Sign & Lock Period"</strong> tab-ah record zawng zawng i lock thei a ni.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <div className="space-y-4">
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
                    onClick={() => setFilterLockStatus('locked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'locked' ? 'bg-white shadow-2xs text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    Locked ({stats.lockedTxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('unlocked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'unlocked' ? 'bg-white shadow-2xs text-indigo-800' : 'text-slate-600'
                    }`}
                  >
                    Unlocked ({stats.unlockedTxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('verified')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'verified' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    ✓ Verified ({stats.auditVerifiedTxCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('flagged')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'flagged' ? 'bg-white shadow-2xs text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    ⚠️ Flagged ({stats.auditFlaggedTxCount})
                  </button>
                </div>
              </div>

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
                                onClick={() => handleMarkItem('transaction', tx.id, tx.audit_mark, 'verified')}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition ${
                                  tx.audit_mark === 'verified'
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
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
            </div>
          )}

          {/* TAB: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
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
                    onClick={() => setFilterLockStatus('locked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'locked' ? 'bg-white shadow-2xs text-amber-800' : 'text-slate-600'
                    }`}
                  >
                    Locked ({stats.lockedExpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('unlocked')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'unlocked' ? 'bg-white shadow-2xs text-indigo-800' : 'text-slate-600'
                    }`}
                  >
                    Unlocked ({stats.unlockedExpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('verified')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'verified' ? 'bg-white shadow-2xs text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    ✓ Verified ({stats.auditVerifiedExpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterLockStatus('flagged')}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-bold transition whitespace-nowrap ${
                      filterLockStatus === 'flagged' ? 'bg-white shadow-2xs text-rose-700' : 'text-slate-600'
                    }`}
                  >
                    ⚠️ Flagged ({stats.auditFlaggedExpCount})
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
                      <span>I chiang chiah em? Record {stats.totalUnlocked} lock a ni dawn e.</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Record te hi lock an nih hnuah chuan Admin approval (Maker-Checker request) lovin direct edit theih an ni tawh lovang.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsConfirmingLock(false)}
                        className="py-2 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Thulh Leh Rawh
                      </button>
                      <button
                        type="button"
                        disabled={isLocking || !canAudit}
                        onClick={handleExecuteLock}
                        className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>{isLocking ? 'Locking...' : 'Aw, Nemnghet La Lock Rawh'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canAudit || stats.totalUnlocked === 0 || !auditorName.trim()}
                    onClick={() => setIsConfirmingLock(true)}
                    className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-2xl shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Lock className="w-4 h-4" />
                    <span>
                      {!canAudit
                        ? 'Auditor Phalna Active A Awm Lo (View-Only)'
                        : `Audit Sign & Freeze Unlocked Records (${stats.totalUnlocked})`}
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
