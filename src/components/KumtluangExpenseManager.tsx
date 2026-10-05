import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Receipt, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  Printer, 
  Calendar, 
  CreditCard, 
  User, 
  Building2, 
  Tag, 
  DollarSign, 
  TrendingDown, 
  TrendingUp, 
  Scale, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Download, 
  Users, 
  Sparkles, 
  ArrowRight,
  Eye,
  FileText,
  Lock,
  Unlock,
  Check
} from 'lucide-react';
import { Campaign, CreatorProfile, KumtluangExpense, Transaction } from '../types';
import { 
  getStoredExpenses, 
  saveStoredExpenses, 
  saveExpense, 
  deleteStoredExpense,
  getCampaignExpenseHeads,
  saveCampaignExpenseHeads,
  DEFAULT_KUMTLUANG_EXPENSE_HEADS,
  isConfirmedTransaction,
  isTransactionForCampaign
} from '../utils/storage';
import { formatDateDDMMYYYY, getTodayDateTimeLocal } from '../utils/date';
import { compressDataUrl } from '../utils/imageCompressor';

interface KumtluangExpenseManagerProps {
  campaign: Campaign;
  creatorProfile?: CreatorProfile | null;
  transactions: Transaction[];
  onClose?: () => void;
  onUpdateCampaign?: (camp: Campaign) => void;
  language?: 'mizo' | 'english';
}

export const KumtluangExpenseManager: React.FC<KumtluangExpenseManagerProps> = ({
  campaign,
  creatorProfile,
  transactions,
  onClose,
  onUpdateCampaign,
  language = 'mizo'
}) => {
  // Active sub-tab inside Expenses module
  const [subTab, setSubTab] = useState<'vouchers' | 'record_expense' | 'manage_heads' | 'manage_officers' | 'statement'>('vouchers');

  // Expenses data state
  const [expenseList, setExpenseList] = useState<KumtluangExpense[]>(() => {
    return getStoredExpenses(campaign.id);
  });

  // Expense Heads state
  const [expenseHeads, setExpenseHeads] = useState<string[]>(() => {
    return getCampaignExpenseHeads(campaign.id, campaign.expenseHeads);
  });
  const [newHeadInput, setNewHeadInput] = useState<string>('');
  const [headNotice, setHeadNotice] = useState<string>('');

  // Filters & search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHeadFilter, setSelectedHeadFilter] = useState<string>('all');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('all');

  // Form states for Recording New Expense
  const [amountInput, setAmountInput] = useState<string>('');
  const [selectedHead, setSelectedHead] = useState<string>(expenseHeads[0] || DEFAULT_KUMTLUANG_EXPENSE_HEADS[0]);
  const [purposeInput, setPurposeInput] = useState<string>('');
  const [paidToInput, setPaidToInput] = useState<string>('');
  const [paymentModeInput, setPaymentModeInput] = useState<string>('Cash');
  const [voucherNoInput, setVoucherNoInput] = useState<string>(() => {
    const yr = new Date().getFullYear();
    const count = expenseList.length + 1;
    return `VCH-${yr}-${String(count).padStart(3, '0')}`;
  });
  const [referenceNoInput, setReferenceNoInput] = useState<string>('');
  const [spentDateInput, setSpentDateInput] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authorized Officers management state
  const [officerName, setOfficerName] = useState<string>('');
  const [officerPhone, setOfficerPhone] = useState<string>('');
  const [officerRole, setOfficerRole] = useState<string>('Finance Secretary');
  const [officerNotice, setOfficerNotice] = useState<string>('');

  // View Receipt attachment modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);

  // Listen for storage updates
  useEffect(() => {
    const handleUpdated = (e: any) => {
      const fresh = getStoredExpenses(campaign.id);
      setExpenseList(fresh);
    };
    window.addEventListener('ronpay_expenses_updated', handleUpdated);
    return () => window.removeEventListener('ronpay_expenses_updated', handleUpdated);
  }, [campaign.id]);

  // Check Permissions:
  // Creator / Super Admin / Admin OR Assigned Authorized Officer with canRecordExpenses
  const permissionStatus = useMemo(() => {
    if (!creatorProfile) {
      return { allowed: false, reason: 'Log in hmasa rawh le.', roleName: 'Guest' };
    }

    // 1. Super Admin or Admin
    if (creatorProfile.isAdmin === true || creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN') {
      return { allowed: true, reason: 'Platform Administrator clearance', roleName: 'System Administrator' };
    }

    // 2. Strict Campaign Owner / Creator
    const userPhone = (creatorProfile.phone || '').trim().replace(/\D/g, '').slice(-10);
    const campCreatedByDigits = (campaign.createdBy || '').trim().replace(/\D/g, '').slice(-10);
    const campCreatorPhone = ((campaign as any).creatorPhone || (campaign as any).contactPhone || '').trim().replace(/\D/g, '').slice(-10);

    const isOwnerByPhone = Boolean(
      userPhone && userPhone.length >= 8 &&
      (userPhone === campCreatedByDigits || userPhone === campCreatorPhone || campaign.createdBy === creatorProfile.phone)
    );

    const userName = (creatorProfile.name || '').trim().toLowerCase();
    const isOwnerByName = Boolean(
      userName && userName.length >= 3 &&
      ((campaign.createdBy && campaign.createdBy.toLowerCase() === userName) ||
       (campaign.creatorName && campaign.creatorName.toLowerCase() === userName))
    );

    if (isOwnerByPhone || isOwnerByName) {
      return { allowed: true, reason: 'Campaign Owner / Creator', roleName: 'Campaign Creator' };
    }

    // 3. Authorized Officers check
    if (campaign.authorizedOfficers && Array.isArray(campaign.authorizedOfficers)) {
      const officer = campaign.authorizedOfficers.find(off => {
        const offPhone = (off.phone || '').trim().replace(/\D/g, '').slice(-10);
        const offName = (off.name || '').trim().toLowerCase();
        return (userPhone && offPhone && offPhone === userPhone) || (userName && offName && offName === userName);
      });

      if (officer) {
        if (officer.canRecordExpenses !== false) {
          return { allowed: true, reason: `Phalna nei: ${officer.role || 'Officer'}`, roleName: officer.role || 'Authorized Officer' };
        } else {
          return { allowed: false, reason: 'Expense record phalna pek i ni rih lo.', roleName: officer.role || 'Officer' };
        }
      }
    }

    return {
      allowed: false,
      reason: 'He Bawm-a Pawisa hmanna record lut tur hian Campaign Creator emaw Creator-in phalna a pek (Authorized Officer) chauhvin an lut thei a ni.',
      roleName: 'Viewer (Read-Only)'
    };
  }, [campaign, creatorProfile]);

  // Financial Calculations (Matching Reports authoritative collection figures)
  const totalCollections = useMemo(() => {
    return transactions
      .filter(t => t && isTransactionForCampaign(t, campaign) && isConfirmedTransaction(t))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [transactions, campaign]);

  const totalExpenses = useMemo(() => {
    return expenseList.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenseList]);

  const netBalance = totalCollections - totalExpenses;

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenseList.filter(exp => {
      // Head filter
      if (selectedHeadFilter !== 'all' && exp.head !== selectedHeadFilter) return false;
      // Mode filter
      if (selectedModeFilter !== 'all' && exp.paymentMode !== selectedModeFilter) return false;
      // Year filter
      if (selectedYearFilter !== 'all') {
        const yr = exp.spentDate ? exp.spentDate.slice(0, 4) : '';
        if (yr !== selectedYearFilter) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPurpose = (exp.purpose || '').toLowerCase().includes(q);
        const matchPayee = (exp.paidTo || '').toLowerCase().includes(q);
        const matchVoucher = (exp.voucherNo || '').toLowerCase().includes(q);
        const matchHead = (exp.head || '').toLowerCase().includes(q);
        const matchRecorder = (exp.recordedBy || '').toLowerCase().includes(q);
        return matchPurpose || matchPayee || matchVoucher || matchHead || matchRecorder;
      }
      return true;
    });
  }, [expenseList, selectedHeadFilter, selectedModeFilter, selectedYearFilter, searchQuery]);

  // Handle Receipt Image Selection
  const handleReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawUrl = reader.result as string;
        try {
          const compressed = await compressDataUrl(rawUrl, 800, 0.7);
          setReceiptImage(compressed);
        } catch {
          setReceiptImage(rawUrl);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to read receipt image', err);
    }
  };

  // Submit New Expense
  const handleRecordExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!permissionStatus.allowed) {
      setFormError(permissionStatus.reason || 'Recording permission required.');
      return;
    }

    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Khawngaihin amount dik chhu lut rawh (e.g. 500).');
      return;
    }

    if (!purposeInput.trim()) {
      setFormError('Thil hmanna (Purpose / Particulars) ziah lan a ngai e.');
      return;
    }

    if (!paidToInput.trim()) {
      setFormError('Tu hnenah nge pek (Paid To / Payee) ziah a ngai e.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newExpense: KumtluangExpense = {
        id: `EXP-${Date.now()}`,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        amount: amt,
        head: selectedHead || 'Thil Dang / Miscellaneous',
        purpose: purposeInput.trim(),
        paidTo: paidToInput.trim(),
        paymentMode: paymentModeInput,
        voucherNo: voucherNoInput.trim() || `VCH-${new Date().getFullYear()}-${String(expenseList.length + 1).padStart(3, '0')}`,
        referenceNo: referenceNoInput.trim() || undefined,
        attachmentUrl: receiptImage || undefined,
        spentDate: spentDateInput || new Date().toISOString().split('T')[0],
        recordedBy: creatorProfile?.name || 'Authorized Officer',
        recordedByPhone: creatorProfile?.phone || undefined,
        recordedAt: new Date().toISOString(),
        status: 'approved'
      };

      saveExpense(newExpense);
      setExpenseList(prev => [newExpense, ...prev]);

      setFormSuccess(`₹${amt.toLocaleString('en-IN')} hmanna chu fel takin record a ni ta e!`);
      setAmountInput('');
      setPurposeInput('');
      setPaidToInput('');
      setReceiptImage('');
      setReferenceNoInput('');

      // Auto generate next voucher #
      const yr = new Date().getFullYear();
      setVoucherNoInput(`VCH-${yr}-${String(expenseList.length + 2).padStart(3, '0')}`);

      setTimeout(() => {
        setSubTab('vouchers');
      }, 900);
    } catch (err: any) {
      setFormError(err?.message || 'Expense save a hlawhtling lo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = (id: string) => {
    if (!permissionStatus.allowed) {
      alert('Paih turin permission i nei lo.');
      return;
    }
    if (confirm('He expense voucher hi paih (delete) i chiang chiah em?')) {
      deleteStoredExpense(id);
      setExpenseList(prev => prev.filter(e => e.id !== id));
    }
  };

  // Add Custom Expense Head
  const handleAddCustomHead = () => {
    setHeadNotice('');
    const trimmed = newHeadInput.trim();
    if (!trimmed) return;

    if (expenseHeads.map(h => h.toLowerCase()).includes(trimmed.toLowerCase())) {
      setHeadNotice('He Head hi a awm sa tawh e.');
      return;
    }

    const updated = [...expenseHeads, trimmed];
    setExpenseHeads(updated);
    saveCampaignExpenseHeads(campaign.id, updated);
    setSelectedHead(trimmed);
    setNewHeadInput('');
    setHeadNotice(`Head thar "${trimmed}" siam fel a ni e!`);
  };

  // Remove Custom Expense Head
  const handleRemoveHead = (headToRemove: string) => {
    if (DEFAULT_KUMTLUANG_EXPENSE_HEADS.includes(headToRemove)) {
      alert('Default system head hi paih theih a ni lo.');
      return;
    }
    const updated = expenseHeads.filter(h => h !== headToRemove);
    setExpenseHeads(updated);
    saveCampaignExpenseHeads(campaign.id, updated);
    if (selectedHead === headToRemove) {
      setSelectedHead(updated[0] || DEFAULT_KUMTLUANG_EXPENSE_HEADS[0]);
    }
  };

  // Add Authorized Officer
  const handleAddOfficer = () => {
    setOfficerNotice('');
    if (!officerName.trim() || !officerPhone.trim()) {
      setOfficerNotice('Hming leh Phone number chhu lut rawh le.');
      return;
    }

    const newOfficer = {
      name: officerName.trim(),
      phone: officerPhone.trim().replace(/\D/g, '').slice(-10),
      role: officerRole.trim(),
      canRecordExpenses: true,
      canManageMembers: true
    };

    const existing = campaign.authorizedOfficers || [];
    const updatedOfficers = [...existing.filter(o => o.phone !== newOfficer.phone), newOfficer];

    const updatedCamp: Campaign = {
      ...campaign,
      authorizedOfficers: updatedOfficers
    };

    if (onUpdateCampaign) {
      onUpdateCampaign(updatedCamp);
    }

    setOfficerNotice(`${newOfficer.name} hi Authorized Officer-ah dah fel a ni e!`);
    setOfficerName('');
    setOfficerPhone('');
  };

  // Remove Authorized Officer
  const handleRemoveOfficer = (phone: string) => {
    const existing = campaign.authorizedOfficers || [];
    const updatedOfficers = existing.filter(o => o.phone !== phone);
    const updatedCamp: Campaign = {
      ...campaign,
      authorizedOfficers: updatedOfficers
    };
    if (onUpdateCampaign) {
      onUpdateCampaign(updatedCamp);
    }
  };

  return (
    <div className="space-y-4 text-xs font-sans pb-10">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-3xl shadow-md border border-indigo-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-indigo-600/40 border border-indigo-400/30 text-indigo-300">
              <Receipt className="w-4 h-4" />
            </span>
            <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              Pawisa Hman Chhuahna (NGO & Church Expenditure Desk)
            </h2>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Kumtluang Ledger
            </span>
          </div>
          <p className="text-slate-300 text-xs">
            {campaign.title} • Sum lakluh, hman chhuah, leh balance sheet vawn felna.
          </p>
        </div>

        {/* Role & Access Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold ${
            permissionStatus.allowed 
              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' 
              : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
          }`}>
            {permissionStatus.allowed ? <ShieldCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{permissionStatus.roleName}</span>
          </div>
        </div>
      </div>

      {/* 3-Card Financial Overview (Inflow vs Outflow vs Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Total Inflow / Collections */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Pawisa Lakluh (Inflow)
            </span>
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Donations & Roll
            </span>
          </div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            ₹{totalCollections.toLocaleString('en-IN')}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium">
            Member thla tin thawh leh QR donation zawng zawng
          </p>
        </div>

        {/* Card 2: Total Outflow / Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" /> Hman Chhuah (Outflow)
            </span>
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
              {expenseList.length} Vouchers
            </span>
          </div>
          <div className="text-xl font-black text-rose-600 tracking-tight">
            -₹{totalExpenses.toLocaleString('en-IN')}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium">
            Office, relief, programme & refreshment hmanna
          </p>
        </div>

        {/* Card 3: Net Available Balance in Hand */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-600" /> Sum La Awm (Net Balance)
            </span>
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
              netBalance >= 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {netBalance >= 0 ? 'Surplus' : 'Deficit'}
            </span>
          </div>
          <div className={`text-xl font-black tracking-tight ${netBalance >= 0 ? 'text-indigo-900' : 'text-rose-700'}`}>
            ₹{netBalance.toLocaleString('en-IN')}
          </div>
          <p className="text-[10.5px] text-slate-400 font-medium">
            Bawm sum / Bank balance la kawl lai
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSubTab('vouchers')}
          className={`px-3 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            subTab === 'vouchers'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Vouchers List ({expenseList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('record_expense')}
          className={`px-3 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            subTab === 'record_expense'
              ? 'bg-rose-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Hmanna Thar Record (+ Add)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('manage_heads')}
          className={`px-3 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            subTab === 'manage_heads'
              ? 'bg-purple-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          <span>Expense Heads ({expenseHeads.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('manage_officers')}
          className={`px-3 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            subTab === 'manage_officers'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Authorized Officers (Record Thei Tur)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('statement')}
          className={`px-3 py-2 rounded-xl font-black text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
            subTab === 'statement'
              ? 'bg-emerald-600 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Voucher Statement (Print)</span>
        </button>
      </div>

      {/* SUB-TAB 1: VOUCHERS LIST */}
      {subTab === 'vouchers' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Search & Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row gap-2 items-center justify-between">
            {/* Search Box */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search purpose, payee, voucher no..."
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

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto no-scrollbar">
              {/* Head Filter */}
              <select
                value={selectedHeadFilter}
                onChange={(e) => setSelectedHeadFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Heads Zawng Zawng</option>
                {expenseHeads.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>

              {/* Payment Mode Filter */}
              <select
                value={selectedModeFilter}
                onChange={(e) => setSelectedModeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Payment Mode (All)</option>
                <option value="Cash">Cash</option>
                <option value="UPI">PhonePe / UPI</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>

              {/* Action: Add new button */}
              {permissionStatus.allowed && (
                <button
                  type="button"
                  onClick={() => setSubTab('record_expense')}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer shrink-0 ml-auto md:ml-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Record</span>
                </button>
              )}
            </div>
          </div>

          {/* Vouchers Cards List */}
          {filteredExpenses.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                <Receipt className="w-6 h-6" />
              </div>
              <h4 className="font-black text-slate-800 text-sm">
                Expense Voucher engmah hmuh a ni rih lo
              </h4>
              <p className="text-slate-500 text-xs max-w-sm mx-auto">
                {permissionStatus.allowed 
                  ? 'Bawm atanga pawisa hman chhuah a awm chuan a chunga "Hmanna Thar Record" hmet hian record rawh le.'
                  : 'He Bawm-ah hian pawisa hmanna record a la awm lo a ni.'}
              </p>
              {permissionStatus.allowed && (
                <button
                  type="button"
                  onClick={() => setSubTab('record_expense')}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Record First Expense
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0 mt-0.5">
                        <TrendingDown className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-xs">
                            {exp.purpose}
                          </span>
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                            {exp.head}
                          </span>
                          <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                            {exp.voucherNo || 'VCH'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Paid To: <strong className="text-slate-700">{exp.paidTo}</strong> • Mode: <span className="font-semibold text-slate-700">{exp.paymentMode}</span>
                          {exp.referenceNo && <span> • Ref: <span className="font-mono text-slate-600">{exp.referenceNo}</span></span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 sm:self-center pl-8 sm:pl-0">
                      <div className="text-right">
                        <div className="text-sm font-black text-rose-600">
                          -₹{exp.amount?.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {formatDateDDMMYYYY(exp.spentDate)}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1">
                        {exp.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(exp.attachmentUrl || null)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                            title="View Receipt Attachment"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {permissionStatus.allowed && (
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                            title="Delete Expense Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Recorded by: <strong>{exp.recordedBy}</strong></span>
                    <span>Date: {formatDateDDMMYYYY(exp.spentDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: RECORD NEW EXPENSE FORM */}
      {subTab === 'record_expense' && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-rose-600" /> Pawisa Hmanna Thar Record Rawh (New Voucher)
              </h3>
              <p className="text-[11px] text-slate-500">
                Organization/NGO sum atanga chhuak record felna.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('vouchers')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {!permissionStatus.allowed ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 text-amber-900">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <h4 className="font-black text-xs">Permission Restricted</h4>
              </div>
              <p className="text-xs leading-relaxed">
                {permissionStatus.reason}
              </p>
              <p className="text-[11px] text-amber-800">
                Creator-in "Authorized Officers" ah a dah che emaw Creator account hmanga i luh a ngai e.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRecordExpenseSubmit} className="space-y-3.5">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Amount */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Pawisa Hman Zat (Amount in ₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400">
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      placeholder="e.g. 1500"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Expense Head */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Pawisa Hmanna Head (Category) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setSubTab('manage_heads')}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                    >
                      + Head Thar Siamna
                    </button>
                  </div>
                  <select
                    value={selectedHead}
                    onChange={(e) => setSelectedHead(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none cursor-pointer"
                  >
                    {expenseHeads.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Purpose / Particulars */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Thil Hmanna Chipchiar (Purpose / Particulars) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Branch Committee pual thingpui leh chhang man"
                  value={purposeInput}
                  onChange={(e) => setPurposeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Paid To */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Tu Hnenah Nge Pek (Paid To / Vendor) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ebenezer Canteen / Dawr hming"
                    value={paidToInput}
                    onChange={(e) => setPaidToInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none"
                  />
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Pek Dan (Payment Mode)
                  </label>
                  <select
                    value={paymentModeInput}
                    onChange={(e) => setPaymentModeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none cursor-pointer"
                  >
                    <option value="Cash">Cash (Kut-a pek)</option>
                    <option value="UPI">PhonePe / GooglePay / UPI</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Voucher No */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Voucher Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-2026-004"
                    value={voucherNoInput}
                    onChange={(e) => setVoucherNoInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none"
                  />
                </div>

                {/* Reference No */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Ref / Bill / UTR No (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI/2026/8941"
                    value={referenceNoInput}
                    onChange={(e) => setReferenceNoInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none"
                  />
                </div>

                {/* Spent Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Hman Ni (Date)
                  </label>
                  <input
                    type="date"
                    required
                    value={spentDateInput}
                    onChange={(e) => setSpentDateInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Bill / Receipt Attachment */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block">
                  Bill / Voucher Receipt Thlalak (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleReceiptFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{receiptImage ? 'Change Image' : 'Upload Bill / Receipt'}</span>
                  </button>

                  {receiptImage && (
                    <div className="flex items-center gap-2">
                      <img
                        src={receiptImage}
                        alt="Receipt preview"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-300 ring-1 ring-indigo-500 cursor-pointer"
                        onClick={() => setPreviewReceiptUrl(receiptImage)}
                      />
                      <button
                        type="button"
                        onClick={() => setReceiptImage('')}
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Recording Expense...' : 'Save & Record Expense'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* SUB-TAB 3: MANAGE EXPENSE HEADS */}
      {subTab === 'manage_heads' && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-600" /> Pawisa Hmanna Head (Custom Categories)
              </h3>
              <p className="text-[11px] text-slate-500">
                Creator-in in pawl / NGO mamawh anga Head thar in siam chawp theihna.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('vouchers')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Back to List
            </button>
          </div>

          {/* Add New Head Box */}
          <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
            <label className="text-[11px] font-black text-purple-950 uppercase tracking-wide block">
              + Head Thar Siamna (Add Custom Head)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Centenary Project / Football Jersey & Gear"
                value={newHeadInput}
                onChange={(e) => setNewHeadInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomHead();
                  }
                }}
                className="flex-1 px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
              />
              <button
                type="button"
                onClick={handleAddCustomHead}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
              >
                Add Head
              </button>
            </div>
            {headNotice && (
              <p className="text-[11px] font-bold text-purple-800 animate-fadeIn">
                {headNotice}
              </p>
            )}
          </div>

          {/* Heads List */}
          <div className="space-y-1.5">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              Active Expense Heads ({expenseHeads.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {expenseHeads.map((head) => {
                const isDefault = DEFAULT_KUMTLUANG_EXPENSE_HEADS.includes(head);
                const count = expenseList.filter(e => e.head === head).length;

                return (
                  <div
                    key={head}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 truncate">{head}</span>
                        {isDefault && (
                          <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-extrabold">Default</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {count} recorded expense{count === 1 ? '' : 's'}
                      </span>
                    </div>

                    {!isDefault && permissionStatus.allowed && (
                      <button
                        type="button"
                        onClick={() => handleRemoveHead(head)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition cursor-pointer"
                        title="Remove custom head"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: AUTHORIZED OFFICERS (Record Thei Tur Te) */}
      {subTab === 'manage_officers' && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" /> Authorized Officers (Expense Record Thei Tur Te)
              </h3>
              <p className="text-[11px] text-slate-500">
                Pawisa hman chhuahna hi Creator emaw, creator-in phalna a pek te chauh in an entry thei ang.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSubTab('vouchers')}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Back to List
            </button>
          </div>

          {/* Add Officer Form (Only for Creator or Super Admin) */}
          {permissionStatus.allowed && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <label className="text-[11px] font-black text-slate-900 uppercase tracking-wide block">
                + Officer Thar Phalna Pekna (Assign Expense Recorder)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Officer Hming (e.g. Lalthianghlima)"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <input
                  type="text"
                  placeholder="Phone Number (10 digits)"
                  value={officerPhone}
                  onChange={(e) => setOfficerPhone(e.target.value)}
                  className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
                <div className="flex gap-2">
                  <select
                    value={officerRole}
                    onChange={(e) => setOfficerRole(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Treasurer">Treasurer</option>
                    <option value="Finance Secretary">Finance Secretary</option>
                    <option value="Accountant">Accountant</option>
                    <option value="General Secretary">General Secretary</option>
                    <option value="Authorized Entry Clerk">Entry Clerk</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddOfficer}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>
              {officerNotice && (
                <p className="text-[11px] font-bold text-emerald-700 animate-fadeIn">
                  {officerNotice}
                </p>
              )}
            </div>
          )}

          {/* List of Officers */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              Authorized Officers List
            </h4>

            {/* Campaign Creator Card */}
            <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
                  C
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-xs text-indigo-950">
                      {campaign.creatorName || campaign.contactPerson || 'Campaign Owner'}
                    </span>
                    <span className="text-[9px] bg-indigo-600 text-white px-2 py-0.2 rounded-full font-black uppercase">
                      Creator (Primary)
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Phone: {campaign.contactPhone || campaign.createdBy || 'Primary Phone'} • Full Rights
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>

            {/* Added Officers */}
            {campaign.authorizedOfficers && campaign.authorizedOfficers.length > 0 ? (
              campaign.authorizedOfficers.map((off, idx) => (
                <div
                  key={`${off.phone}-${idx}`}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black">
                      {off.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-xs text-slate-900">{off.name}</span>
                        <span className="text-[9px] bg-purple-100 text-purple-800 px-2 py-0.2 rounded-md font-extrabold">
                          {off.role || 'Officer'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-medium">
                        Phone: +91 {off.phone} • Expense Entry Rights Granted
                      </p>
                    </div>
                  </div>

                  {permissionStatus.allowed && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOfficer(off.phone)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Remove Officer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic p-3 text-center bg-slate-50 rounded-xl">
                Officer dang phalna pek an la awm lo. Creator chauhvin a record thei rih e.
              </p>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PRINTABLE VOUCHER STATEMENT */}
      {subTab === 'statement' && (
        <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 print:hidden">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-600" /> Voucher Statement & Expenditure Audit Report
              </h3>
              <p className="text-[11px] text-slate-500">
                Official statement print chhuahna leh audit theih tura buatsaih.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
              <button
                type="button"
                onClick={() => setSubTab('vouchers')}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>

          {/* Official Printable Statement Sheet */}
          <div className="p-4 sm:p-6 bg-slate-50/60 border border-slate-200 rounded-2xl space-y-4 print:border-none print:bg-white print:p-0">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-slate-200">
              <h2 className="text-base font-black uppercase text-slate-900 tracking-tight">
                {campaign.title}
              </h2>
              <p className="text-xs font-bold text-slate-600">
                Pawisa Lakluh & Hman Chhuahna Statement (Income & Expenditure Account)
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Generated Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Summary Balance Table */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Collections</span>
                <span className="text-sm font-black text-emerald-700">₹{totalCollections.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Total Expenditure</span>
                <span className="text-sm font-black text-rose-600">₹{totalExpenses.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-500 uppercase block">Closing Balance</span>
                <span className="text-sm font-black text-indigo-950">₹{netBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-2">Voucher No</th>
                    <th className="p-2">Date</th>
                    <th className="p-2">Head</th>
                    <th className="p-2">Purpose / Particulars</th>
                    <th className="p-2">Paid To</th>
                    <th className="p-2">Mode</th>
                    <th className="p-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {expenseList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                        No expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    expenseList.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold text-[10.5px] text-slate-700">{exp.voucherNo}</td>
                        <td className="p-2 font-mono text-[10.5px] text-slate-500">{formatDateDDMMYYYY(exp.spentDate)}</td>
                        <td className="p-2 font-bold text-purple-900">{exp.head}</td>
                        <td className="p-2 font-medium text-slate-800">{exp.purpose}</td>
                        <td className="p-2 text-slate-600">{exp.paidTo}</td>
                        <td className="p-2 text-slate-600">{exp.paymentMode}</td>
                        <td className="p-2 text-right font-black text-rose-600">
                          {exp.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div className="pt-8 flex justify-between text-center text-xs text-slate-600 font-bold">
              <div className="w-40 border-t border-slate-400 pt-1">
                Prepared by<br />
                <span className="text-[10px] font-normal text-slate-400">(Treasurer / Fin. Secy)</span>
              </div>
              <div className="w-40 border-t border-slate-400 pt-1">
                Verified by<br />
                <span className="text-[10px] font-normal text-slate-400">(President / Chairman)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Image Modal */}
      {previewReceiptUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div 
            className="bg-white p-3 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col space-y-2 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-indigo-600" /> Bill / Receipt Voucher
              </h4>
              <button
                type="button"
                onClick={() => setPreviewReceiptUrl(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-slate-100 rounded-xl">
              <img
                src={previewReceiptUrl}
                alt="Receipt"
                className="max-h-[60vh] object-contain rounded-lg shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
