import React, { useState, useMemo } from 'react';
import { 
  X, 
  Save, 
  Trash2, 
  Plus, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  User, 
  Building2, 
  Phone, 
  Tag, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Layers,
  ChevronDown
} from 'lucide-react';
import { Transaction, Campaign, MemberRecord } from '../types';
import { ALL_MONTH_NAMES_FULL, ALL_MONTH_NAMES_SHORT, getTransactionMonthInfo, getMonthIndex } from '../utils/monthHelper';
import { formatDateDDMMYYYY } from '../utils/date';

interface EditablePaymentEntry {
  tempId: string;
  originalId?: string; // If it maps to an existing transaction ID
  amount: number;
  dateStr: string; // YYYY-MM-DD
  periodMonth: string; // e.g. "August"
  periodYear: string; // e.g. "2026"
  periodType: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  periodLabel: string;
  paymentMethod: 'online' | 'cash';
  subCategoryBreakdown: { [cat: string]: number };
  remark: string;
  txHash?: string;
  campaignId: string;
  campaignTitle: string;
}

interface DonorPaymentsEditorModalProps {
  donorName: string;
  donorMemberId?: string;
  donorPhone?: string;
  donorSection?: string;
  transactions: Transaction[];
  campaigns: Campaign[];
  activeCampaignId: string;
  isKumtluang?: boolean;
  memberRecord?: MemberRecord | null;
  onClose: () => void;
  onSaveAll: (updatedTransactions: Transaction[], deletedTransactionIds: string[]) => void;
  onDeleteAll?: () => void;
}

export const DonorPaymentsEditorModal: React.FC<DonorPaymentsEditorModalProps> = ({
  donorName,
  donorMemberId,
  donorPhone,
  donorSection,
  transactions,
  campaigns,
  activeCampaignId,
  isKumtluang,
  memberRecord,
  onClose,
  onSaveAll,
  onDeleteAll
}) => {
  // 1. Basic donor info state
  const [currentDonorName, setCurrentDonorName] = useState(donorName);
  const [currentMemberId, setCurrentMemberId] = useState(donorMemberId || memberRecord?.memberId || '');
  const [currentPhone, setCurrentPhone] = useState(donorPhone || memberRecord?.phone || '');
  const [currentSection, setCurrentSection] = useState(donorSection || memberRecord?.veng || '');

  // 2. Active Year selection for month grid
  const defaultYear = useMemo(() => {
    if (transactions.length > 0) {
      const info = getTransactionMonthInfo(transactions[0]);
      if (info.year) return info.year;
    }
    return String(new Date().getFullYear());
  }, [transactions]);

  const [activeYear, setActiveYear] = useState<string>(defaultYear);

  // Available campaigns
  const currentCampaign = useMemo(() => {
    return campaigns.find(c => c.id === activeCampaignId) || campaigns[0];
  }, [campaigns, activeCampaignId]);

  const subCategoriesList = useMemo(() => {
    if (currentCampaign?.subCategories && Array.isArray(currentCampaign.subCategories) && currentCampaign.subCategories.length > 0) {
      return currentCampaign.subCategories;
    }
    return ['Pathian Ram', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];
  }, [currentCampaign]);

  // 3. Initialize editable payment entries from existing transactions
  const [entries, setEntries] = useState<EditablePaymentEntry[]>(() => {
    if (!transactions || transactions.length === 0) {
      const today = new Date();
      const mIdx = today.getMonth();
      return [{
        tempId: `new-${Date.now()}-0`,
        amount: 500,
        dateStr: today.toISOString().split('T')[0],
        periodMonth: ALL_MONTH_NAMES_FULL[mIdx],
        periodYear: String(today.getFullYear()),
        periodType: 'monthly',
        periodLabel: `${ALL_MONTH_NAMES_FULL[mIdx]} ${today.getFullYear()}`,
        paymentMethod: 'online',
        subCategoryBreakdown: {},
        remark: '',
        campaignId: activeCampaignId || 'camp-default',
        campaignTitle: currentCampaign?.title || 'General Collection',
      }];
    }

    return transactions.map((t, idx) => {
      let dStr = '';
      try {
        const d = new Date(t.timestamp);
        if (!isNaN(d.getTime())) {
          dStr = d.toISOString().split('T')[0];
        }
      } catch {}
      if (!dStr) dStr = new Date().toISOString().split('T')[0];

      const mInfo = getTransactionMonthInfo(t);

      return {
        tempId: t.id || `temp-${idx}`,
        originalId: t.id,
        amount: t.amount,
        dateStr: dStr,
        periodMonth: mInfo.fullMonth,
        periodYear: mInfo.year || defaultYear,
        periodType: (t.periodType as any) || 'monthly',
        periodLabel: t.periodLabel || `${mInfo.fullMonth} ${mInfo.year || defaultYear}`,
        paymentMethod: t.paymentMethod === 'cash' ? 'cash' : 'online',
        subCategoryBreakdown: t.subCategoryBreakdown ? { ...t.subCategoryBreakdown } : {},
        remark: t.remark || '',
        txHash: t.txHash,
        campaignId: t.campaignId || activeCampaignId,
        campaignTitle: t.campaignTitle || currentCampaign?.title || 'Collection',
      };
    });
  });

  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Calculate live total across all entries
  const totalAmount = useMemo(() => {
    return entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [entries]);

  // Quick Month Grid lookup (Map month full name -> entry)
  const monthEntryMap = useMemo(() => {
    const map = new Map<string, EditablePaymentEntry>();
    entries.forEach(e => {
      if (e.periodYear === activeYear) {
        const cleanM = e.periodMonth.trim();
        map.set(cleanM, e);
      }
    });
    return map;
  }, [entries, activeYear]);

  // Handle Quick Month Grid Change
  const handleQuickMonthAmountChange = (monthFullName: string, newAmtStr: string) => {
    const numAmt = parseFloat(newAmtStr) || 0;
    const existing = monthEntryMap.get(monthFullName);

    if (existing) {
      if (numAmt <= 0) {
        // If 0, delete this entry
        handleDeleteEntry(existing.tempId);
      } else {
        // Update existing entry
        setEntries(prev => prev.map(e => {
          if (e.tempId === existing.tempId) {
            return {
              ...e,
              amount: numAmt,
              periodMonth: monthFullName,
              periodYear: activeYear,
              periodLabel: `${monthFullName} ${activeYear}`
            };
          }
          return e;
        }));
      }
    } else if (numAmt > 0) {
      // Create new entry for this month
      const monthIdx = ALL_MONTH_NAMES_FULL.indexOf(monthFullName as any);
      const mTwoDigit = String(monthIdx + 1).padStart(2, '0');
      const newEntry: EditablePaymentEntry = {
        tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        amount: numAmt,
        dateStr: `${activeYear}-${mTwoDigit}-15`,
        periodMonth: monthFullName,
        periodYear: activeYear,
        periodType: 'monthly',
        periodLabel: `${monthFullName} ${activeYear}`,
        paymentMethod: 'online',
        subCategoryBreakdown: {},
        remark: '',
        campaignId: activeCampaignId || 'camp-default',
        campaignTitle: currentCampaign?.title || 'Collection',
      };
      setEntries(prev => [...prev, newEntry]);
    }
  };

  // Add a new blank transaction entry
  const handleAddEntry = () => {
    const today = new Date();
    // Find next month not yet filled
    let nextMonth = ALL_MONTH_NAMES_FULL[today.getMonth()];
    for (const m of ALL_MONTH_NAMES_FULL) {
      if (!monthEntryMap.has(m)) {
        nextMonth = m;
        break;
      }
    }

    const monthIdx = ALL_MONTH_NAMES_FULL.indexOf(nextMonth as any);
    const mTwoDigit = String(monthIdx + 1).padStart(2, '0');

    const newEntry: EditablePaymentEntry = {
      tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      amount: 500,
      dateStr: `${activeYear}-${mTwoDigit}-15`,
      periodMonth: nextMonth,
      periodYear: activeYear,
      periodType: 'monthly',
      periodLabel: `${nextMonth} ${activeYear}`,
      paymentMethod: 'online',
      subCategoryBreakdown: {},
      remark: '',
      campaignId: activeCampaignId || 'camp-default',
      campaignTitle: currentCampaign?.title || 'Collection',
    };

    setEntries(prev => [...prev, newEntry]);
  };

  // Delete a single transaction entry
  const handleDeleteEntry = (tempId: string) => {
    const target = entries.find(e => e.tempId === tempId);
    if (target?.originalId) {
      setDeletedIds(prev => [...prev, target.originalId!]);
    }
    setEntries(prev => prev.filter(e => e.tempId !== tempId));
  };

  // Update field of specific entry
  const handleUpdateEntryField = (tempId: string, field: keyof EditablePaymentEntry, val: any) => {
    setEntries(prev => prev.map(e => {
      if (e.tempId !== tempId) return e;
      const updated = { ...e, [field]: val };
      if (field === 'periodMonth' || field === 'periodYear') {
        updated.periodLabel = `${updated.periodMonth} ${updated.periodYear}`;
      }
      return updated;
    }));
  };

  // Update sub-category breakdown for an entry
  const handleSubCategoryChange = (tempId: string, catName: string, amtStr: string) => {
    const num = parseFloat(amtStr) || 0;
    setEntries(prev => prev.map(e => {
      if (e.tempId !== tempId) return e;
      const newBreakdown = { ...e.subCategoryBreakdown, [catName]: num };
      // Auto compute total if multiple subcategories
      const subTotal = Object.values(newBreakdown).reduce((s, v) => s + (Number(v) || 0), 0);
      return {
        ...e,
        subCategoryBreakdown: newBreakdown,
        amount: subTotal > 0 ? subTotal : e.amount
      };
    }));
  };

  // Save all changes
  const handleSaveAll = () => {
    if (!currentDonorName.trim()) {
      setStatusMessage('Khawngaihin hming (Donor Name) dah ngei a ngai!');
      return;
    }

    if (entries.length === 0 && deletedIds.length === 0) {
      onClose();
      return;
    }

    // Convert entries to real Transaction objects
    const finalTransactions: Transaction[] = entries.map(e => {
      let isoTimestamp = new Date().toISOString();
      if (e.dateStr) {
        try {
          const d = new Date(e.dateStr);
          if (!isNaN(d.getTime())) {
            isoTimestamp = d.toISOString();
          }
        } catch {}
      }

      return {
        id: e.originalId || `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        donorName: currentDonorName.trim(),
        donorPhone: currentPhone.trim() || undefined,
        donorVeng: currentSection.trim() || undefined,
        memberId: currentMemberId.trim() || undefined,
        amount: Number(e.amount) || 0,
        paymentMethod: e.paymentMethod,
        timestamp: isoTimestamp,
        periodType: e.periodType,
        periodMonth: e.periodMonth,
        periodYear: e.periodYear,
        periodLabel: e.periodLabel || `${e.periodMonth} ${e.periodYear}`,
        campaignId: e.campaignId || activeCampaignId,
        campaignTitle: e.campaignTitle || currentCampaign?.title || 'Collection',
        subCategoryBreakdown: Object.keys(e.subCategoryBreakdown).length > 0 ? e.subCategoryBreakdown : undefined,
        remark: e.remark.trim() || undefined,
        txHash: e.txHash || `RON-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        status: 'SUCCESS',
        isAnonymous: false,
      };
    });

    onSaveAll(finalTransactions, deletedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div 
        id="donor-payments-editor-modal"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Mimal / Donor Record & Payment Siamthatna
                </h2>
                {currentMemberId && (
                  <span className="text-xs bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 px-2 py-0.5 rounded-md font-mono">
                    ID: {currentMemberId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Pek zat (Amount), Thla (Month), Pek ni (Date), leh Category te duh angin thlak kual rawh le.
              </p>
            </div>
          </div>

          <button 
            id="close-donor-editor-btn"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content - Scrollable */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50 dark:bg-slate-900/50">
          
          {/* Status message */}
          {statusMessage && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Section 1: Donor Profile Details */}
          <div className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-500" />
              Donor / Member Profile Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Hming (Donor Name) *
                </label>
                <input 
                  type="text"
                  value={currentDonorName}
                  onChange={(e) => setCurrentDonorName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Rammuanpuia Ralte"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Member ID / Roll No.
                </label>
                <input 
                  type="text"
                  value={currentMemberId}
                  onChange={(e) => setCurrentMemberId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. M-001"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <input 
                  type="text"
                  value={currentPhone}
                  onChange={(e) => setCurrentPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. 9862500000"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Veng / Section / Bial
                </label>
                <input 
                  type="text"
                  value={currentSection}
                  onChange={(e) => setCurrentSection(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="e.g. Section A / Chanmari"
                />
              </div>
            </div>
          </div>

          {/* Section 2: 12-Month Quick Adjuster Grid (Thla Tin Pek Zat) */}
          <div className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2.5">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Thla Tin Pek Zat Quick Adjuster (12 Months Grid)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Thla tina a pek zat chhut luh / thlak kual nan a hnuaia box ah hian chhu lut rawh. (0 i dah chuan paih a ni ang)
                </p>
              </div>

              {/* Year Selector */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-[11px] font-bold text-slate-500">Kum:</span>
                {['2024', '2025', '2026', '2027', '2028'].map(yr => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setActiveYear(yr)}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                      activeYear === yr 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* 12 Months Fast Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-1">
              {ALL_MONTH_NAMES_FULL.map((monthName, mIdx) => {
                const shortM = ALL_MONTH_NAMES_SHORT[mIdx];
                const existingEntry = monthEntryMap.get(monthName);
                const isPaid = !!existingEntry && existingEntry.amount > 0;

                return (
                  <div 
                    key={monthName}
                    className={`p-2 rounded-xl border transition-all ${
                      isPaid 
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800/80 ring-1 ring-indigo-400/30' 
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-black uppercase ${
                        isPaid ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {shortM}
                      </span>
                      {isPaid && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Pek tawh" />
                      )}
                    </div>

                    <div className="relative flex items-center">
                      <span className="absolute left-2 text-xs font-bold text-slate-400">₹</span>
                      <input 
                        type="number"
                        min="0"
                        step="50"
                        value={existingEntry ? existingEntry.amount : ''}
                        placeholder="0"
                        onChange={(e) => handleQuickMonthAmountChange(monthName, e.target.value)}
                        className={`w-full pl-5 pr-1 py-1 text-xs font-black rounded-lg border outline-none text-right transition-all ${
                          isPaid 
                            ? 'bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500' 
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 focus:border-indigo-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Detailed Payment Entries List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Pek Zat & Pek Hun Kimchang ({entries.length} Payments)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Payment tin a date, category breakdown, mode (cash/online), leh note te edit rawh.
                </p>
              </div>

              <button
                type="button"
                id="add-payment-entry-btn"
                onClick={handleAddEntry}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Thla thar / Payment belh</span>
              </button>
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                <p className="text-sm font-medium">He donor tan hian payment entry a la awm lo.</p>
                <button
                  type="button"
                  onClick={handleAddEntry}
                  className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                >
                  + Entry thar siam rawh
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry, idx) => (
                  <div 
                    key={entry.tempId}
                    className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3 relative group transition-all hover:border-indigo-300 dark:hover:border-indigo-700"
                  >
                    {/* Entry Top Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-white">
                          {entry.periodLabel || 'Payment Entry'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          entry.paymentMethod === 'cash'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                        }`}>
                          {entry.paymentMethod === 'cash' ? '💵 CASH' : '⚡ ONLINE'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.tempId)}
                        className="text-slate-400 hover:text-rose-500 p-1 rounded-md transition-colors"
                        title="Paih (Delete this payment)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Main Row Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Amount */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Pek Zat (Amount ₹) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                          <input 
                            type="number"
                            min="0"
                            step="10"
                            value={entry.amount || ''}
                            onChange={(e) => handleUpdateEntryField(entry.tempId, 'amount', parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-2 text-sm font-black bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-indigo-950 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          Pek Ni (Date)
                        </label>
                        <input 
                          type="date"
                          value={entry.dateStr}
                          onChange={(e) => handleUpdateEntryField(entry.tempId, 'dateStr', e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>

                      {/* Month & Period */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Pek Thla (Month)
                        </label>
                        <select
                          value={entry.periodMonth}
                          onChange={(e) => handleUpdateEntryField(entry.tempId, 'periodMonth', e.target.value)}
                          className="w-full px-2.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          {ALL_MONTH_NAMES_FULL.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                          <option value="Q1 (Jan - Mar)">Q1 (Jan - Mar)</option>
                          <option value="Q2 (Apr - Jun)">Q2 (Apr - Jun)</option>
                          <option value="Q3 (Jul - Sep)">Q3 (Jul - Sep)</option>
                          <option value="Q4 (Oct - Dec)">Q4 (Oct - Dec)</option>
                          <option value="Yearly Full">Yearly Full</option>
                          <option value="One-Time">One-Time</option>
                        </select>
                      </div>

                      {/* Payment Mode */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          Payment Mode
                        </label>
                        <select
                          value={entry.paymentMethod}
                          onChange={(e) => handleUpdateEntryField(entry.tempId, 'paymentMethod', e.target.value as 'online' | 'cash')}
                          className="w-full px-2.5 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="online">⚡ Online (UPI / NetBanking)</option>
                          <option value="cash">💵 Cash Counter</option>
                        </select>
                      </div>
                    </div>

                    {/* Sub-Category Breakdowns (For Kumtluang or Multi-head campaigns) */}
                    {isKumtluang && subCategoriesList.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-900/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            Sub-Category Breakdown (Pathian Ram, Ramthim, etc.):
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Total: ₹{entry.amount}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                          {subCategoriesList.map(cat => (
                            <div key={cat} className="space-y-0.5">
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate block">
                                {cat}
                              </span>
                              <div className="relative">
                                <span className="absolute left-2 top-1.5 text-[10px] font-bold text-slate-400">₹</span>
                                <input 
                                  type="number"
                                  min="0"
                                  value={entry.subCategoryBreakdown[cat] || ''}
                                  placeholder="0"
                                  onChange={(e) => handleSubCategoryChange(entry.tempId, cat, e.target.value)}
                                  className="w-full pl-5 pr-1 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-slate-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Remark & Note */}
                    <div>
                      <input 
                        type="text"
                        value={entry.remark}
                        onChange={(e) => handleUpdateEntryField(entry.tempId, 'remark', e.target.value)}
                        placeholder="Remark / Note (Optional - e.g. Pu Kunga pekchhawng, etc.)"
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer / Actions Bar */}
        <div className="bg-white dark:bg-slate-900 px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Total Collection (Belhkhawm):
              </span>
              <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-slate-500 ml-2">
                ({entries.length} payments)
              </span>
            </div>

            {onDeleteAll && transactions.length > 0 && (
              <button
                type="button"
                id="delete-all-donor-txs-btn"
                onClick={() => {
                  if (window.confirm(`"${currentDonorName}" record leh transaction zawng zawng hi paih vek i duh tak tak em?`)) {
                    onDeleteAll();
                    onClose();
                  }
                }}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-bold border border-rose-200 dark:border-rose-900 transition-colors ml-2"
              >
                <Trash2 className="w-3.5 h-3.5 inline mr-1" />
                Paih Vek (Delete All)
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="cancel-donor-editor-btn"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
            >
              Cancel
            </button>

            <button
              type="button"
              id="save-all-donor-editor-btn"
              onClick={handleSaveAll}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Save Siamthatna Zawng Zawng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
