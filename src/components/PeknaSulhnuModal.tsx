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
  RefreshCw
} from 'lucide-react';
import { Transaction, Campaign, BawmCategory, CreatorProfile } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';
import { isCampaignCreator } from '../utils/storage';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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
    return filtered.reduce((sum, t) => {
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
  }, [filtered, ownedCampaignIds, ownedCampaignTitles, creatorProfile, safeUserPaidIds]);

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
                <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Pek Zat (Amount Paid)</div>
                <div class="amount-val">₹${totalAmt.toLocaleString('en-IN')}</div>
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
                <span class="val font-mono" style="color: #047857; font-size: 14px;">₹${totalAmt.toLocaleString('en-IN')}</span>
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
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl p-3.5 text-white mb-2.5 shrink-0 shadow-md border border-indigo-800 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
              {directionFilter === 'received' ? 'Bawm Sum Dawn Zat (Received Total)' :
               directionFilter === 'sent' ? 'I Pek/Thawh Zat (Your Giving Total)' :
               'Sulhnu Sum Zat Zawng Zawng'}
            </span>
            <div className="text-2xl font-black text-amber-400">
              ₹{totalAmount.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-indigo-200 font-bold">Thawh Zat (Entries)</span>
            <div className="text-lg font-black text-white">{filtered.length} entries</div>
          </div>
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
        </div>

        {/* List of Donations */}
        <div className="overflow-y-auto flex-1 min-h-0 space-y-2.5 pr-1 text-xs">
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

              const isPhonePe = tx.paymentMethod === 'phonepe' || (typeof tx.id === 'string' && tx.id.startsWith('RPAY_TXN_'));
              const isOnline = tx.paymentMethod === 'online' || isPhonePe;
              const isCash = tx.paymentMethod === 'cash';
              const isVerified = tx.status === 'completed' || tx.status === 'verified';

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
                    isReceived 
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
                        {isReceived ? '+' : ''}₹{effectiveDisplayAmount.toLocaleString('en-IN')}
                      </div>
                      {splitBadge && (
                        <div className="text-[9px] font-bold text-indigo-700 bg-indigo-50/90 px-1.5 py-0.5 rounded border border-indigo-100 mt-0.5 inline-block">
                          {splitBadge}
                        </div>
                      )}
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
                      <span className={`text-[9px] font-bold ${
                        isVerified ? 'text-emerald-600' : 'text-amber-500'
                      }`}>
                        {isVerified ? '• Verified' : '• Pending'}
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
