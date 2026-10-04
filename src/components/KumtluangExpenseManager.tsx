import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  X, 
  Check, 
  Calendar, 
  Tag, 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  FileSpreadsheet, 
  AlertCircle, 
  Image as ImageIcon, 
  Upload, 
  Lock, 
  ShieldAlert, 
  Sparkles, 
  ArrowUpDown, 
  UserCheck,
  Building2,
  FolderPlus,
  RefreshCw,
  Eye,
  Sliders,
  Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Campaign, CreatorProfile, ExpenseRecord, Transaction } from '../types';
import { 
  getStoredExpenses, 
  saveExpenseRecord, 
  deleteStoredExpense, 
  getCampaignExpenseHeads, 
  saveCampaignExpenseHeads,
  isConfirmedTransaction 
} from '../utils/storage';
import { canManageCampaignExpenses } from '../utils/rbac';
import { compressImageFile } from '../utils/imageCompressor';
import { formatDateDDMMYYYY } from '../utils/date';

interface KumtluangExpenseManagerProps {
  campaign: Campaign;
  creatorProfile: CreatorProfile;
  transactions?: Transaction[];
  onExpensesChanged?: () => void;
  onOpenImagePreview?: (url: string, title?: string, subtitle?: string) => void;
}

export const KumtluangExpenseManager: React.FC<KumtluangExpenseManagerProps> = ({
  campaign,
  creatorProfile,
  transactions = [],
  onExpensesChanged,
  onOpenImagePreview
}) => {
  // Authorization Check: Strict isolation with Officer PIN unlock fallback
  const [officerPinInput, setOfficerPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isUnlockedByPin, setIsUnlockedByPin] = useState<boolean>(false);

  const isAuthorized = isUnlockedByPin || canManageCampaignExpenses(campaign, creatorProfile, officerPinInput);

  const handleVerifyOfficerPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!officerPinInput.trim()) {
      setPinError('Khawngaihin PIN chhu lut rawh le.');
      return;
    }
    const verified = canManageCampaignExpenses(campaign, creatorProfile, officerPinInput.trim());
    if (verified) {
      setIsUnlockedByPin(true);
      setPinError(null);
    } else {
      setPinError('Officer Passcode / PIN a dik lo. Campaign Creator emaw Hruaitu dang zawt rawh le.');
    }
  };

  // Data States
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => getStoredExpenses(campaign?.id));
  const [heads, setHeads] = useState<string[]>(() => getCampaignExpenseHeads(campaign));

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHeadFilter, setSelectedHeadFilter] = useState<string>('all');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<'all' | 'this_month' | 'last_month'>('all');
  const [sortField, setSortField] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Modals & Forms
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState<boolean>(false);
  const [isManageHeadsModalOpen, setIsManageHeadsModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Expense Form State
  const [formHead, setFormHead] = useState<string>('');
  const [formAmount, setFormAmount] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [formPaidTo, setFormPaidTo] = useState<string>('');
  const [formPaidBy, setFormPaidBy] = useState<string>('Treasurer');
  const [formMethod, setFormMethod] = useState<'cash' | 'upi' | 'bank_transfer' | 'cheque'>('cash');
  const [formVoucherNo, setFormVoucherNo] = useState<string>('');
  const [formPurpose, setFormPurpose] = useState<string>('');
  const [formRemark, setFormRemark] = useState<string>('');
  const [formReceiptUrl, setFormReceiptUrl] = useState<string>('');
  const [isCompressingImage, setIsCompressingImage] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Head Creation State
  const [newHeadName, setNewHeadName] = useState<string>('');
  const [newHeadError, setNewHeadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state on campaign change
  useEffect(() => {
    if (campaign?.id) {
      setExpenses(getStoredExpenses(campaign.id));
      setHeads(getCampaignExpenseHeads(campaign));
    }
  }, [campaign?.id]);

  // Listen to cross-window or tab updates
  useEffect(() => {
    const handleUpdate = () => {
      if (campaign?.id) {
        setExpenses(getStoredExpenses(campaign.id));
      }
    };
    window.addEventListener('ronpay_expenses_updated', handleUpdate);
    return () => window.removeEventListener('ronpay_expenses_updated', handleUpdate);
  }, [campaign?.id]);

  // Auto-generate next voucher number
  const getNextVoucherNo = () => {
    const prefix = 'VOU';
    const campNum = (campaign?.orgCode || 'EXP').slice(0, 4).toUpperCase();
    const count = expenses.length + 1;
    return `${prefix}-${campNum}-${String(count).padStart(3, '0')}`;
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingExpense(null);
    setFormHead(heads[0] || 'Office & Stationery');
    setFormAmount('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormPaidTo('');
    setFormPaidBy(creatorProfile?.name ? `${creatorProfile.name} (Treasurer)` : 'Treasurer');
    setFormMethod('cash');
    setFormVoucherNo(getNextVoucherNo());
    setFormPurpose('');
    setFormRemark('');
    setFormReceiptUrl('');
    setFormError(null);
    setIsAddExpenseModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (exp: ExpenseRecord) => {
    setEditingExpense(exp);
    setFormHead(exp.head);
    setFormAmount(String(exp.amount));
    setFormDate(exp.date || new Date().toISOString().slice(0, 10));
    setFormPaidTo(exp.paidTo || '');
    setFormPaidBy(exp.paidBy || 'Treasurer');
    setFormMethod((exp.paymentMethod as any) || 'cash');
    setFormVoucherNo(exp.voucherNo || '');
    setFormPurpose(exp.purpose || '');
    setFormRemark(exp.remark || '');
    setFormReceiptUrl(exp.receiptUrl || '');
    setFormError(null);
    setIsAddExpenseModalOpen(true);
  };

  // Handle Receipt Image Upload & Compression
  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingImage(true);
      const compressedBase64 = await compressImageFile(file, 900, 0.75);
      setFormReceiptUrl(compressedBase64);
    } catch (err) {
      console.error('Image compression failed:', err);
      setFormError('Receipt thlalak upload a hlawhchham. Thlalak zangkhai deuh hman tum rawh.');
    } finally {
      setIsCompressingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Save Expense (Create or Update)
  const handleSaveExpense = () => {
    const amt = parseFloat(formAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Khawngaihin amount dik tak chhu lut rawh (₹ 1 aia tam).');
      return;
    }
    if (!formHead.trim()) {
      setFormError('Khawngaihin Expense Head thlang rawh.');
      return;
    }
    if (!formPaidTo.trim()) {
      setFormError('Khawngaihin sum dawn tute (Paid To / Hnenah) hming chhu lut rawh.');
      return;
    }

    const newRecord: ExpenseRecord = {
      id: editingExpense?.id || `EXP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      head: formHead.trim(),
      amount: amt,
      date: formDate,
      paidTo: formPaidTo.trim(),
      paidBy: formPaidBy.trim(),
      paymentMethod: formMethod,
      voucherNo: formVoucherNo.trim() || undefined,
      purpose: formPurpose.trim() || undefined,
      remark: formRemark.trim() || undefined,
      receiptUrl: formReceiptUrl || undefined,
      createdAt: editingExpense?.createdAt || new Date().toISOString(),
      createdBy: editingExpense?.createdBy || creatorProfile?.phone || creatorProfile?.name || 'Authorized Officer',
      updatedAt: new Date().toISOString(),
      updatedBy: creatorProfile?.name || 'Officer'
    };

    saveExpenseRecord(newRecord);
    setExpenses(getStoredExpenses(campaign.id));
    setIsAddExpenseModalOpen(false);
    onExpensesChanged?.();
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    deleteStoredExpense(id);
    setExpenses(getStoredExpenses(campaign.id));
    setDeleteConfirmId(null);
    onExpensesChanged?.();
  };

  // Add New Head to Campaign
  const handleAddNewHead = () => {
    const clean = newHeadName.trim();
    if (!clean) {
      setNewHeadError('Head hming ziah a ngai e.');
      return;
    }
    if (heads.some(h => h.toLowerCase() === clean.toLowerCase())) {
      setNewHeadError('He Head hi a awm sa tawh e.');
      return;
    }

    const updated = [...heads, clean];
    setHeads(updated);
    saveCampaignExpenseHeads(campaign.id, updated);
    setNewHeadName('');
    setNewHeadError(null);
  };

  // Delete Custom Head
  const handleDeleteHead = (headToDelete: string) => {
    const updated = heads.filter(h => h !== headToDelete);
    setHeads(updated);
    saveCampaignExpenseHeads(campaign.id, updated);
  };

  // Financial Calculations
  const totalIncome = useMemo(() => {
    return transactions
      .filter(t => t.campaignId === campaign.id && isConfirmedTransaction(t))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
  }, [transactions, campaign.id]);

  const totalExpense = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const netBalance = totalIncome - totalExpense;

  // Head-wise Expense Breakdown
  const headBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const exp of expenses) {
      const h = exp.head || 'Miscellaneous';
      const cur = map.get(h) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total += exp.amount;
      map.set(h, cur);
    }
    return Array.from(map.entries())
      .map(([head, data]) => ({
        head,
        count: data.count,
        total: data.total,
        percentage: totalExpense > 0 ? (data.total / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [expenses, totalExpense]);

  // Filtered & Sorted Expenses
  const filteredExpenses = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

    return expenses.filter(e => {
      // Head Filter
      if (selectedHeadFilter !== 'all' && e.head !== selectedHeadFilter) return false;

      // Period Filter
      if (selectedPeriodFilter === 'this_month') {
        if (!e.date || !e.date.startsWith(currentMonthStr)) return false;
      } else if (selectedPeriodFilter === 'last_month') {
        if (!e.date || !e.date.startsWith(lastMonthStr)) return false;
      }

      // Search Query
      if (query) {
        const matchPaidTo = e.paidTo?.toLowerCase().includes(query);
        const matchPurpose = e.purpose?.toLowerCase().includes(query);
        const matchVoucher = e.voucherNo?.toLowerCase().includes(query);
        const matchHead = e.head?.toLowerCase().includes(query);
        const matchRemark = e.remark?.toLowerCase().includes(query);
        if (!matchPaidTo && !matchPurpose && !matchVoucher && !matchHead && !matchRemark) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortField === 'amount') {
        return sortDirection === 'desc' ? b.amount - a.amount : a.amount - b.amount;
      }
      const timeA = new Date(a.date || a.createdAt).getTime();
      const timeB = new Date(b.date || b.createdAt).getTime();
      return sortDirection === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [expenses, selectedHeadFilter, selectedPeriodFilter, searchQuery, sortField, sortDirection]);

  // Export to Excel
  const handleExportExcel = () => {
    if (expenses.length === 0) return;
    const rows = filteredExpenses.map((e, idx) => ({
      'Sl. No.': idx + 1,
      'Tarikh (Date)': formatDateDDMMYYYY(e.date),
      'Voucher / Bill No.': e.voucherNo || '-',
      'Head (Hmanna Category)': e.head,
      'Hnenah (Paid To)': e.paidTo,
      'Chhan (Purpose)': e.purpose || '-',
      'Method': (e.paymentMethod || 'cash').toUpperCase(),
      'Pawisa (Amount ₹)': e.amount,
      'Paid By': e.paidBy || '-',
      'Notes': e.remark || '-'
    }));

    // Add Summary Row
    rows.push({
      'Sl. No.': '' as any,
      'Tarikh (Date)': 'TOTAL EXPENDITURE',
      'Voucher / Bill No.': '',
      'Head (Hmanna Category)': '',
      'Hnenah (Paid To)': '',
      'Chhan (Purpose)': '',
      'Method': '',
      'Pawisa (Amount ₹)': totalExpense,
      'Paid By': '',
      'Notes': `Net Fund Balance: ₹${netBalance.toLocaleString()}`
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenditure_Ledger');
    const safeOrg = (campaign.orgCode || campaign.title || 'NGO').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(workbook, `RonPay_Expenses_${safeOrg}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Print Statement
  const handlePrintStatement = () => {
    window.print();
  };

  // Unauthorized Barrier
  if (!isAuthorized) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-300 max-w-lg mx-auto my-6 shadow-xl">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Phalna Pek Chin Chauh Tan</h3>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          He Kumtluang Bawm pawisa hman chhuahna (expenditure records) hi he Bawm Creator leh Pawl hruaitu (Authorized Officers) te chauhvin an khawih theiin an hmu thei e.
        </p>
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 text-left space-y-1 mb-5">
          <div className="font-semibold text-slate-300 mb-1">Bawm Hming: {campaign?.title}</div>
          <div>Bawm Siamtu: {campaign?.creatorName || campaign?.createdBy || 'Creator'}</div>
          <div>I role: {creatorProfile?.role || 'Guest / Member'}</div>
        </div>

        {/* Officer PIN Unlock Form */}
        <div className="bg-slate-950 border border-indigo-900/60 rounded-xl p-4 text-left space-y-3">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Pawl Hruaitu / Officer PIN Nei I Nih Chuan:</span>
          </div>
          <form onSubmit={handleVerifyOfficerPin} className="space-y-2">
            <div className="relative">
              <input
                type="password"
                value={officerPinInput}
                onChange={(e) => {
                  setOfficerPinInput(e.target.value);
                  setPinError(null);
                }}
                placeholder="Chhu lut rawh (Officer Passcode)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {pinError && (
              <p className="text-[11px] text-rose-400 font-medium">{pinError}</p>
            )}
            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Hawng Rawh (Unlock Expenses)
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-900/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Receipt className="w-3.5 h-3.5" />
                PAWISA HMAN CHHUAHNA
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {campaign.title} ({campaign.orgCode || 'NGO'})
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Expenditure & Cash Vouchers
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Pawl sum hman chhuahna fel taka record-na leh head-wise hmanral enfiahna.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsManageHeadsModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors shadow-sm"
              title="Expense Heads Siamna & Enkawnna"
            >
              <FolderPlus className="w-4 h-4 text-indigo-400" />
              <span>Head Enkawlna</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Record Thar Siam</span>
            </button>
          </div>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Income */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Sum Lakluh (Income)</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 tracking-tight">
            ₹{totalIncome.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Confirmed thawhlawm lakluh
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Hman Chhuah (Expense)</span>
            <div className="w-6 h-6 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 tracking-tight">
            ₹{totalExpense.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {expenses.length} vouchers recorded
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Sum Baki (Net Balance)</span>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${netBalance >= 0 ? 'bg-indigo-500/10 text-indigo-400' : 'bg-red-500/10 text-red-400'}`}>
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-black tracking-tight ${netBalance >= 0 ? 'text-indigo-300' : 'text-red-400'}`}>
            ₹{netBalance.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {netBalance >= 0 ? 'Tun dinhmun fund la awm' : 'Sum lakluh aia hmanral tam'}
          </div>
        </div>

        {/* Expense Heads Count */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5 font-medium">
            <span>Heads Awm Zat</span>
            <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Tag className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 tracking-tight">
            {heads.length} Heads
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Pawlin a siam chawp theih
          </div>
        </div>
      </div>

      {/* Head-wise Expense Allocation Card */}
      {headBreakdown.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Tag className="w-4 h-4 text-orange-400" />
              <span>Head-wise Hman Chhuah Semzai (Breakdown)</span>
            </h3>
            <span className="text-xs text-slate-400">
              Total: ₹{totalExpense.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {headBreakdown.map((item) => (
              <div 
                key={item.head}
                onClick={() => setSelectedHeadFilter(selectedHeadFilter === item.head ? 'all' : item.head)}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  selectedHeadFilter === item.head 
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-200 ring-1 ring-orange-500/40' 
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold truncate max-w-[150px]">{item.head}</span>
                  <span className="font-mono font-bold text-rose-300">₹{item.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-1">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-rose-500 h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.max(4, item.percentage))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>{item.count} bills</span>
                  <span>{item.percentage.toFixed(1)}% of total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search paid to, voucher no, purpose..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Head Filter */}
          <select
            value={selectedHeadFilter}
            onChange={(e) => setSelectedHeadFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-orange-500/60 max-w-[150px] truncate"
          >
            <option value="all">Head zawng zawng</option>
            {heads.map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          {/* Period Filter */}
          <select
            value={selectedPeriodFilter}
            onChange={(e) => setSelectedPeriodFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-orange-500/60"
          >
            <option value="all">Hun zawng zawng</option>
            <option value="this_month">Tun thla</option>
            <option value="last_month">Thla hmasa</option>
          </select>
        </div>

        {/* Actions & Export */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={() => {
              if (sortField === 'date') {
                setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
              } else {
                setSortField('date');
                setSortDirection('desc');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
            title="Sort by date"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Tarikh</span>
            <ArrowUpDown className="w-3 h-3 text-slate-400" />
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredExpenses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={handlePrintStatement}
            disabled={filteredExpenses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Expenses Table / Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
              <Receipt className="w-6 h-6" />
            </div>
            <div className="text-base font-bold text-white">Pawisa hman chhuahna record a la awm lo</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              He bawm aṭanga pawisa hman chhuah reng reng fel takin a hnuaia button hmet hian i record thei e.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Record Thar Siam</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Tarikh & Voucher</th>
                  <th className="py-3 px-4">Head & Purpose</th>
                  <th className="py-3 px-4">Paid To / Hnenah</th>
                  <th className="py-3 px-4">Method & Paid By</th>
                  <th className="py-3 px-4 text-right">Amount (₹)</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Date & Voucher */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-slate-200">
                        {formatDateDDMMYYYY(exp.date)}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        {exp.voucherNo || exp.id}
                      </div>
                    </td>

                    {/* Head & Purpose */}
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-300 border border-orange-500/20 mb-1">
                        {exp.head}
                      </span>
                      <div className="text-slate-300 font-medium line-clamp-1 max-w-xs">
                        {exp.purpose || exp.remark || '-'}
                      </div>
                    </td>

                    {/* Paid To */}
                    <td className="py-3 px-4 font-semibold text-white whitespace-nowrap">
                      {exp.paidTo}
                    </td>

                    {/* Method & Disbursed By */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {exp.paymentMethod || 'cash'}
                      </span>
                      {exp.paidBy && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          By: {exp.paidBy}
                        </div>
                      )}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <span className="font-black text-rose-400 font-mono text-sm">
                        ₹{exp.amount.toLocaleString()}
                      </span>
                    </td>

                    {/* Receipt thumbnail */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {exp.receiptUrl ? (
                        <button
                          onClick={() => {
                            if (onOpenImagePreview) {
                              onOpenImagePreview(exp.receiptUrl!, `Receipt - ${exp.voucherNo || exp.paidTo}`, `Amount: ₹${exp.amount}`);
                            } else {
                              setPreviewReceiptUrl(exp.receiptUrl!);
                            }
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 transition-colors"
                          title="En rawh (View Receipt)"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(exp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="Edit Expense"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmId(exp.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white">He Hman Chhuahna hi paih i duh tak tak em?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Paih a nih chuan he voucher record hi a bo hlen tawh ang a, audit log-ah a chhinchhiah bawk ang.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Sut leh rawh (Cancel)
              </button>
              <button
                onClick={() => handleDeleteExpense(deleteConfirmId)}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md"
              >
                Paih rawh (Delete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-400" />
                  <span>{editingExpense ? 'Pawisa Hman Chhuahna Siamthat' : 'Pawisa Hman Chhuahna Thar Record'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{campaign.title}</p>
              </div>
              <button
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              {/* Head & Quick Add */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-300">Expense Head / Category *</label>
                  <button
                    type="button"
                    onClick={() => setIsManageHeadsModalOpen(true)}
                    className="text-[11px] text-orange-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Head thar siam</span>
                  </button>
                </div>
                <select
                  value={formHead}
                  onChange={(e) => setFormHead(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60"
                >
                  {heads.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Amount (₹) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₹</span>
                    <input
                      type="number"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="e.g. 1500"
                      min="1"
                      className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-sm focus:outline-none focus:border-orange-500/60"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-300">Tarikh (Date) *</label>
                    <button
                      type="button"
                      onClick={() => setFormDate(new Date().toISOString().slice(0, 10))}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Vawiin
                    </button>
                  </div>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60"
                  />
                </div>
              </div>

              {/* Paid To & Paid By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Hnenah (Paid To) *</label>
                  <input
                    type="text"
                    value={formPaidTo}
                    onChange={(e) => setFormPaidTo(e.target.value)}
                    placeholder="e.g. Zorun Stationery / Pu Liana"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Paid By / Sanctioned By</label>
                  <input
                    type="text"
                    value={formPaidBy}
                    onChange={(e) => setFormPaidBy(e.target.value)}
                    placeholder="e.g. Treasurer / Secretary"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60"
                  />
                </div>
              </div>

              {/* Voucher No & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Voucher / Bill No.</label>
                  <input
                    type="text"
                    value={formVoucherNo}
                    onChange={(e) => setFormVoucherNo(e.target.value)}
                    placeholder="e.g. VOU-BMP-001"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-orange-500/60"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Payment Method</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60"
                  >
                    <option value="cash">Cash (Kut ngei)</option>
                    <option value="upi">UPI / Online</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Purpose / Hmanna chhan */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Hmanna Chhan (Purpose)</label>
                <input
                  type="text"
                  value={formPurpose}
                  onChange={(e) => setFormPurpose(e.target.value)}
                  placeholder="e.g. Executive Committee meeting thingpui & chhang"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60"
                />
              </div>

              {/* Receipt Image / Bill Photo */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Bill / Receipt Thlalak (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleReceiptUpload}
                  className="hidden"
                />

                {formReceiptUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-slate-950 border border-slate-800 rounded-xl">
                    <img 
                      src={formReceiptUrl} 
                      alt="Receipt Thumbnail" 
                      className="w-12 h-12 object-cover rounded-lg border border-slate-700" 
                    />
                    <div className="flex-1 truncate text-xs text-slate-300">
                      Receipt thlalak vuah fel a ni e
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormReceiptUrl('')}
                      className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isCompressingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2.5 px-3 border border-dashed border-slate-700 hover:border-orange-500/60 rounded-xl text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isCompressingImage ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-orange-400" />
                        <span>Thlalak compress mek a ni...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 text-slate-400" />
                        <span>Bill / Cash Memo thlalak thlang rawh (Camera / Gallery)</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Remark */}
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Remarks / Hriattirna Dang (Optional)</label>
                <textarea
                  value={formRemark}
                  onChange={(e) => setFormRemark(e.target.value)}
                  placeholder="Hriattirna tul dangte..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-orange-500/60 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExpense}
                className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{editingExpense ? 'Siamṭhat Vawng rawh' : 'Record Fel Rawh'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Expense Heads Modal */}
      {isManageHeadsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-orange-400" />
                  <span>Expense Heads Enkawlna</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pawlin a mamawh anga Head thar siam leh paih theihna.
                </p>
              </div>
              <button
                onClick={() => setIsManageHeadsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add New Head Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">Head Thar Hming</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newHeadName}
                  onChange={(e) => {
                    setNewHeadName(e.target.value);
                    setNewHeadError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewHead();
                    }
                  }}
                  placeholder="e.g. Jersey & Sports, Inkhawmpui Ruai..."
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
                />
                <button
                  type="button"
                  onClick={handleAddNewHead}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs shrink-0 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {newHeadError && (
                <div className="text-[11px] text-rose-400">{newHeadError}</div>
              )}
            </div>

            {/* Existing Heads List */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Active Heads ({heads.length})
              </label>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {heads.map((head) => (
                  <div
                    key={head}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  >
                    <span className="font-medium truncate">{head}</span>
                    {heads.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteHead(head)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Paih rawh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManageHeadsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs"
              >
                Kharna (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Preview Modal (Fallback if global preview not provided) */}
      {previewReceiptUrl && !onOpenImagePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute -top-10 right-0 p-2 text-white bg-slate-800/80 hover:bg-slate-700 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Receipt Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  );
};
