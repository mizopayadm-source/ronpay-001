import React, { useState, useMemo } from 'react';
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
  Check,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Transaction, Campaign, BawmCategory, CreatorProfile } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';
import { isCampaignCreator, saveTransaction, saveMultipleTransactions } from '../utils/storage';

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
  onApproveTransaction?: (transaction: Transaction) => void;
  onRejectTransaction?: (transaction: Transaction) => void;
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
  onApproveTransaction,
  onRejectTransaction,
}) => {
  const [directionFilter, setDirectionFilter] = useState<'all' | 'received' | 'sent' | 'pending'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

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
    return Array.isArray(transactions) ? transactions.filter(Boolean) : [];
  }, [transactions]);

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

  // Helper to determine if transaction is received in creator's bawm or sent as donor
  const getTxDirection = (tx?: Transaction | null): 'received' | 'sent' => {
    if (!tx) return 'sent';
    
    // Super admin can view all transactions as received donations across platform
    if (creatorProfile?.isAdmin) {
      return 'received';
    }

    const campId = tx.campaignId ? String(tx.campaignId) : '';
    const campTitle = tx.campaignTitle ? String(tx.campaignTitle).toLowerCase().trim() : '';

    const isOwned = (campId && ownedCampaignIds.has(campId)) || 
      (campTitle ? ownedCampaignTitles.has(campTitle) : false);

    if (isOwned) {
      // If creator was also the donor, check if phone matches and not just received
      const profilePhone = creatorProfile?.phone ? String(creatorProfile.phone).replace(/\D/g, '').slice(-10) : '';
      const txPhone = tx.donorPhone ? String(tx.donorPhone).replace(/\D/g, '').slice(-10) : '';
      if (profilePhone && txPhone && profilePhone === txPhone && safeUserPaidIds.includes(tx.id)) {
        return 'sent';
      }
      return 'received';
    }
    return 'sent';
  };

  // Pending cash verification transactions for this creator / admin
  const pendingCashList = useMemo(() => {
    return safeTransactions.filter(t => {
      if (!t || (t.status !== 'pending_verification' && t.status !== 'pending')) return false;
      if (creatorProfile?.isAdmin) return true;
      const campId = t.campaignId ? String(t.campaignId) : '';
      const campTitle = t.campaignTitle ? String(t.campaignTitle).toLowerCase().trim() : '';
      return (campId && ownedCampaignIds.has(campId)) || (campTitle && ownedCampaignTitles.has(campTitle));
    });
  }, [safeTransactions, ownedCampaignIds, ownedCampaignTitles, creatorProfile]);

  const handleApproveInternal = (tx: Transaction) => {
    const updated: Transaction = {
      ...tx,
      status: 'completed',
      verifiedBy: creatorProfile?.name || (creatorProfile?.isAdmin ? 'Admin' : 'Creator'),
      verifiedAt: new Date().toISOString(),
    };
    saveTransaction(updated);
    if (onApproveTransaction) {
      onApproveTransaction(updated);
    }
    if (onRefreshData) {
      onRefreshData();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated'));
      window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
    }
    setActionFeedback(`✅ ₹${Number(tx.amount || 0).toLocaleString('en-IN')} (${tx.isAnonymous ? 'Anonymous' : tx.donorName || 'User'}) cash dawn hi i hmuhpui (Approved & Verified) fel ta!`);
    setTimeout(() => setActionFeedback(null), 4500);
  };

  const handleRejectInternal = (tx: Transaction) => {
    const updated: Transaction = {
      ...tx,
      status: 'rejected',
      verifiedBy: creatorProfile?.name || (creatorProfile?.isAdmin ? 'Admin' : 'Creator'),
      verifiedAt: new Date().toISOString(),
    };
    saveTransaction(updated);
    if (onRejectTransaction) {
      onRejectTransaction(updated);
    }
    if (onRefreshData) {
      onRefreshData();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated'));
      window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
    }
    setActionFeedback(`❌ ₹${Number(tx.amount || 0).toLocaleString('en-IN')} cash donation hi hnawl (Rejected) a ni.`);
    setTimeout(() => setActionFeedback(null), 4500);
  };

  const handleApproveAllPending = () => {
    if (pendingCashList.length === 0) return;
    const updatedList = pendingCashList.map(t => ({
      ...t,
      status: 'completed' as const,
      verifiedBy: creatorProfile?.name || (creatorProfile?.isAdmin ? 'Admin' : 'Creator'),
      verifiedAt: new Date().toISOString(),
    }));
    saveMultipleTransactions(updatedList);
    updatedList.forEach(u => onApproveTransaction && onApproveTransaction(u));
    if (onRefreshData) {
      onRefreshData();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated'));
      window.dispatchEvent(new CustomEvent('ronpay_trigger_sync'));
    }
    setActionFeedback(`✅ Cash dawn zawng zawng (${pendingCashList.length}) i hmuhpui (Approved & Verified) fel vek ta!`);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const receivedCount = useMemo(() => {
    return safeTransactions.filter(t => getTxDirection(t) === 'received').length;
  }, [safeTransactions, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  const sentCount = useMemo(() => {
    return safeTransactions.filter(t => getTxDirection(t) === 'sent').length;
  }, [safeTransactions, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  // Direction-filtered transactions for accurate tab counts
  const directionFiltered = useMemo(() => {
    return safeTransactions.filter(t => {
      if (!t) return false;
      if (directionFilter === 'pending') {
        return t.status === 'pending_verification' || t.status === 'pending';
      }
      const dir = getTxDirection(t);
      if (directionFilter === 'received' && dir !== 'received') return false;
      if (directionFilter === 'sent' && dir !== 'sent') return false;
      return true;
    });
  }, [safeTransactions, directionFilter, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

  const filtered = useMemo(() => {
    return safeTransactions.filter(t => {
      if (!t) return false;
      // 1. Direction / Status Filter
      if (directionFilter === 'pending') {
        if (t.status !== 'pending_verification' && t.status !== 'pending') return false;
      } else {
        const dir = getTxDirection(t);
        if (directionFilter === 'received' && dir !== 'received') return false;
        if (directionFilter === 'sent' && dir !== 'sent') return false;
      }

      // 2. Category Filter
      const effectiveCategory = getEffectiveCategory(t);
      if (filterCategory !== 'all' && effectiveCategory !== filterCategory) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.campaignTitle ? String(t.campaignTitle).toLowerCase().includes(q) : false;
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

  const totalAmount = useMemo(() => {
    return filtered.reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  }, [filtered]);

  if (!isOpen) return null;

  const printSingleReceipt = (tx: Transaction) => {
    try {
      const effectiveCat = getEffectiveCategory(tx);
      const categoryLabel = effectiveCat === 'others' 
        ? 'OTHERS (BILLS & RECHARGE)' 
        : String(effectiveCat).toUpperCase() + ' BAWM';

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
            <title>RonPay Official Receipt - ${tx.id || 'TXN'}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 30px 20px; color: #1e1b4b; text-align: center; }
              .receipt-card { max-width: 380px; margin: 0 auto; border: 2px solid #4338ca; border-radius: 20px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: left; }
              .badge { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; display: inline-block; }
              .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
              .label { color: #64748b; }
              .val { font-weight: bold; color: #0f172a; }
              .amount-box { background: #f1f5f9; padding: 15px; border-radius: 12px; text-align: center; margin: 15px 0; border: 1px dashed #cbd5e1; }
              .amount-val { font-size: 26px; font-weight: 900; color: #047857; }
              .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="receipt-card">
              <div style="text-align: center; margin-bottom: 15px;">
                <h2 style="margin: 0; color: #1e1b4b; font-size: 20px;">RONPAY OFFICIAL RECEIPT</h2>
                <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Mizoram Community & Bawm Payment</div>
                <div style="margin-top: 8px;"><span class="badge">PAID & VERIFIED</span></div>
              </div>

              <div class="amount-box">
                <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Pek Zat (Amount)</div>
                <div class="amount-val">₹${(Number(tx.amount) || 0).toLocaleString('en-IN')}</div>
              </div>

              <div class="row">
                <span class="label">Receipt No / TX ID:</span>
                <span class="val" style="font-family: monospace;">${tx.id || '—'}</span>
              </div>
              <div class="row">
                <span class="label">Date & Time:</span>
                <span class="val">${formatDateTimeDDMMYYYY(tx.timestamp)}</span>
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
                <span class="label">Campaign / Service:</span>
                <span class="val">${tx.campaignTitle || '—'}</span>
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
                <span class="val" style="text-transform: uppercase;">${tx.paymentMethod === 'online' ? '⚡ ONLINE UPI' : '💵 CASH DEPOSIT'}</span>
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
                Verified & Recorded electronically. No signature required.
              </div>
            </div>
          </body>
        </html>
      `;

      printHtmlSafely(html, `RonPay-Receipt-${tx.id || 'TXN'}`);
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
        className="bg-white w-full max-w-lg rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl border border-slate-200 relative flex flex-col h-[94vh] sm:h-[90vh] max-h-[94vh] shrink-0 overflow-hidden"
      >
        {/* Header - Compact & Sticky */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">Pekna Sulhnu</h3>
                <span className="text-[8.5px] bg-indigo-100 text-indigo-800 font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                  {creatorProfile?.isAdmin ? 'ADMIN CONSOLE' : isCreatorAccount ? 'CREATOR SULHNU' : 'KA SULHNU'}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate">
                {currentUserName} {currentUserPhone ? `(${currentUserPhone})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            <button
              id="sulhnu-modal-refresh-btn"
              type="button"
              title="Sync & Refresh Database"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleManualRefresh();
              }}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition cursor-pointer"
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
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Creator Scope Switcher (Dawnte vs Thawhte vs Pending) - Sticky */}
        {isCreatorAccount && (receivedCount > 0 || sentCount > 0 || pendingCashList.length > 0) && (
          <div className={`grid ${pendingCashList.length > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-1 p-1 bg-slate-100 rounded-xl my-2 shrink-0 text-xs font-bold`}>
            <button
              id="sulhnu-dir-all-btn"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionFilter('all');
              }}
              className={`py-1.5 rounded-lg transition text-[10.5px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'all'
                  ? 'bg-white text-indigo-950 font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Zawng zawng</span>
              <span className="text-[9px] bg-slate-200 text-slate-700 px-1 py-0.2 rounded-full font-black">
                {transactions.length}
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
              className={`py-1.5 rounded-lg transition text-[10.5px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'received'
                  ? 'bg-emerald-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Inbox className="w-3 h-3" />
              <span>Bawm Dawnte</span>
              <span className={`text-[9px] px-1 py-0.2 rounded-full font-black ${
                directionFilter === 'received' ? 'bg-emerald-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {receivedCount}
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
              className={`py-1.5 rounded-lg transition text-[10.5px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer ${
                directionFilter === 'sent'
                  ? 'bg-indigo-600 text-white font-black shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Send className="w-3 h-3" />
              <span>Ka Thawhte</span>
              <span className={`text-[9px] px-1 py-0.2 rounded-full font-black ${
                directionFilter === 'sent' ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {sentCount}
              </span>
            </button>

            {pendingCashList.length > 0 && (
              <button
                id="sulhnu-dir-pending-btn"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDirectionFilter('pending');
                  setFilterCategory('all');
                }}
                className={`py-1.5 rounded-lg transition text-[10.5px] sm:text-xs flex items-center justify-center gap-1 cursor-pointer ${
                  directionFilter === 'pending'
                    ? 'bg-amber-500 text-white font-black shadow-xs ring-2 ring-amber-300'
                    : 'text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-300 font-extrabold'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Pending</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                  directionFilter === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-600 text-white animate-pulse'
                }`}>
                  {pendingCashList.length}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Action Feedback Toast */}
        {actionFeedback && (
          <div className="bg-emerald-700 text-white p-2.5 rounded-xl mb-2 text-xs font-black flex items-center justify-between gap-2 shadow-lg animate-fadeIn border border-emerald-500 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="truncate">{actionFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="p-1 hover:bg-emerald-800 rounded-lg text-emerald-100 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Container for all content */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-2.5 pr-0.5 sm:pr-1 text-xs">
          {directionFilter === 'pending' ? (
            /* Dedicated Cash Verification View */
            <div className="space-y-2.5">
              <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black shrink-0">
                    <Clock className="w-4 h-4 text-white animate-spin" />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-black tracking-wide flex items-center gap-1.5">
                      <span>Pawisa Fai (Cash) Hmuhpui Tur ({pendingCashList.length})</span>
                    </div>
                    <div className="text-[10px] sm:text-[10.5px] text-amber-100 font-medium">
                      Belhkhawm: ₹{totalAmount.toLocaleString('en-IN')} • Bawm dawngtuin a pawisa dawn ngei hmuhpui turte
                    </div>
                  </div>
                </div>
                {pendingCashList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApproveAllPending}
                    className="bg-white hover:bg-emerald-50 text-emerald-900 font-black text-xs px-3.5 py-2 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer self-stretch sm:self-auto"
                    title="Approve all pending cash donations at once"
                  >
                    <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                    <span>Hmuhpui Vek Rawh ({pendingCashList.length})</span>
                  </button>
                )}
              </div>

              {pendingCashList.length > 3 && (
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    id="sulhnu-pending-search-input"
                    type="text"
                    placeholder="Search pending by Donor name, Phone or Amount..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none transition"
                  />
                </div>
              )}
            </div>
          ) : (
            /* Regular History View */
            <div className="space-y-2.5">
              {/* Reminder Banner if cash is pending */}
              {pendingCashList.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 animate-spin" />
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-amber-950 truncate">
                        Cash Dawn Finfiah Tur ({pendingCashList.length}) A Awm E!
                      </div>
                      <div className="text-[9.5px] text-amber-800 truncate">
                        Bawm-ah pawisa fai thehluh a ni a, lo hmuhpui (approve) rawh le.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setDirectionFilter('pending');
                        setFilterCategory('all');
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[10.5px] px-2.5 py-1.5 rounded-xl cursor-pointer transition shadow-2xs flex items-center gap-1 active:scale-95"
                    >
                      <span>Pending En Rawh</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={handleApproveAllPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] px-2.5 py-1.5 rounded-xl cursor-pointer transition shadow-2xs flex items-center gap-1 active:scale-95"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Hmuhpui Vek</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Summary Card */}
              <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl p-3 text-white shadow-md border border-indigo-800 flex justify-between items-center">
                <div>
                  <span className="text-[9.5px] text-indigo-300 font-bold uppercase tracking-wider">
                    {directionFilter === 'received' ? 'Bawm Sum Dawn Zat (Received Total)' :
                     directionFilter === 'sent' ? 'I Pek/Thawh Zat (Your Giving Total)' :
                     'Sulhnu Sum Zat Zawng'}
                  </span>
                  <div className="text-xl font-black text-amber-400">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] text-indigo-200 font-bold">Thawh Zat (Entries)</span>
                  <div className="text-base font-black text-white">{filtered.length} entries</div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="space-y-2">
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
                  <div className="flex gap-1.5 overflow-x-auto pb-1 pt-0.5 text-xs scroll-smooth scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-slate-100">
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
                          className={`px-2.5 py-1 rounded-xl font-extrabold text-[10.5px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 ${
                          isActive
                              ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80'
                          }`}
                        >
                          <span>{tab.label}</span>
                          {tab.count > 0 && (
                            <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
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
              </div>
            </div>
          )}

          {/* List of Donations */}
          <div className="space-y-2.5 pt-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 px-4 space-y-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl my-auto">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-100 shadow-xs">
                <HeartHandshake className="w-6 h-6 stroke-1.5" />
              </div>
              <div className="space-y-1">
                <p className="font-extrabold text-slate-800 text-sm">Sulhnu a la awm rih lo</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
                  {transactions.length > 0 && (filterCategory !== 'all' || directionFilter !== 'all' || searchQuery.trim())
                    ? 'I filter / search thlanah hian record a awm lo. Filter paihin en leh rawh.'
                    : isCreatorAccount 
                      ? 'I Bawm siamah sum thawh a la lut lo a, sum i la thawh ve lo a ni e.'
                      : `He account / phone (${currentUserPhone || 'he device'}) hmanga sum pek leh thawh a la awm lo a ni. Bawm thlangin sum i thawh/pek veleh i receipt leh sulhnute hetah hian a lo lang nghal ang.`
                  }
                </p>
              </div>

              {transactions.length > 0 && (filterCategory !== 'all' || directionFilter !== 'all' || searchQuery.trim()) ? (
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
            filtered.map((tx) => {
              const effectiveCat = getEffectiveCategory(tx);
              const isRalna = effectiveCat === 'ralna';
              const isRikrum = effectiveCat === 'rikrum';
              const isKhawlsak = effectiveCat === 'khawlsak';
              const isKumtluang = effectiveCat === 'kumtluang';
              const isOthers = effectiveCat === 'others';
              const direction = getTxDirection(tx);
              const isReceived = direction === 'received';
              const isPendingTx = tx.status === 'pending_verification' || tx.status === 'pending';

              return (
                <div
                  key={tx.id}
                  id={`sulhnu-item-${tx.id}`}
                  className={`p-3 rounded-2xl border-2 transition space-y-2 ${
                    isPendingTx
                      ? 'bg-amber-50/90 border-amber-400 shadow-md ring-1 ring-amber-300'
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
                      <div className={`font-black text-sm ${isReceived ? 'text-emerald-800' : 'text-slate-900'}`}>
                        {isReceived ? '+' : ''}₹{(Number(tx.amount) || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">
                      {tx.campaignTitle || 'Campaign'}
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
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      {tx.paymentMethod === 'online' ? (
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
                      {tx.status === 'completed' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Verified</span>
                        </span>
                      ) : (tx.status === 'pending_verification' || tx.status === 'pending') ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Cash Pending</span>
                        </span>
                      ) : tx.status === 'rejected' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                          <X className="w-2.5 h-2.5 text-rose-600" />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-slate-400">• {tx.status}</span>
                      )}
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

                  {/* Cash Pending Approval Action Block */}
                  {isPendingTx && (
                    <>
                      {/* If viewer is Creator or Admin of this campaign, show instant Approve button */}
                      {(creatorProfile?.isAdmin || isCreatorAccount || (tx.campaignId && ownedCampaignIds.has(tx.campaignId)) || (tx.campaignTitle && ownedCampaignTitles.has(String(tx.campaignTitle).toLowerCase().trim()))) ? (
                        <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-400 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-2 shadow-sm">
                          <div>
                            <div className="text-xs text-amber-950 font-black flex items-center gap-1.5">
                              <Banknote className="w-4 h-4 text-emerald-700" />
                              <span>💵 Cash i dawng ngei em? Hmuhpui (Approve) rawh le:</span>
                            </div>
                            <div className="text-[10.5px] text-amber-900 font-medium mt-0.5">
                              Pawisa fai i kutah a lut ngei a nih chuan Hmuhpui (Approve) hmet rawh.
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleApproveInternal(tx);
                              }}
                              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer transition border border-emerald-500"
                            >
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>✓ Hmuhpui (Approve)</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleRejectInternal(tx);
                              }}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-extrabold text-xs px-3 py-2.5 rounded-xl flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Hnar</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[10.5px] text-amber-900 flex items-center gap-2 mt-1.5 font-medium">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>He Cash pek luh hi Creator hmuhpui (verification) a la nghak mek a ni.</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Verified Information */}
                  {tx.status === 'completed' && (
                    <div className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 mt-1 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Verified: Creator / Admin-in pawisa dawn hi a lo hmuhpui (verified) fel tawh e {tx.verifiedBy ? `(${tx.verifiedBy})` : ''}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  </div>
  );
};
