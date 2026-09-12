import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  History, 
  Search, 
  Printer, 
  HeartHandshake, 
  Zap, 
  Banknote, 
  MessageSquare, 
  ShieldCheck, 
  QrCode, 
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  Send,
  Building2,
  Calendar,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Check,
  AlertTriangle
} from 'lucide-react';
import { Transaction, Campaign, BawmCategory, CreatorProfile } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';
import { 
  isCampaignCreator, 
  getStoredCampaigns, 
  saveTransaction, 
  deleteStoredTransaction, 
  deleteMultipleTransactions,
  isConfirmedTransaction 
} from '../utils/storage';
import { getCampaignCauseTitle } from '../utils/translations';

interface PeknaSulhnuModalProps {
  isOpen: boolean;
  transactions: Transaction[];
  campaigns?: Campaign[];
  creatorProfile?: CreatorProfile | null;
  userPaidIds?: string[];
  onClose: () => void;
  onOpenReceipt?: (tx: Transaction) => void;
  onNavigateToDonate?: () => void;
  onOpenScanner?: () => void;
  onRefreshData?: () => void;
}

// Helper to categorize non-Bawm transactions (bills, recharges, tickets, taxes) under 'others'
export const getEffectiveCategory = (t?: Transaction | null): BawmCategory => {
  if (!t) return 'others';
  const cat = t.category;
  if (cat === 'ralna' || cat === 'khawlsak' || cat === 'rikrum' || cat === 'kumtluang') {
    return cat;
  }
  if (cat === 'others') return 'others';
  const idStr = String(t.id || '');
  const campIdStr = String(t.campaignId || '');
  if (
    idStr.startsWith('BILL-') || 
    idStr.startsWith('TXN-BILL-') || 
    campIdStr.startsWith('bill-')
  ) {
    return 'others';
  }
  return (cat as BawmCategory) || 'others';
};

export const PeknaSulhnuModal: React.FC<PeknaSulhnuModalProps> = ({
  isOpen,
  transactions = [],
  campaigns = [],
  creatorProfile,
  userPaidIds = [],
  onClose,
  onOpenReceipt,
  onNavigateToDonate,
  onOpenScanner,
  onRefreshData,
}) => {
  // Default to 'all' so users see their records immediately without hidden filter exclusion
  const [directionFilter, setDirectionFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [checkingTxId, setCheckingTxId] = useState<string | null>(null);
  const [statusDialogTx, setStatusDialogTx] = useState<Transaction | null>(null);
  const [statusDialogResult, setStatusDialogResult] = useState<{ status: string; message: string } | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [deletedTxIds, setDeletedTxIds] = useState<Set<string>>(new Set());
  const [showConfirmClearAll, setShowConfirmClearAll] = useState<boolean>(false);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    if (onRefreshData) {
      onRefreshData();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
    }
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  // Defensive array checks
  const safeTransactions = useMemo(() => {
    const list = Array.isArray(transactions) ? transactions.filter(Boolean) : [];
    return list.filter(t => t && t.id && !deletedTxIds.has(String(t.id).toLowerCase().trim()));
  }, [transactions, deletedTxIds]);

  const safeCampaigns = useMemo(() => {
    return Array.isArray(campaigns) ? campaigns.filter(Boolean) : [];
  }, [campaigns]);

  const safeUserPaidIds = useMemo(() => {
    return Array.isArray(userPaidIds) ? userPaidIds : [];
  }, [userPaidIds]);

  // Identify campaigns owned by active profile
  const { ownedCampaignIds, ownedCampaignTitles } = useMemo(() => {
    const ids = new Set<string>();
    const titles = new Set<string>();
    if (creatorProfile && (creatorProfile.phone || creatorProfile.name)) {
      safeCampaigns.forEach(c => {
        if (c && isCampaignCreator(c, creatorProfile)) {
          if (c.id) ids.add(c.id);
          if (c.title) {
            titles.add(String(c.title).toLowerCase().trim());
          }
        }
      });
    }
    return { ownedCampaignIds: ids, ownedCampaignTitles: titles };
  }, [safeCampaigns, creatorProfile]);

  const isCreatorAccount = Boolean(
    creatorProfile?.isAdmin || 
    creatorProfile?.isApproved || 
    ownedCampaignIds.size > 0
  );

  const resolveTxCampaignTitle = (tx?: Transaction | null): string => {
    if (!tx) return 'RonPay Bawm';
    if (safeCampaigns && tx.campaignId) {
      const matched = safeCampaigns.find(c => c.id === tx.campaignId);
      if (matched) {
        const causeTitle = getCampaignCauseTitle(matched);
        if (causeTitle && causeTitle !== 'RonPay Community Bawm') {
          return causeTitle;
        }
      }
    }
    const storedCamps = getStoredCampaigns();
    const matchedStored = storedCamps.find(c => c.id === tx.campaignId);
    if (matchedStored) {
      const causeTitle = getCampaignCauseTitle(matchedStored);
      if (causeTitle && causeTitle !== 'RonPay Community Bawm') {
        return causeTitle;
      }
    }
    if (tx.category === 'ralna' && (tx.campaignTitle === 'BCM Ebenezer' || !tx.campaignTitle)) {
      return 'Lalrinpuii Ralna';
    }
    if (tx.category === 'khawlsak' && tx.campaignTitle === 'BCM Ebenezer') {
      return 'Pocket Money';
    }
    return tx.campaignTitle || 'RonPay Bawm';
  };

  // Helper to determine if transaction is received in creator's bawm or sent as donor
  const getTxDirection = (tx?: Transaction | null): 'received' | 'sent' => {
    if (!tx) return 'sent';

    const campId = tx.campaignId ? String(tx.campaignId) : '';
    const campTitle = tx.campaignTitle ? String(tx.campaignTitle).toLowerCase().trim() : '';

    const isOwned = (campId && ownedCampaignIds.has(campId)) || 
      (campTitle ? ownedCampaignTitles.has(campTitle) : false);

    const profilePhone = creatorProfile?.phone ? String(creatorProfile.phone).replace(/\D/g, '').slice(-10) : '';
    const txPhone = tx.donorPhone ? String(tx.donorPhone).replace(/\D/g, '').slice(-10) : '';
    const isDonorPhone = Boolean(profilePhone && txPhone && profilePhone === txPhone);
    const isPaidOnDevice = safeUserPaidIds.includes(tx.id);

    // If active user contributed this payment directly, it belongs to personal 'sent' giving
    if (isDonorPhone || isPaidOnDevice) {
      return 'sent';
    }

    if (isOwned || creatorProfile?.isAdmin) {
      return 'received';
    }

    return 'sent';
  };

  const receivedCount = useMemo(() => {
    return safeTransactions.filter(t => getTxDirection(t) === 'received').length;
  }, [safeTransactions, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  const sentCount = useMemo(() => {
    return safeTransactions.filter(t => getTxDirection(t) === 'sent').length;
  }, [safeTransactions, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  // Ensure directionFilter stays on a valid tab when data updates
  useEffect(() => {
    if (isOpen) {
      if (directionFilter === 'received' && receivedCount === 0) {
        setDirectionFilter('all');
      }
    }
  }, [isOpen, receivedCount]);

  // Direction-filtered transactions for accurate tab counts
  const directionFiltered = useMemo(() => {
    return safeTransactions.filter(t => {
      if (!t) return false;
      const dir = getTxDirection(t);
      if (directionFilter === 'received' && dir !== 'received') return false;
      if (directionFilter === 'sent' && dir !== 'sent') return false;
      return true;
    });
  }, [safeTransactions, directionFilter, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  const filtered = useMemo(() => {
    return safeTransactions.filter(t => {
      if (!t) return false;
      // 1. Direction Filter (Received vs Sent)
      const dir = getTxDirection(t);
      if (directionFilter === 'received' && dir !== 'received') return false;
      if (directionFilter === 'sent' && dir !== 'sent') return false;

      // 2. Category Filter
      const effectiveCategory = getEffectiveCategory(t);
      if (filterCategory !== 'all' && effectiveCategory !== filterCategory) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rTitle = resolveTxCampaignTitle(t);
        const matchTitle = (t.campaignTitle ? String(t.campaignTitle).toLowerCase().includes(q) : false) || (rTitle ? rTitle.toLowerCase().includes(q) : false);
        const matchId = t.id ? String(t.id).toLowerCase().includes(q) : false;
        const matchDonor = t.donorName ? String(t.donorName).toLowerCase().includes(q) : false;
        const matchPhone = t.donorPhone ? String(t.donorPhone).includes(q) : false;
        const matchPeriod = t.periodLabel ? String(t.periodLabel).toLowerCase().includes(q) : false;
        const matchCategory = effectiveCategory ? String(effectiveCategory).toLowerCase().includes(q) : false;
        const matchRemark = t.remark ? String(t.remark).toLowerCase().includes(q) : false;
        if (!matchTitle && !matchId && !matchDonor && !matchPhone && !matchPeriod && !matchCategory && !matchRemark) return false;
      }
      return true;
    });
  }, [safeTransactions, directionFilter, filterCategory, searchQuery, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  // Split confirmed vs pending
  const confirmedFiltered = useMemo(() => {
    return filtered.filter(isConfirmedTransaction);
  }, [filtered]);

  const pendingFiltered = useMemo(() => {
    return filtered.filter(t => t.status === 'pending' || t.status === 'pending_verification');
  }, [filtered]);

  // Verified sum (Accurate, strictly confirmed transactions only)
  const confirmedTotalAmount = useMemo(() => {
    return confirmedFiltered.reduce((sum, t) => {
      if (!t) return sum;
      const dir = getTxDirection(t);
      const isRec = dir === 'received';
      const base = Number(t.amount) || 0;
      const fee = Number(t.platformFee) || 0;
      if (isRec && t.feeOption === 'DEDUCT') {
        return sum + (Number(t.campaignNetReceived) || Math.max(0, base - fee));
      }
      if (!isRec && t.feeOption === 'ADD_ON') {
        return sum + (Number(t.totalAmount) || (base + fee));
      }
      return sum + (Number(t.totalAmount) || base);
    }, 0);
  }, [confirmedFiltered, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  // Pending sum (separated out so data is not skewed)
  const pendingTotalAmount = useMemo(() => {
    return pendingFiltered.reduce((sum, t) => {
      if (!t) return sum;
      const base = Number(t.amount) || 0;
      const fee = Number(t.platformFee) || 0;
      return sum + (Number(t.totalAmount) || (t.feeOption === 'ADD_ON' ? base + fee : base));
    }, 0);
  }, [pendingFiltered]);

  // Backwards compatibility for any reference
  const totalAmount = confirmedTotalAmount;

  // Actual list to display depending on statusFilter
  const displayedList = useMemo(() => {
    if (statusFilter === 'verified') return confirmedFiltered;
    if (statusFilter === 'pending') return pendingFiltered;
    return filtered;
  }, [filtered, confirmedFiltered, pendingFiltered, statusFilter]);

  // Actions for pending payments
  const handleCheckPendingStatus = async (tx: Transaction) => {
    setCheckingTxId(tx.id);
    try {
      const res = await fetch(`/api/phonepe/status/${encodeURIComponent(tx.id)}`);
      let data: any = null;
      if (res.ok) {
        data = await res.json();
      }
      const code = data?.code || data?.data?.responseCode;
      const isSuccess = code === 'PAYMENT_SUCCESS' || data?.data?.state === 'COMPLETED';
      const isFailed = code === 'PAYMENT_ERROR' || code === 'FAILED' || data?.data?.state === 'FAILED';

      if (isSuccess) {
        const utr = data?.data?.utr || data?.data?.paymentInstrument?.utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000));
        const updatedTx: Transaction = {
          ...tx,
          status: 'completed',
          txHash: utr,
          utr: utr
        };
        saveTransaction(updatedTx);
        if (onRefreshData) onRefreshData();
        setActionToast(`✅ ${tx.id} pawisa pek a lo hlawhtling e! Verified a ni ta.`);
        setTimeout(() => setActionToast(null), 4000);
      } else if (isFailed) {
        setStatusDialogTx(tx);
        setStatusDialogResult({
          status: 'FAILED',
          message: 'PhonePe PG atangin payment hi FAILED a ni tih a lo thleng e.'
        });
      } else {
        setStatusDialogTx(tx);
        setStatusDialogResult({
          status: 'PENDING',
          message: 'PhonePe PG-ah payment hi a la PENDING (la lut lo) a ni e.'
        });
      }
    } catch (err) {
      console.warn('Status check network error:', err);
      setStatusDialogTx(tx);
      setStatusDialogResult({
        status: 'PENDING',
        message: 'Network check hlawhtling rih lo. Bank account atanga a in-debit tawh chuan Manual Confirm i ti thei e.'
      });
    } finally {
      setCheckingTxId(null);
    }
  };

  const handleManualConfirmPaid = (tx: Transaction) => {
    const utr = tx.utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000));
    const updatedTx: Transaction = {
      ...tx,
      status: 'completed',
      txHash: utr,
      utr: utr
    };
    saveTransaction(updatedTx);
    if (onRefreshData) onRefreshData();
    setStatusDialogTx(null);
    setStatusDialogResult(null);
    setActionToast(`✅ ${tx.id} hi Verified-ah dah a ni ta.`);
    setTimeout(() => setActionToast(null), 3500);
  };

  const handleDeletePendingTx = (txId: string) => {
    if (!txId) return;
    const cleanId = String(txId).trim();
    // 1. Instant local removal so it vanishes right away
    setDeletedTxIds(prev => new Set(prev).add(cleanId.toLowerCase()));

    // 2. Persistent removal from Storage, Firestore & Server
    deleteStoredTransaction(cleanId);

    // 3. Clear dialog
    setStatusDialogTx(null);
    setStatusDialogResult(null);

    // 4. Refresh external data & show toast
    if (onRefreshData) onRefreshData();
    setActionToast('🗑️ Pending transaction paih fel a ni ta.');
    setTimeout(() => setActionToast(null), 3500);
  };

  const handleClearAllPending = () => {
    if (pendingFiltered.length === 0) return;
    const ids = pendingFiltered.map(t => t.id).filter(Boolean);
    
    // 1. Instant local state update
    setDeletedTxIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(String(id).toLowerCase().trim()));
      return next;
    });

    // 2. Batch delete across channels
    deleteMultipleTransactions(ids);
    setShowConfirmClearAll(false);

    if (onRefreshData) onRefreshData();
    setActionToast(`🗑️ Pending transaction ${ids.length} paih fai a ni ta.`);
    setTimeout(() => setActionToast(null), 3500);
  };

  if (!isOpen) return null;

  const printSingleReceipt = (tx: Transaction) => {
    try {
      const effectiveCat = getEffectiveCategory(tx);
      const categoryLabel = effectiveCat === 'others' 
        ? 'OTHERS (BILLS & RECHARGE)' 
        : String(effectiveCat).toUpperCase() + ' BAWM';

      const isPhonePe = tx.paymentMethod === 'phonepe' || (typeof tx.id === 'string' && tx.id.startsWith('RPAY_TXN_'));
      const isOnline = tx.paymentMethod === 'online' || isPhonePe;
      const baseAmt = Number(tx.amount) || 0;
      const fee = Number(tx.platformFee) || 0;
      const totalAmt = Number(tx.totalAmount) || (tx.feeOption === 'ADD_ON' ? (baseAmt + fee) : baseAmt);
      const netAmt = Number(tx.campaignNetReceived) || (tx.feeOption === 'DEDUCT' ? Math.max(0, baseAmt - fee) : baseAmt);

      const isVerified = isConfirmedTransaction(tx);
      const isPending = !isVerified && (tx.status === 'pending' || tx.status === 'pending_verification' || !tx.status);
      const isFailed = tx.status === 'failed' || tx.status === 'rejected';

      const subcatsHtml = tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0
        ? `<div style="margin: 15px 0; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #475569;">ITEMIZED BREAKDOWN:</div>
            ${Object.entries(tx.subCategoryBreakdown).map(([k, v]) => `
              <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
                <span>${k}</span>
                <b>₹${v}</b>
              </div>
            `).join('')}
          </div>`
        : '';

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${isVerified ? 'RonPay Official Receipt' : 'RonPay Transaction Slip (Pending)'} - ${tx.id || 'TXN'}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 30px 20px; color: #1e1b4b; text-align: center; }
              .receipt-card { max-width: 380px; margin: 0 auto; border: 2px ${isVerified ? 'solid #4338ca' : 'dashed #d97706'}; border-radius: 20px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: left; background: #ffffff; }
              .badge-verified { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; display: inline-block; border: 1px solid #86efac; }
              .badge-pending { background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; display: inline-block; border: 1.5px solid #f59e0b; }
              .badge-failed { background: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 800; padding: 5px 12px; border-radius: 20px; display: inline-block; border: 1px solid #fca5a5; }
              .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
              .label { color: #64748b; }
              .val { font-weight: bold; color: #0f172a; }
              .amount-box { background: ${isVerified ? '#f1f5f9' : '#fffbeb'}; padding: 15px; border-radius: 12px; text-align: center; margin: 15px 0; border: 1px dashed ${isVerified ? '#cbd5e1' : '#f59e0b'}; }
              .amount-val { font-size: 26px; font-weight: 900; color: ${isVerified ? '#047857' : '#b45309'}; }
              .warning-banner { background: #fffbeb; border: 1.5px dashed #f59e0b; border-radius: 10px; padding: 10px 12px; margin: 14px 0; text-align: center; color: #92400e; font-size: 11px; line-height: 1.5; }
              .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="receipt-card">
              <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="margin: 0; color: #1e1b4b; font-size: 20px;">
                  ${isVerified ? 'RONPAY OFFICIAL RECEIPT' : 'RONPAY TRANSACTION SLIP'}
                </h2>
                <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                  ${isVerified ? 'Mizoram Community & Bawm Payment' : 'PhonePe PG / Bank Confirmation la nghah mek a ni'}
                </div>
                <div style="margin-top: 8px;">
                  ${isVerified ? `
                    <span class="badge-verified">PAID & VERIFIED</span>
                  ` : isPending ? `
                    <span class="badge-pending">⏳ A LA LUT LO • PENDING</span>
                  ` : `
                    <span class="badge-failed">FAILED / CANCELLED</span>
                  `}
                </div>
              </div>

              ${!isVerified ? `
                <div class="warning-banner">
                  <strong style="display: block; font-size: 12px; margin-bottom: 2px;">⚠️ HE SLIP HI PAWISA PEK FEL CHIANNA A NI LO</strong>
                  He transaction hi a la <strong>PENDING</strong> (a la lut fel lo) a ni a. Bank emaw PhonePe aṭanga confirmation hmuh a, status <strong>Verified</strong> a nih hma chu official receipt atan pawm a ni rih lo.
                </div>
              ` : ''}

              <div class="amount-box">
                <div style="font-size: 11px; color: ${isVerified ? '#64748b' : '#b45309'}; font-weight: bold; text-transform: uppercase;">
                  ${isVerified ? 'Pek Zat (Amount Paid)' : 'Sum Thawh Tum Zat (Pending / Unconfirmed)'}
                </div>
                <div class="amount-val">₹${totalAmt.toLocaleString('en-IN')}</div>
                ${!isVerified ? `
                  <div style="font-size: 10.5px; color: #b45309; font-weight: 700; margin-top: 4px;">Status: A la lut fel lo (Pending verification)</div>
                ` : ''}
              </div>

              ${fee > 0 ? `
              <div class="row" style="background: #f8fafc; padding: 6px 8px; border-radius: 8px; margin: 6px 0;">
                <span class="label">Bawm Thawh Zat:</span>
                <span class="val font-mono">₹${(tx.feeOption === 'DEDUCT' ? netAmt : baseAmt).toLocaleString('en-IN')}</span>
              </div>
              <div class="row" style="background: #f8fafc; padding: 6px 8px; border-radius: 8px; margin: 6px 0;">
                <span class="label">RonPay PG Fee (1%):</span>
                <span class="val font-mono">₹${fee.toLocaleString('en-IN')} (${tx.feeOption === 'ADD_ON' ? 'Donor Pek Belh' : 'Thawhzat Atanga Paih'})</span>
              </div>
              <div class="row" style="font-weight: bold; border-top: 1px dashed #cbd5e1; padding-top: 6px; margin-top: 6px;">
                <span class="label">Total Paid (Pek Pumhlum):</span>
                <span class="val font-mono" style="color: ${isVerified ? '#047857' : '#b45309'}; font-size: 14px;">₹${totalAmt.toLocaleString('en-IN')}</span>
              </div>
              ` : ''}

              <div class="row">
                <span class="label">Receipt No / TX ID:</span>
                <span class="val" style="font-family: monospace;">${tx.id || '—'}</span>
              </div>
              <div class="row">
                <span class="label">Date & Time:</span>
                <span class="val">${formatDateTimeDDMMYYYY(tx.timestamp)}</span>
              </div>
              <div class="row">
                <span class="label">Status:</span>
                <span class="val" style="color: ${isVerified ? '#047857' : '#b45309'}; font-weight: 800;">
                  ${isVerified ? '✅ VERIFIED / SUCCESS' : isPending ? '⏳ PENDING (A LA LUT LO)' : '❌ FAILED'}
                </span>
              </div>
              ${tx.periodLabel ? `
                <div class="row">
                  <span class="label">Pek Hun / Period:</span>
                  <span class="val" style="color: #4338ca;">${tx.periodLabel}</span>
                </div>
              ` : ''}
              <div class="row">
                <span class="label">Category / Bawm:</span>
                <span class="val" style="text-transform: uppercase; color: #4338ca;">${categoryLabel}</span>
              </div>
              <div class="row">
                <span class="label">Bawm / Pawisa thawh chhan:</span>
                <span class="val" style="font-weight: bold; color: #1e1b4b;">${resolveTxCampaignTitle(tx)}</span>
              </div>
              <div class="row">
                <span class="label">Petu Hming:</span>
                <span class="val">${tx.isAnonymous ? 'Anonymous' : (tx.donorName || 'Valued Donor')}</span>
              </div>
              ${tx.donorPhone ? `
              <div class="row">
                <span class="label">Phone:</span>
                <span class="val font-mono">+91 ${tx.donorPhone}</span>
              </div>` : ''}
              <div class="row">
                <span class="label">Payment Mode:</span>
                <span class="val" style="text-transform: uppercase; color: ${isPhonePe ? '#5f259f' : '#4338ca'}; font-weight: 800;">
                  ${isPhonePe ? '⚡ PHONEPE PG V2' : isOnline ? '⚡ ONLINE UPI' : '💵 CASH DEPOSIT'}
                </span>
              </div>
              ${tx.remark ? `
                <div class="row">
                  <span class="label">Remark:</span>
                  <span class="val">${tx.remark}</span>
                </div>
              ` : ''}
              
              ${subcatsHtml}

              <div class="footer">
                RonPay Community Payment Platform • Mizoram<br />
                ${isVerified 
                  ? 'Verified & Recorded electronically. No signature required.' 
                  : 'RonPay Pending Record • Bank confirmation la nghah mek a ni. Official receipt atan pawm a ni rih lo.'}
              </div>
            </div>
          </body>
        </html>
      `;

      printHtmlSafely(html, `RonPay-${isVerified ? 'Receipt' : 'Slip'}-${tx.id || 'TXN'}`);
    } catch (err) {
      console.error('Error printing single receipt:', err);
    }
  };

  const currentUserName = creatorProfile?.name || 'RonPay User';
  const currentUserPhone = creatorProfile?.phone ? `+91 ${creatorProfile.phone}` : null;

  return (
    <div 
      id="pekna-sulhnu-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900"
    >
      <div 
        id="pekna-sulhnu-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-lg rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-200 relative flex flex-col h-full sm:h-[90vh] max-h-[90vh] shrink-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 truncate">Pekna Sulhnu</h3>
                <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  {creatorProfile?.isAdmin ? 'ADMIN CONSOLE' : isCreatorAccount ? 'CREATOR SULHNU' : 'KA SULHNU'}
                </span>
              </div>
              <p className="text-[10.5px] text-slate-500 font-medium truncate">
                {currentUserName} {currentUserPhone ? `(${currentUserPhone})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              id="sulhnu-modal-refresh-btn"
              type="button"
              title="Sync & Refresh Database"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleManualRefresh();
              }}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            <button
              id="sulhnu-modal-close-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Identity / Privacy Badge */}
        <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 my-2 text-[10.5px] shrink-0">
          <div className="flex items-center gap-1.5 text-slate-600 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-bold text-slate-800 truncate">{currentUserName}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-500 truncate">{currentUserPhone || 'Active Account'}</span>
          </div>
          <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shrink-0">
            SECURE & ISOLATED
          </span>
        </div>

        {/* Scope Switcher (A Vaiin / Ka Thawhte / Bawm Dawnte) */}
        {(receivedCount > 0 || isCreatorAccount) ? (
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl mb-2.5 shrink-0 text-xs font-bold">
            <button
              id="sulhnu-dir-all-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionFilter('all');
              }}
              className={`py-1.5 rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'all'
                  ? 'bg-slate-900 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3 h-3" />
              <span>A Vaiin</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                directionFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {safeTransactions.length}
              </span>
            </button>

            <button
              id="sulhnu-dir-sent-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionFilter('sent');
              }}
              className={`py-1.5 rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'sent'
                  ? 'bg-indigo-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>Ka Thawhte</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                directionFilter === 'sent' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {sentCount}
              </span>
            </button>

            <button
              id="sulhnu-dir-received-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionFilter('received');
              }}
              className={`py-1.5 rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'received'
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-3 h-3" />
              <span>Bawm Dawnte</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                directionFilter === 'received' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {receivedCount}
              </span>
            </button>
          </div>
        ) : sentCount > 0 ? (
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-2.5 shrink-0 text-xs font-bold">
            <button
              id="sulhnu-dir-all-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionFilter('all');
              }}
              className={`py-1.5 rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'all'
                  ? 'bg-slate-900 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3 h-3" />
              <span>A Vaiin</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                directionFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {safeTransactions.length}
              </span>
            </button>

            <button
              id="sulhnu-dir-sent-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionFilter('sent');
              }}
              className={`py-1.5 rounded-lg transition text-[11px] flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'sent'
                  ? 'bg-indigo-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>Ka Thawhte (Sent)</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                directionFilter === 'sent' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {sentCount}
              </span>
            </button>
          </div>
        ) : null}

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl p-3.5 text-white mb-2.5 shrink-0 shadow-md border border-indigo-800">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span>
                  {directionFilter === 'received' ? 'Bawm Sum Dawn Zat (Verified Received)' :
                   directionFilter === 'sent' ? 'I Pek/Thawh Zat (Verified Paid)' :
                   'Sulhnu Sum Zat (Hlawhtling Chauh)'}
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </span>
              <div className="text-2xl font-black text-amber-400 mt-0.5">
                ₹{confirmedTotalAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-indigo-200 font-bold">Thawh Zat (Verified)</span>
              <div className="text-lg font-black text-white">{confirmedFiltered.length} entries</div>
            </div>
          </div>

          {/* Pending Banner if any unconfirmed transactions exist */}
          {pendingFiltered.length > 0 && (
            <div className="mt-2.5 pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span className="text-[11px] text-amber-200 font-medium">
                  A la pending (La lut lo): <strong className="text-amber-300 font-black">₹{pendingTotalAmount.toLocaleString('en-IN')}</strong> ({pendingFiltered.length} txns)
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending');
                  }}
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md transition cursor-pointer border ${
                    statusFilter === 'pending'
                      ? 'bg-amber-400 text-slate-900 border-amber-300'
                      : 'bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border-amber-400/30'
                  }`}
                >
                  {statusFilter === 'pending' ? 'Show All' : 'Pending Chauh En'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirmClearAll(true);
                  }}
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 transition cursor-pointer flex items-center gap-1"
                  title="Paih fai rawh"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Paih Fai Rawh</span>
                </button>
              </div>
            </div>
          )}

          {/* Confirm Clear All Pending Banner */}
          {showConfirmClearAll && pendingFiltered.length > 0 && (
            <div className="mt-2 p-2.5 bg-rose-950/90 border border-rose-500/40 rounded-xl text-white flex flex-col sm:flex-row items-center justify-between gap-2 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="font-semibold">Pending {pendingFiltered.length} awm zawng zawng hi paih fai i duh takzet em?</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowConfirmClearAll(false)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                >
                  Sut leh rawh
                </button>
                <button
                  type="button"
                  onClick={handleClearAllPending}
                  className="px-3 py-1 text-[11px] font-black bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Paih Fai Vek Rawh</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-2 mb-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="sulhnu-search-input"
              type="text"
              placeholder="Search by Bawm, Donor name, Phone or Period..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Category Tabs with Smooth Scroll */}
          <div className="relative group">
            <div className="flex gap-1.5 overflow-x-auto pb-2 pt-0.5 text-xs scroll-smooth scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-slate-100">
              {[
                { key: 'all', label: 'All Categories', count: directionFiltered.length },
                { key: 'ralna', label: 'Ralna Bawm', count: directionFiltered.filter(t => getEffectiveCategory(t) === 'ralna').length },
                { key: 'khawlsak', label: 'Khawlsak Bawm', count: directionFiltered.filter(t => getEffectiveCategory(t) === 'khawlsak').length },
                { key: 'rikrum', label: 'Rikrum Bawm', count: directionFiltered.filter(t => getEffectiveCategory(t) === 'rikrum').length },
                { key: 'kumtluang', label: 'Kumtluang Bawm', count: directionFiltered.filter(t => getEffectiveCategory(t) === 'kumtluang').length },
                { key: 'others', label: 'Others (Bills/Recharge)', count: directionFiltered.filter(t => getEffectiveCategory(t) === 'others').length },
              ].map(tab => {
                const isActive = filterCategory === tab.key;
                return (
                  <button
                    key={tab.key}
                    id={`sulhnu-tab-${tab.key}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFilterCategory(tab.key);
                    }}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    isActive
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-black ${
                        isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Sub-filter if pending transactions exist */}
          {pendingFiltered.length > 0 && (
            <div className="flex items-center gap-1.5 px-0.5 pt-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-500 shrink-0">Filter Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold transition cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                A vaiin ({filtered.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('verified')}
                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'verified'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Verified ({confirmedFiltered.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300'
                }`}
              >
                <Clock className="w-3 h-3 text-amber-600" />
                <span>Pending ({pendingFiltered.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* List of Donations */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-2.5 pr-1 text-xs">
          {displayedList.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl my-auto">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                <HeartHandshake className="w-6 h-6 stroke-1.5" />
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-slate-800 text-sm">
                  {statusFilter !== 'all' 
                    ? `Status "${statusFilter}"-ah record a awm lo` 
                    : 'Sulhnu a la awm rih lo'}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  {statusFilter !== 'all' ? (
                    'Filter thlan dangah record an awm mai thei e. "Show All" hmetin en rawh.'
                  ) : transactions.length > 0 && (filterCategory !== 'all' || directionFilter !== 'all' || searchQuery.trim()) ? (
                    'I filter / search thlanah hian record a awm lo. Filter paihin en leh rawh.'
                  ) : isCreatorAccount ? (
                    'I Bawm siamah sum thawh a la lut lo a, sum i la thawh ve lo a ni e.'
                  ) : (
                    `He account / phone (${currentUserPhone || 'he device'}) hmanga sum pek leh thawh a la awm lo a ni. Bawm thlangin sum i thawh/pek veleh i receipt leh sulhnute hetah hian a lo lang nghal ang.`
                  )}
                </p>
              </div>

              {statusFilter !== 'all' ? (
                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
                  >
                    A Vaiin En Rawh ({filtered.length})
                  </button>
                </div>
              ) : transactions.length > 0 && (filterCategory !== 'all' || directionFilter !== 'all' || searchQuery.trim()) ? (
                <div className="pt-2 flex justify-center">
                  <button
                    id="sulhnu-reset-filter-btn"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setFilterCategory('all');
                      setDirectionFilter('all');
                      setSearchQuery('');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                  >
                    Filter Paih Rawh (Show All)
                  </button>
                </div>
              ) : (onNavigateToDonate || onOpenScanner) && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {onOpenScanner && (
                    <button
                      id="sulhnu-empty-scanner-btn"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenScanner();
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Code Scan Rawh</span>
                    </button>
                  )}
                  {onNavigateToDonate && (
                    <button
                      id="sulhnu-empty-donate-btn"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onNavigateToDonate();
                      }}
                      className="bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-300 transition cursor-pointer active:scale-95 flex items-center gap-1"
                    >
                      <span>Bawm Thlang Rawh</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            displayedList.map((tx) => {
              const effectiveCat = getEffectiveCategory(tx);
              const isRalna = effectiveCat === 'ralna';
              const isRikrum = effectiveCat === 'rikrum';
              const isKhawlsak = effectiveCat === 'khawlsak';
              const isKumtluang = effectiveCat === 'kumtluang';
              const isOthers = effectiveCat === 'others';
              const direction = getTxDirection(tx);
              const isReceived = direction === 'received';

              const isPhonePe = tx.paymentMethod === 'phonepe' || (typeof tx.id === 'string' && tx.id.startsWith('RPAY_TXN_'));
              const isOnline = tx.paymentMethod === 'online' || isPhonePe;
              const isCash = tx.paymentMethod === 'cash';
              const isVerified = isConfirmedTransaction(tx);
              const isPending = !isVerified && (tx.status === 'pending' || tx.status === 'pending_verification' || !tx.status);

              // Compute actual display amounts based on feeOption
              const baseAmt = Number(tx.amount) || 0;
              const fee = Number(tx.platformFee) || 0;
              const totalAmt = Number(tx.totalAmount) || (tx.feeOption === 'ADD_ON' ? (baseAmt + fee) : baseAmt);
              const netAmt = Number(tx.campaignNetReceived) || (tx.feeOption === 'DEDUCT' ? Math.max(0, baseAmt - fee) : baseAmt);

              let effectiveDisplayAmount = baseAmt;
              let splitBadge = '';

              if (isReceived) {
                // Recipient (Bawm Dawngtu) view: what Bawm actually received
                effectiveDisplayAmount = tx.feeOption === 'DEDUCT' ? netAmt : baseAmt;
                if (fee > 0) {
                  splitBadge = tx.feeOption === 'DEDUCT'
                    ? `Pek zat: ₹${totalAmt} (₹${fee} fee paih)`
                    : `Donor pek belh: ₹${fee} fee`;
                }
              } else {
                // Donor (Thawhtu) view: what donor actually paid
                effectiveDisplayAmount = totalAmt;
                if (fee > 0) {
                  splitBadge = tx.feeOption === 'ADD_ON'
                    ? `₹${baseAmt} Bawm + ₹${fee} Fee (Pek belh)`
                    : `₹${netAmt} Bawm + ₹${fee} Fee (Paih)`;
                }
              }

              return (
                <div
                  key={tx.id}
                  id={`sulhnu-item-${tx.id}`}
                  className={`p-3 rounded-2xl border transition space-y-2 ${
                    !isVerified 
                      ? 'bg-amber-50/50 hover:bg-amber-50/80 border-amber-300 shadow-2xs'
                      : isReceived 
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-200' 
                        : 'bg-slate-50 hover:bg-indigo-50/40 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Direction Badge */}
                      {isCreatorAccount && (
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 ${
                          isReceived 
                            ? 'bg-emerald-700 text-white shadow-2xs' 
                            : 'bg-indigo-700 text-white shadow-2xs'
                        }`}>
                          {isReceived ? <ArrowDownLeft className="w-2.5 h-2.5" /> : <ArrowUpRight className="w-2.5 h-2.5" />}
                          <span>{isReceived ? 'BAWM DAWNNA' : 'KA PEKNA'}</span>
                        </span>
                      )}

                      {/* Category Badge */}
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        isRalna ? 'bg-slate-900 text-white border-slate-800' :
                        isRikrum ? 'bg-rose-100 text-rose-800 border-rose-200' :
                        isKhawlsak ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        isKumtluang ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-purple-100 text-purple-900 border-purple-200'
                      }`}>
                        {isOthers ? 'OTHERS / BILL' : effectiveCat}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono font-medium">
                        {tx.id}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className={`font-black text-sm ${!isVerified ? 'text-amber-800' : isReceived ? 'text-emerald-800' : 'text-slate-900'}`}>
                        {isReceived && isVerified ? '+' : ''}₹{effectiveDisplayAmount.toLocaleString('en-IN')}
                      </div>
                      {!isVerified ? (
                        <div className="text-[8.5px] font-extrabold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300 mt-0.5 inline-block">
                          ⏳ A LA LUT LO (PENDING)
                        </div>
                      ) : splitBadge ? (
                        <div className="text-[9px] font-bold text-indigo-700 bg-indigo-50/90 px-1.5 py-0.5 rounded border border-indigo-100 mt-0.5 inline-block">
                          {splitBadge}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">
                      {resolveTxCampaignTitle(tx)}
                    </h4>
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 mt-0.5">
                      <span>{formatDateDDMMYYYY(tx.timestamp)}</span>
                      {tx.periodLabel && (
                        <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          {tx.periodLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Donor details for Bawm Dawnna or Sent */}
                  <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-xl border border-slate-200/80 text-[10.5px]">
                    <div className="flex items-center gap-1.5 text-slate-700 truncate">
                      <span className="font-semibold text-slate-400">{isReceived ? 'Petu:' : 'Thawhtu:'}</span>
                      <span className="font-bold text-slate-900 truncate">
                        {tx.isAnonymous ? 'Anonymous Donor' : (tx.donorName || 'Valued Donor')}
                      </span>
                      {tx.donorPhone && (
                        <span className="text-[9.5px] text-slate-500 font-mono">
                          (+91 {tx.donorPhone})
                        </span>
                      )}
                    </div>
                    {tx.donorVeng && (
                      <span className="text-[9.5px] text-slate-500 font-medium shrink-0 ml-1">
                        {tx.donorVeng}
                      </span>
                    )}
                  </div>

                  {/* Sub category tags if available */}
                  {tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/60">
                      {Object.entries(tx.subCategoryBreakdown).map(([cat, amt]) => (
                        <span key={cat} className="text-[9.5px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                          {cat}: <b>₹{amt}</b>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Remark if present */}
                  {tx.remark && (
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200/80 text-[10px] text-slate-600">
                      <MessageSquare className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-slate-700">Remark:</span>
                      <span className="italic truncate">{tx.remark}</span>
                    </div>
                  )}

                  {/* Actions & Payment Mode */}
                  {!isVerified ? (
                    <div className="flex justify-between items-center pt-1.5 border-t border-amber-200/80 flex-wrap gap-1.5">
                      <div className="flex items-center gap-1.5">
                        {isPhonePe ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-purple-50 text-[#5f259f] border border-purple-200" title="PhonePe PG Payment">
                            <Zap className="w-2.5 h-2.5 text-[#5f259f] fill-[#5f259f]" />
                            <span>PhonePe</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                            <Zap className="w-2.5 h-2.5 text-amber-500" />
                            <span>Online</span>
                          </span>
                        )}
                        <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Pending</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          id={`sulhnu-check-btn-${tx.id}`}
                          type="button"
                          disabled={checkingTxId === tx.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCheckPendingStatus(tx);
                          }}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-extrabold py-1 px-2 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                          title="Check status from PhonePe / Bank"
                        >
                          <RefreshCw className={`w-3 h-3 text-amber-800 ${checkingTxId === tx.id ? 'animate-spin' : ''}`} />
                          <span>{checkingTxId === tx.id ? 'Enfiah mek...' : 'Enfiah / Check'}</span>
                        </button>

                        <button
                          id={`sulhnu-delete-btn-${tx.id}`}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeletePendingTx(tx.id);
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-extrabold py-1 px-2 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                          title="Pending payment paih rawh"
                        >
                          <Trash2 className="w-3 h-3 text-rose-600" />
                          <span>Paih</span>
                        </button>

                        <button
                          id={`sulhnu-print-btn-${tx.id}`}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            printSingleReceipt(tx);
                          }}
                          className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-extrabold py-1 px-2 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                          title="Print pending transaction slip"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          <span>Slip</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                      <div className="flex items-center gap-1.5">
                        {isPhonePe ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-purple-50 text-[#5f259f] border border-purple-200" title="PhonePe PG Payment">
                            <Zap className="w-2.5 h-2.5 text-[#5f259f] fill-[#5f259f]" />
                            <span>PhonePe</span>
                          </span>
                        ) : isOnline ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200" title="Online UPI Payment">
                            <Zap className="w-2.5 h-2.5 text-amber-500" />
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200" title="Cash Counter Deposit">
                            <Banknote className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Cash</span>
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-emerald-600">
                          • Verified
                        </span>
                      </div>

                      <button
                        id={`sulhnu-print-btn-${tx.id}`}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          printSingleReceipt(tx);
                        }}
                        className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold py-1 px-2.5 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Printer className="w-3 h-3 text-indigo-600" />
                        Print Receipt
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Status Dialog for Pending Transactions */}
        {statusDialogTx && (
          <div 
            className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => {
              setStatusDialogTx(null);
              setStatusDialogResult(null);
            }}
          >
            <div 
              className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-2xl border border-slate-200 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    statusDialogResult?.status === 'FAILED' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {statusDialogResult?.status === 'FAILED' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm">Pending Payment Check</h3>
                    <p className="text-[10px] text-slate-500 font-mono">{statusDialogTx.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStatusDialogTx(null);
                    setStatusDialogResult(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-extrabold text-slate-900">₹{statusDialogTx.amount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bawm:</span>
                  <span className="font-bold text-slate-800">{resolveTxCampaignTitle(statusDialogTx)}</span>
                </div>
                {statusDialogResult && (
                  <div className="pt-1 text-[11px] font-medium text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    {statusDialogResult.message}
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {statusDialogResult?.status === 'FAILED' ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePendingTx(statusDialogTx.id)}
                    className="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition active:scale-98"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Failed Record Paih Fai Rawh</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleManualConfirmPaid(statusDialogTx)}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Pawisa a lut tawh e (Confirm as Verified)</span>
                  </button>
                )}

                <div className="flex items-center gap-2">
                  {statusDialogResult?.status === 'FAILED' ? (
                    <button
                      type="button"
                      onClick={() => handleManualConfirmPaid(statusDialogTx)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Pawisa a lut zawk e</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeletePendingTx(statusDialogTx.id)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Paih Rawh</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setStatusDialogTx(null);
                      setStatusDialogResult(null);
                    }}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                  >
                    Khár Rawh
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Toast */}
        {actionToast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-70 bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 border border-slate-700 animate-fade-in pointer-events-none">
            <span>{actionToast}</span>
          </div>
        )}
      </div>
    </div>
  );
};
