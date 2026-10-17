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
  Check,
  Edit3,
  BookOpen,
  ArrowUpDown,
  RotateCcw,
  SlidersHorizontal,
  Layers,
  FileSpreadsheet,
  Clock
} from 'lucide-react';
import { Campaign, CreatorProfile, KumtluangExpense, Transaction } from '../types';
import { 
  getStoredExpenses, 
  saveStoredExpenses, 
  saveExpense, 
  updateStoredExpense,
  deleteStoredExpense,
  deleteAllCampaignExpenses,
  getCampaignExpenseHeads,
  saveCampaignExpenseHeads,
  renameCampaignExpenseHead,
  deleteCampaignExpenseHead,
  resetCampaignExpenseHeadsToDefault,
  DEFAULT_KUMTLUANG_EXPENSE_HEADS,
  isConfirmedTransaction,
  isTransactionForCampaign,
  saveCampaign,
  safeApiFetch
} from '../utils/storage';
import { supabase } from '../lib/supabase';
import { syncAllLocalExpensesToFirestore, fetchExpensesFromFirestore } from '../services/firestoreSync';
import { broadcastStateChange } from '../services/crossTabSync';
import { updateSupabaseOpeningBalance } from '../services/supabaseService';

import { 
  fetchOpeningBalanceFromSupabase, 
  fetchTableData, 
  upsertExpense, 
  deleteExpense, 
  subscribeToTable 
} from '../services/SupabaseSync';
import { syncAllWithServer } from '../utils/syncEngine';
import { formatDateDDMMYYYY, getTodayDateTimeLocal } from '../utils/date';
import { compressDataUrl } from '../utils/imageCompressor';
import { 
  exportCashBookPrint, 
  exportExpenditureStatementPrint, 
  exportPaymentVoucherSlipPrint,
  exportCashBookToCSV,
  exportExpensesToCSV,
  getTransactionHead 
} from '../utils/export';

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
  const [subTab, setSubTab] = useState<'vouchers' | 'record_expense' | 'manage_heads' | 'cashbook' | 'manage_officers' | 'statement'>('vouchers');

  // Expenses data state
  const [expenseList, setExpenseList] = useState<KumtluangExpense[]>(() => {
    return getStoredExpenses(campaign.id);
  });

  // Expense Heads state (dynamically customizable per Bawm)
  const [expenseHeads, setExpenseHeads] = useState<string[]>(() => {
    return getCampaignExpenseHeads(campaign.id, campaign.expenseHeads);
  });
  const [newHeadInput, setNewHeadInput] = useState<string>('');
  const [headNotice, setHeadNotice] = useState<string>('');

  // Editing existing head state
  const [editingHeadOldName, setEditingHeadOldName] = useState<string | null>(null);
  const [editingHeadNewName, setEditingHeadNewName] = useState<string>('');

  // Opening Balance state (Cash Book starting balance)
  const [openingBalance, setOpeningBalance] = useState<number>(() => {
    return Number(campaign.openingBalance) || 0;
  });
  const [isEditingOpeningBalance, setIsEditingOpeningBalance] = useState<boolean>(false);
  const [tempOpeningBalance, setTempOpeningBalance] = useState<string>(() => String(Number(campaign.openingBalance) || 0));

  // Sync opening balance when campaign changes from server/Supabase
  useEffect(() => {
    if (campaign && campaign.openingBalance !== undefined) {
      const val = Number(campaign.openingBalance) || 0;
      setOpeningBalance(val);
      if (!isEditingOpeningBalance) {
        setTempOpeningBalance(String(val));
      }
    }
  }, [campaign.openingBalance, isEditingOpeningBalance]);

  // Real-time listener for campaign updates (Opening Balance)
  useEffect(() => {
    const handleCamps = (e: Event) => {
      const customEvent = e as CustomEvent<Campaign[] | Campaign>;
      const detail = customEvent.detail;
      if (!detail) return;
      const list = Array.isArray(detail) ? detail : [detail];
      const matched = list.find((c: any) => c && c.id === campaign.id);
      if (matched && matched.openingBalance !== undefined) {
        const val = Number(matched.openingBalance) || 0;
        setOpeningBalance(val);
        if (!isEditingOpeningBalance) {
          setTempOpeningBalance(String(val));
        }
      }
    };
    window.addEventListener('ronpay_campaigns_updated', handleCamps);
    window.addEventListener('ronpay-campaigns-updated', handleCamps);
    return () => {
      window.removeEventListener('ronpay_campaigns_updated', handleCamps);
      window.removeEventListener('ronpay-campaigns-updated', handleCamps);
    };
  }, [campaign.id, isEditingOpeningBalance]);

  // Date-wise Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedHeadFilter, setSelectedHeadFilter] = useState<string>('all');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [dateFilterPreset, setDateFilterPreset] = useState<'all' | 'today' | 'this_month' | 'last_month' | 'this_year' | 'custom'>('all');
  const [fromDateFilter, setFromDateFilter] = useState<string>('');
  const [toDateFilter, setToDateFilter] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

  // Form states for Recording New Expense
  const [amountInput, setAmountInput] = useState<string>('');
  const [selectedHead, setSelectedHead] = useState<string>(() => expenseHeads[0] || 'Thil Dang / Miscellaneous');
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

  // Edit Expense State (Explicit edit modal, NO auto-update)
  const [editingExpense, setEditingExpense] = useState<KumtluangExpense | null>(null);
  const [editAmountInput, setEditAmountInput] = useState<string>('');
  const [editHeadInput, setEditHeadInput] = useState<string>('');
  const [editPurposeInput, setEditPurposeInput] = useState<string>('');
  const [editPaidToInput, setEditPaidToInput] = useState<string>('');
  const [editPaymentModeInput, setEditPaymentModeInput] = useState<string>('Cash');
  const [editVoucherNoInput, setEditVoucherNoInput] = useState<string>('');
  const [editReferenceNoInput, setEditReferenceNoInput] = useState<string>('');
  const [editSpentDateInput, setEditSpentDateInput] = useState<string>('');
  const [editReceiptImage, setEditReceiptImage] = useState<string>('');
  const [editFormError, setEditFormError] = useState<string>('');
  const [editFormSuccess, setEditFormSuccess] = useState<string>('');
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Authorized Officers management state
  const [officerName, setOfficerName] = useState<string>('');
  const [officerPhone, setOfficerPhone] = useState<string>('');
  const [officerRole, setOfficerRole] = useState<string>('Finance Secretary');
  const [officerNotice, setOfficerNotice] = useState<string>('');

  // View Receipt attachment modal & Single Voucher Slip print modal
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState<string | null>(null);
  const [printingVoucher, setPrintingVoucher] = useState<KumtluangExpense | null>(null);

  // In-app interactive confirmation dialog states (eliminates window.confirm/window.alert)
  const [voucherToDelete, setVoucherToDelete] = useState<KumtluangExpense | null>(null);
  const [headToDelete, setHeadToDelete] = useState<string | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState<boolean>(false);
  const [showClearAllVouchersConfirm, setShowClearAllVouchersConfirm] = useState<boolean>(false);

  // Cash Book search, filter & view mode
  const [cashBookSearch, setCashBookSearch] = useState<string>('');
  const [cashBookTypeFilter, setCashBookTypeFilter] = useState<'all' | 'receipt' | 'payment'>('all');
  const [cashBookViewMode, setCashBookViewMode] = useState<'responsive' | 'table'>('responsive');

  // Notification Toast for user action
  const [actionToast, setActionToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setActionToast({ message, type });
    setTimeout(() => setActionToast(null), 3500);
  };

  // Keep expense heads in sync when campaign changes
  useEffect(() => {
    const heads = getCampaignExpenseHeads(campaign.id, campaign.expenseHeads);
    setExpenseHeads(heads);
    if (!heads.includes(selectedHead)) {
      setSelectedHead(heads[0] || 'Thil Dang / Miscellaneous');
    }
  }, [campaign.id, campaign.expenseHeads]);

  // Cloud sync state
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);

  const handleManualCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      await syncAllWithServer(true).catch(() => {});
      await syncAllLocalExpensesToFirestore().catch(() => {});
      const freshLocal = getStoredExpenses(campaign.id);
      setExpenseList(freshLocal);
      showToast('Central database & Cloud sync fel a ni e!', 'success');
    } catch {
      showToast('Cloud sync timeout or offline', 'error');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  useEffect(() => {
    // Fetch opening balance directly from Supabase as Single Source of Truth
    fetchOpeningBalanceFromSupabase(campaign.id).then((val) => {
      if (typeof val === 'number' && !isNaN(val)) {
        setOpeningBalance(val);
        setTempOpeningBalance(String(val));
      }
    }).catch(() => {});

    // Fetch expenses directly from Supabase as Single Source of Truth
    fetchTableData<KumtluangExpense>('expenses').then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0) {
        saveStoredExpenses(fresh, true);
        if (!isUserInteractingRef.current) {
          const campExpenses = fresh.filter(e => e && String(e.campaignId).toLowerCase().trim() === String(campaign.id).toLowerCase().trim());
          if (campExpenses.length > 0) {
            setExpenseList(campExpenses);
          }
        }
      }
    }).catch(() => {});

    // Realtime Supabase listener for live voucher updates across devices
    const expChannel = subscribeToTable('expenses', () => {
      if (!isUserInteractingRef.current) {
        fetchTableData<KumtluangExpense>('expenses').then((fresh) => {
          if (Array.isArray(fresh) && fresh.length > 0) {
            saveStoredExpenses(fresh, true);
            const campExpenses = fresh.filter(e => e && String(e.campaignId).toLowerCase().trim() === String(campaign.id).toLowerCase().trim());
            setExpenseList(campExpenses);
          }
        }).catch(() => {});
      }
    });

    // Realtime Supabase listener for live opening balance and campaign updates
    const campChannel = subscribeToTable('campaigns', () => {
      fetchOpeningBalanceFromSupabase(campaign.id).then((val) => {
        if (typeof val === 'number' && !isNaN(val)) {
          setOpeningBalance(val);
          setTempOpeningBalance(String(val));
        }
      }).catch(() => {});
    });

    // When opened, fetch from central sync server and Firestore in background to ensure 100% consistent data across Web, Mobile & Preview
    syncAllWithServer(true).then(() => {
      if (!isUserInteractingRef.current) {
        const fresh = getStoredExpenses(campaign.id);
        if (fresh && fresh.length > 0) {
          setExpenseList(fresh);
        }
      }
    }).catch(() => {});
    fetchExpensesFromFirestore(true).then((fresh) => {
      if (Array.isArray(fresh) && fresh.length > 0 && !isUserInteractingRef.current) {
        const campExpenses = fresh.filter(e => e && String(e.campaignId).toLowerCase().trim() === String(campaign.id).toLowerCase().trim());
        if (campExpenses.length > 0) {
          setExpenseList(campExpenses);
        }
      }
    }).catch(() => {});

    return () => {
      if (expChannel) {
        try {
          supabase.removeChannel(expChannel);
        } catch {}
      }
      if (campChannel) {
        try {
          supabase.removeChannel(campChannel);
        } catch {}
      }
    };
  }, [campaign.id]);

  // Listen for storage updates, but DO NOT overwrite if user is actively editing a voucher or recording
  const isUserInteractingRef = useRef<boolean>(false);
  isUserInteractingRef.current = Boolean(editingExpense || subTab === 'record_expense');

  useEffect(() => {
    const handleUpdated = () => {
      // If user is currently editing a form, preserve their active view to avoid interrupting them
      if (isUserInteractingRef.current) return;
      const fresh = getStoredExpenses(campaign.id);
      setExpenseList(fresh);
    };
    const handleHeadsUpdated = (e: any) => {
      if (e?.detail?.campaignId && String(e.detail.campaignId).toLowerCase().trim() === String(campaign.id).toLowerCase().trim()) {
        if (Array.isArray(e.detail.heads)) {
          setExpenseHeads(e.detail.heads);
        }
      }
    };
    const handleOpeningBalUpdated = (e: any) => {
      if (e?.detail && String(e.detail.campaignId).toLowerCase().trim() === String(campaign.id).toLowerCase().trim()) {
        const val = Number(e.detail.openingBalance) || 0;
        setOpeningBalance(val);
        setTempOpeningBalance(String(val));
      }
    };
    const handleCampaignsUpdated = (e: any) => {
      if (Array.isArray(e?.detail)) {
        const found = e.detail.find((c: any) => String(c.id).toLowerCase().trim() === String(campaign.id).toLowerCase().trim());
        if (found && found.openingBalance !== undefined) {
          const val = Number(found.openingBalance) || 0;
          setOpeningBalance(val);
          setTempOpeningBalance(String(val));
        }
      }
    };

    window.addEventListener('ronpay_expenses_updated', handleUpdated);
    window.addEventListener('ronpay_expense_heads_updated', handleHeadsUpdated);
    window.addEventListener('ronpay_opening_balance_updated', handleOpeningBalUpdated);
    window.addEventListener('ronpay_campaigns_updated', handleCampaignsUpdated);
    window.addEventListener('ronpay-campaigns-updated', handleCampaignsUpdated);
    return () => {
      window.removeEventListener('ronpay_expenses_updated', handleUpdated);
      window.removeEventListener('ronpay_expense_heads_updated', handleHeadsUpdated);
      window.removeEventListener('ronpay_opening_balance_updated', handleOpeningBalUpdated);
      window.removeEventListener('ronpay_campaigns_updated', handleCampaignsUpdated);
      window.removeEventListener('ronpay-campaigns-updated', handleCampaignsUpdated);
    };
  }, [campaign.id]);

  // Within KumtluangExpenseManager, user is authorized to manage, record, edit, and delete expenses
  const permissionStatus = useMemo(() => {
    let role = creatorProfile?.role || 'Bawm Manager / Treasurer';
    if (creatorProfile?.isAdmin || creatorProfile?.role === 'SUPER_ADMIN') {
      role = 'System Administrator';
    } else if (creatorProfile?.name) {
      role = `${creatorProfile.name} (Manager)`;
    }
    return {
      allowed: true,
      reason: 'Authorized Bawm Manager & Treasurer clearance',
      roleName: role
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

  // Net Balance includes Opening Balance
  const netBalance = openingBalance + totalCollections - totalExpenses;

  // Preset Date Range setter helper
  const handleDatePresetChange = (preset: 'all' | 'today' | 'this_month' | 'last_month' | 'this_year' | 'custom') => {
    setDateFilterPreset(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'all') {
      setFromDateFilter('');
      setToDateFilter('');
    } else if (preset === 'today') {
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      setFromDateFilter(todayStr);
      setToDateFilter(todayStr);
    } else if (preset === 'this_month') {
      const yr = now.getFullYear();
      const m = now.getMonth();
      const firstDay = `${yr}-${pad(m + 1)}-01`;
      const lastDay = new Date(yr, m + 1, 0).getDate();
      const lastDayStr = `${yr}-${pad(m + 1)}-${pad(lastDay)}`;
      setFromDateFilter(firstDay);
      setToDateFilter(lastDayStr);
    } else if (preset === 'last_month') {
      const yr = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const firstDay = `${yr}-${pad(m + 1)}-01`;
      const lastDay = new Date(yr, m + 1, 0).getDate();
      const lastDayStr = `${yr}-${pad(m + 1)}-${pad(lastDay)}`;
      setFromDateFilter(firstDay);
      setToDateFilter(lastDayStr);
    } else if (preset === 'this_year') {
      const yr = now.getFullYear();
      setFromDateFilter(`${yr}-01-01`);
      setToDateFilter(`${yr}-12-31`);
    }
  };

  // Filtered expenses based on Date Range, Head, Payment Mode & Search Query
  const filteredExpenses = useMemo(() => {
    return expenseList.filter(exp => {
      // Head filter
      if (selectedHeadFilter !== 'all' && exp.head !== selectedHeadFilter) return false;
      // Mode filter
      if (selectedModeFilter !== 'all' && exp.paymentMode !== selectedModeFilter) return false;

      // Date Range Filter
      const expDate = exp.spentDate || (exp.createdAt ? exp.createdAt.slice(0, 10) : '');
      if (fromDateFilter && expDate && expDate < fromDateFilter) return false;
      if (toDateFilter && expDate && expDate > toDateFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPurpose = (exp.purpose || '').toLowerCase().includes(q);
        const matchPayee = (exp.paidTo || '').toLowerCase().includes(q);
        const matchVoucher = (exp.voucherNo || '').toLowerCase().includes(q);
        const matchHead = (exp.head || '').toLowerCase().includes(q);
        const matchRecorder = (exp.recordedBy || '').toLowerCase().includes(q);
        const matchRef = (exp.referenceNo || '').toLowerCase().includes(q);
        return matchPurpose || matchPayee || matchVoucher || matchHead || matchRecorder || matchRef;
      }
      return true;
    }).sort((a, b) => {
      if (sortOrder === 'date_desc') {
        return new Date(b.spentDate || b.recordedAt || 0).getTime() - new Date(a.spentDate || a.recordedAt || 0).getTime();
      }
      if (sortOrder === 'date_asc') {
        return new Date(a.spentDate || a.recordedAt || 0).getTime() - new Date(b.spentDate || b.recordedAt || 0).getTime();
      }
      if (sortOrder === 'amount_desc') {
        return (Number(b.amount) || 0) - (Number(a.amount) || 0);
      }
      if (sortOrder === 'amount_asc') {
        return (Number(a.amount) || 0) - (Number(b.amount) || 0);
      }
      return 0;
    });
  }, [expenseList, selectedHeadFilter, selectedModeFilter, fromDateFilter, toDateFilter, searchQuery, sortOrder]);

  // Filtered period total expenses
  const filteredTotalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  // Cash Book Unified Chronological Entries (Receipts + Expenses with Running Balance)
  const cashBookEntries = useMemo(() => {
    type CashBookItem = {
      id: string;
      date: string;
      type: 'receipt' | 'payment';
      refNo: string;
      head: string;
      particulars: string;
      receiptAmount: number;
      paymentAmount: number;
      runningBalance: number;
      rawObject: any;
    };

    const items: Array<Omit<CashBookItem, 'runningBalance'>> = [];

    // 1. Add Collections / Receipts
    transactions
      .filter(t => t && isTransactionForCampaign(t, campaign) && isConfirmedTransaction(t))
      .forEach(t => {
        const txDate = t.timestamp ? t.timestamp.slice(0, 10) : '';
        items.push({
          id: t.id,
          date: txDate,
          type: 'receipt',
          refNo: t.id,
          head: getTransactionHead(t, campaign),
          particulars: `${t.donorName || 'Anonymous Donor'}${t.donorVeng ? ` (${t.donorVeng})` : ''}${(t as any).note ? ` - ${(t as any).note}` : ''}`,
          receiptAmount: Number(t.amount) || 0,
          paymentAmount: 0,
          rawObject: t
        });
      });

    // 2. Add Expenses / Payments
    expenseList.forEach(exp => {
      const expDate = exp.spentDate || (exp.createdAt ? exp.createdAt.slice(0, 10) : '');
      items.push({
        id: exp.id,
        date: expDate,
        type: 'payment',
        refNo: exp.voucherNo || exp.id,
        head: exp.head || 'Expense',
        particulars: `${exp.purpose} (Paid to: ${exp.paidTo})`,
        receiptAmount: 0,
        paymentAmount: Number(exp.amount) || 0,
        rawObject: exp
      });
    });

    // Sort chronologically ascending to calculate running balance
    items.sort((a, b) => {
      const timeA = new Date(a.date || 0).getTime();
      const timeB = new Date(b.date || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      // Receipts first on same day
      return a.type === 'receipt' ? -1 : 1;
    });

    let currentBalance = openingBalance;
    const computed: CashBookItem[] = [];

    for (const it of items) {
      if (it.type === 'receipt') {
        currentBalance += it.receiptAmount;
      } else {
        currentBalance -= it.paymentAmount;
      }
      computed.push({
        ...it,
        runningBalance: currentBalance
      });
    }

    // Return in reverse chronological order for viewing, with running balance correctly locked
    return computed.reverse();
  }, [transactions, expenseList, campaign, openingBalance]);

  // Head-wise Ledger Breakdown (Trial Balance / Category totals)
  const headLedgerSummary = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    expenseHeads.forEach(h => {
      map.set(h, { count: 0, total: 0 });
    });

    expenseList.forEach(e => {
      const h = e.head || 'Thil Dang / Miscellaneous';
      const existing = map.get(h) || { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(e.amount) || 0;
      map.set(h, existing);
    });

    return Array.from(map.entries()).map(([head, data]) => ({
      head,
      count: data.count,
      total: data.total,
      percentage: totalExpenses > 0 ? ((data.total / totalExpenses) * 100).toFixed(1) : '0.0'
    })).sort((a, b) => b.total - a.total);
  }, [expenseHeads, expenseList, totalExpenses]);

  // Filtered Cash Book Entries for quick search, type filtering & responsive rendering
  const filteredCashBookEntries = useMemo(() => {
    return cashBookEntries.filter(item => {
      if (cashBookTypeFilter !== 'all' && item.type !== cashBookTypeFilter) {
        return false;
      }
      if (cashBookSearch) {
        const q = cashBookSearch.toLowerCase().trim();
        const matchParticulars = (item.particulars || '').toLowerCase().includes(q);
        const matchRef = (item.refNo || '').toLowerCase().includes(q);
        const matchHead = (item.head || '').toLowerCase().includes(q);
        const matchDate = (item.date || '').toLowerCase().includes(q);
        if (!matchParticulars && !matchRef && !matchHead && !matchDate) {
          return false;
        }
      }
      return true;
    });
  }, [cashBookEntries, cashBookSearch, cashBookTypeFilter]);

  // Direct Print & PDF Export handlers
  const handlePrintCashBook = () => {
    exportCashBookPrint({
      campaign,
      creatorProfile,
      openingBalance,
      totalCollections,
      totalExpenses,
      netBalance,
      headLedgerSummary,
      cashBookEntries,
      dateRangeText: 'All Time Statement',
      treasurerName: creatorProfile?.name || 'Treasurer / Fin. Secretary'
    });
  };

  const handleDownloadCashBookPDF = () => {
    handlePrintCashBook();
  };

  const handlePrintExpenseStatement = () => {
    const periodText = fromDateFilter || toDateFilter
      ? `Period: ${fromDateFilter ? formatDateDDMMYYYY(fromDateFilter) : 'Start'} to ${toDateFilter ? formatDateDDMMYYYY(toDateFilter) : 'Till Date'}`
      : 'All Time Statement';

    exportExpenditureStatementPrint({
      campaign,
      creatorProfile,
      expenses: filteredExpenses,
      openingBalance,
      totalCollections,
      filteredTotalExpenses,
      netBalance,
      dateRangeText: periodText,
      selectedHead: selectedHeadFilter === 'all' ? 'All Heads' : selectedHeadFilter,
      treasurerName: creatorProfile?.name || 'Treasurer / Fin. Secretary'
    });
  };

  const handleDownloadExpenseStatementPDF = () => {
    handlePrintExpenseStatement();
  };

  const handleExportCashBookCSV = () => {
    exportCashBookToCSV(campaign, cashBookEntries, openingBalance);
  };

  const handleExportExpenseCSV = () => {
    exportExpensesToCSV(campaign, filteredExpenses);
  };

  // Handle Receipt Image Selection for New Expense
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

  // Handle Receipt Image Selection for Edit Expense
  const handleEditReceiptFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const rawUrl = reader.result as string;
        try {
          const compressed = await compressDataUrl(rawUrl, 800, 0.7);
          setEditReceiptImage(compressed);
        } catch {
          setEditReceiptImage(rawUrl);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Failed to read edit receipt image', err);
    }
  };

  // Submit New Expense (Manual confirmation only — NO auto update)
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
        createdAt: new Date().toISOString(),
        status: 'approved'
      };

      saveExpense(newExpense);
      upsertExpense(newExpense).catch(() => {});
      setExpenseList(prev => [newExpense, ...prev.filter(e => e.id !== newExpense.id)]);

      setFormSuccess(`₹${amt.toLocaleString('en-IN')} hmanna chu fel takin record a ni ta e!`);
      showToast(`Voucher ${newExpense.voucherNo} record fel a ni e!`, 'success');

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
      }, 700);
    } catch (err: any) {
      setFormError(err?.message || 'Expense save a hlawhtling lo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Expense Modal
  const handleOpenEditExpense = (expense: KumtluangExpense) => {
    setEditingExpense(expense);
    setEditAmountInput(String(expense.amount || ''));
    setEditHeadInput(expense.head || expenseHeads[0] || 'Thil Dang / Miscellaneous');
    setEditPurposeInput(expense.purpose || '');
    setEditPaidToInput(expense.paidTo || '');
    setEditPaymentModeInput(expense.paymentMode || 'Cash');
    setEditVoucherNoInput(expense.voucherNo || '');
    setEditReferenceNoInput(expense.referenceNo || '');
    setEditSpentDateInput(expense.spentDate || new Date().toISOString().split('T')[0]);
    setEditReceiptImage(expense.attachmentUrl || '');
    setEditFormError('');
    setEditFormSuccess('');
  };

  // Submit Edit Expense (Explicit user action only — NO auto update)
  const handleSaveEditExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setEditFormError('');
    setEditFormSuccess('');

    const amt = parseFloat(editAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setEditFormError('Khawngaihin amount dik chhu lut rawh.');
      return;
    }

    if (!editPurposeInput.trim()) {
      setEditFormError('Thil hmanna (Purpose) ziah a ngai e.');
      return;
    }

    if (!editPaidToInput.trim()) {
      setEditFormError('Tu hnenah nge pek (Paid To) ziah a ngai e.');
      return;
    }

    const updated: KumtluangExpense = {
      ...editingExpense,
      amount: amt,
      head: editHeadInput,
      purpose: editPurposeInput.trim(),
      paidTo: editPaidToInput.trim(),
      paymentMode: editPaymentModeInput,
      voucherNo: editVoucherNoInput.trim() || editingExpense.voucherNo,
      referenceNo: editReferenceNoInput.trim() || undefined,
      spentDate: editSpentDateInput || editingExpense.spentDate,
      attachmentUrl: editReceiptImage || undefined,
      updatedAt: new Date().toISOString()
    };

    updateStoredExpense(updated);
    upsertExpense(updated).then(() => {
      broadcastStateChange('expenses', updated);
      window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: [updated] }));
      window.dispatchEvent(new CustomEvent('ronpay-expenses-updated', { detail: [updated] }));
    }).catch(() => {});
    setExpenseList(prev => prev.map(e => e.id === updated.id ? updated : e));
    setEditFormSuccess('Voucher siamthatna vawn that a ni ta e!');
    showToast(`Voucher ${updated.voucherNo} siamthat fel a ni e!`, 'success');

    setTimeout(() => {
      setEditingExpense(null);
    }, 600);
  };

  // Delete Expense (In-App dialog modal)
  const handleDeleteExpense = (id: string) => {
    const target = expenseList.find(e => e.id === id);
    if (target) {
      setVoucherToDelete(target);
    }
  };

  const confirmDeleteExpense = (id: string) => {
    deleteStoredExpense(id);
    deleteExpense(id).catch(() => {});
    setExpenseList(prev => prev.filter(e => e.id !== id));
    setVoucherToDelete(null);
    showToast('Expense voucher paih fel a ni e.', 'info');
  };

  const confirmClearAllVouchers = () => {
    deleteAllCampaignExpenses(campaign.id);
    setExpenseList([]);
    setShowClearAllVouchersConfirm(false);
    showToast('Bawm expenditure zawng zawng paih fai a ni ta e.', 'info');
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
    if (onUpdateCampaign) {
      onUpdateCampaign({ ...campaign, expenseHeads: updated });
    }
    setSelectedHead(trimmed);
    setNewHeadInput('');
    setHeadNotice(`Head thar "${trimmed}" siam fel a ni e!`);
    showToast(`Head "${trimmed}" dah fel a ni e.`, 'success');
  };

  // Start Editing a Head Name
  const handleStartEditHead = (headName: string) => {
    setEditingHeadOldName(headName);
    setEditingHeadNewName(headName);
  };

  // Save Renamed Head
  const handleSaveRenameHead = () => {
    if (!editingHeadOldName) return;
    const trimmedNew = editingHeadNewName.trim();
    if (!trimmedNew) {
      setHeadNotice('Head hming ziah tur a ni.');
      return;
    }
    if (trimmedNew === editingHeadOldName) {
      setEditingHeadOldName(null);
      return;
    }

    const updated = renameCampaignExpenseHead(campaign.id, editingHeadOldName, trimmedNew);
    setExpenseHeads(updated);
    if (onUpdateCampaign) {
      onUpdateCampaign({ ...campaign, expenseHeads: updated });
    }
    // Refresh local expense list as well since head name was updated
    setExpenseList(getStoredExpenses(campaign.id));
    if (selectedHead === editingHeadOldName) {
      setSelectedHead(trimmedNew);
    }
    setEditingHeadOldName(null);
    setEditingHeadNewName('');
    showToast(`Head chu "${trimmedNew}"-ah thlak fel a ni e!`, 'success');
  };

  // Remove / Delete ANY Expense Head (Default or Custom — Requirement 1 & 3)
  const handleRemoveHead = (headToRemove: string) => {
    setHeadToDelete(headToRemove);
  };

  const confirmDeleteHead = (headToRemove: string) => {
    const updated = deleteCampaignExpenseHead(campaign.id, headToRemove);
    setExpenseHeads(updated);
    if (onUpdateCampaign) {
      onUpdateCampaign({ ...campaign, expenseHeads: updated });
    }
    setExpenseList(getStoredExpenses(campaign.id));
    if (selectedHead === headToRemove) {
      setSelectedHead(updated[0] || 'Thil Dang / Miscellaneous');
    }
    setHeadToDelete(null);
    showToast(`Head "${headToRemove}" paih a ni ta e.`, 'info');
  };

  // Restore Default 9 Heads
  const handleRestoreDefaultHeads = () => {
    setShowRestoreConfirm(true);
  };

  const confirmRestoreDefaultHeads = () => {
    const defaults = resetCampaignExpenseHeadsToDefault(campaign.id);
    setExpenseHeads(defaults);
    if (onUpdateCampaign) {
      onUpdateCampaign({ ...campaign, expenseHeads: defaults });
    }
    setShowRestoreConfirm(false);
    showToast('Default heads restore a ni ta e.', 'success');
  };

  // Save Opening Balance for Cash Book
  const handleSaveOpeningBalance = () => {
    const val = parseFloat(tempOpeningBalance);
    const safeVal = isNaN(val) ? 0 : val;
    setOpeningBalance(safeVal);
    setIsEditingOpeningBalance(false);

    const updatedCamp: Campaign = {
      ...campaign,
      openingBalance: safeVal,
      updatedAt: new Date().toISOString()
    };
    saveCampaign(updatedCamp);
    updateSupabaseOpeningBalance(campaign.id, safeVal).catch(() => {});
    if (onUpdateCampaign) {
      onUpdateCampaign(updatedCamp);
    }
    broadcastStateChange('campaigns', updatedCamp);
    window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: [updatedCamp] }));
    window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: [updatedCamp] }));
    showToast(`Opening Balance ₹${safeVal.toLocaleString('en-IN')} vawng tha ta e!`, 'success');
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

    saveCampaign(updatedCamp);
    if (onUpdateCampaign) {
      onUpdateCampaign(updatedCamp);
    }

    setOfficerNotice(`${newOfficer.name} hi Authorized Officer-ah dah fel a ni e!`);
    showToast(`${newOfficer.name} dah fel a ni e!`, 'success');
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
    saveCampaign(updatedCamp);
    if (onUpdateCampaign) {
      onUpdateCampaign(updatedCamp);
    }
    showToast('Officer paih a ni ta e.', 'info');
  };

  return (
    <div className="space-y-4 text-xs font-sans pb-10">
      {/* Action Toast */}
      {actionToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold text-white transition animate-fadeIn ${
          actionToast.type === 'error' ? 'bg-rose-600' : actionToast.type === 'info' ? 'bg-slate-900' : 'bg-emerald-600'
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionToast.message}</span>
        </div>
      )}

      {/* Consolidated Financial Hub - High Contrast, Space-Efficient & Mobile-Optimized */}
      <div className="bg-slate-900 text-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-800 shadow-sm space-y-3">
        {/* Header row: Title + Live Sync + Balance Badge */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                  Pawisa Hmanral & Cash Book
                </h2>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                  netBalance >= 0 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {netBalance >= 0 ? 'Surplus' : 'Deficit'}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
                {campaign.orgName || campaign.title}
              </p>
            </div>
          </div>

          {/* Sync Button */}
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isCloudSyncing}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1.5 text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs"
              title="Cloud Live Sync"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-emerald-400 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-bold">{isCloudSyncing ? 'Syncing...' : 'Live Sync'}</span>
            </button>
          </div>
        </div>

        {/* 4 Financial Metric Cards - Compact Grid for Mobile (2x2) and Desktop (4 cols) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          {/* 1. Balance Kawl Lai */}
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
            <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Balance Kawl Lai</span>
            <span className="text-sm sm:text-lg font-black text-white block mt-0.5 truncate">
              ₹{netBalance.toLocaleString('en-IN')}
            </span>
          </div>

          {/* 2. Sum Lut (Receipts) */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
            <span className="text-[9.5px] font-bold text-emerald-300 uppercase tracking-wider block">Sum Lut (Receipts)</span>
            <span className="text-sm sm:text-lg font-black text-emerald-400 block mt-0.5 truncate">
              ₹{totalCollections.toLocaleString('en-IN')}
            </span>
          </div>

          {/* 3. Hmanral (Expenses) */}
          <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
            <span className="text-[9.5px] font-bold text-rose-300 uppercase tracking-wider block">Hmanral (Expenses)</span>
            <span className="text-sm sm:text-lg font-black text-rose-400 block mt-0.5 truncate">
              -₹{totalExpenses.toLocaleString('en-IN')}
            </span>
          </div>

          {/* 4. Opening Bal (B/F) */}
          <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-wider block">Opening (B/F)</span>
              <span className="text-sm sm:text-lg font-black text-slate-200 block mt-0.5 truncate">
                ₹{openingBalance.toLocaleString('en-IN')}
              </span>
            </div>
            {permissionStatus.allowed && !isEditingOpeningBalance && (
              <button
                type="button"
                onClick={() => {
                  setTempOpeningBalance(String(openingBalance));
                  setIsEditingOpeningBalance(true);
                }}
                className="px-2 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 text-[10px] font-bold cursor-pointer transition shrink-0 ml-1"
              >
                Set
              </button>
            )}
          </div>
        </div>

        {/* Inline Opening Balance Editor */}
        {isEditingOpeningBalance && (
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/40 rounded-xl flex items-center gap-2 text-xs flex-wrap">
            <span className="font-bold text-indigo-200 text-xs">Opening Bal (B/F): ₹</span>
            <input
              type="number"
              value={tempOpeningBalance}
              onChange={(e) => setTempOpeningBalance(e.target.value)}
              className="w-28 px-2.5 py-1 bg-slate-900 border border-indigo-400 rounded-lg text-xs font-bold text-white outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveOpeningBalance}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditingOpeningBalance(false)}
              className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs cursor-pointer hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* 5-Tab Segmented Navigation - 100% Visible & Balanced on All Screen Sizes */}
      <div className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full bg-slate-200/90 p-1 sm:p-1.5 rounded-2xl border border-slate-300 shadow-2xs">
        {/* Tab 1: Hmanral List */}
        <button
          type="button"
          onClick={() => setSubTab('vouchers')}
          className={`w-full min-w-0 py-1.5 sm:py-2 px-0.5 sm:px-1.5 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer select-none ${
            subTab === 'vouchers'
              ? 'bg-white text-indigo-950 shadow-sm border border-indigo-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
          }`}
          title="Hmanral List & Search"
        >
          <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
          <span className="text-[10px] sm:text-xs font-black tracking-tight truncate">Hmanral</span>
          <span className="text-[8.5px] sm:text-[9.5px] px-1 py-0.2 rounded-full bg-indigo-50 text-indigo-700 font-bold">
            {expenseList.length}
          </span>
        </button>

        {/* Tab 2: + Hmanna Thar */}
        <button
          type="button"
          onClick={() => setSubTab('record_expense')}
          className={`w-full min-w-0 py-1.5 sm:py-2 px-0.5 sm:px-1.5 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer select-none ${
            subTab === 'record_expense'
              ? 'bg-rose-600 text-white shadow-sm border border-rose-700 font-black'
              : 'text-rose-700 hover:text-rose-900 hover:bg-white/60 bg-rose-50/70 border border-rose-200/60 font-bold'
          }`}
          title="Hmanna Thar Record Rawh"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="text-[10px] sm:text-xs font-black tracking-tight truncate">+ Record</span>
        </button>

        {/* Tab 3: Cash Book & Ledger */}
        <button
          type="button"
          onClick={() => setSubTab('cashbook')}
          className={`w-full min-w-0 py-1.5 sm:py-2 px-0.5 sm:px-1.5 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer select-none ${
            subTab === 'cashbook'
              ? 'bg-white text-emerald-950 shadow-sm border border-emerald-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
          }`}
          title="Cash Book & Running Balance"
        >
          <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
          <span className="text-[10px] sm:text-xs font-black tracking-tight truncate">Cash Book</span>
        </button>

        {/* Tab 4: Report & Statement */}
        <button
          type="button"
          onClick={() => setSubTab('statement')}
          className={`w-full min-w-0 py-1.5 sm:py-2 px-0.5 sm:px-1.5 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer select-none ${
            subTab === 'statement'
              ? 'bg-white text-blue-950 shadow-sm border border-blue-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
          }`}
          title="Statement Print & Audit Report"
        >
          <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
          <span className="text-[10px] sm:text-xs font-black tracking-tight truncate">Report</span>
        </button>

        {/* Tab 5: Setup & Heads */}
        <button
          type="button"
          onClick={() => setSubTab('manage_heads')}
          className={`w-full min-w-0 py-1.5 sm:py-2 px-0.5 sm:px-1.5 rounded-xl text-center flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 transition cursor-pointer select-none ${
            subTab === 'manage_heads' || subTab === 'manage_officers'
              ? 'bg-white text-purple-950 shadow-sm border border-purple-200 font-black'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-bold'
          }`}
          title="Heads & Officers Setup"
        >
          <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
          <span className="text-[10px] sm:text-xs font-black tracking-tight truncate">Setup</span>
        </button>
      </div>

      {/* SUB-TAB 1: VOUCHERS LIST WITH CLEAR, INTUITIVE FILTERING */}
      {subTab === 'vouchers' && (
        <div className="space-y-3 animate-fadeIn">
          {/* Streamlined Search & Filter Panel */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            {/* Row 1: Search Box + Date Presets */}
            <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Zawnna (Search purpose, payee, voucher no, ref...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Date Presets Dropdown & Inline Custom Range */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={dateFilterPreset}
                  onChange={(e) => handleDatePresetChange(e.target.value as any)}
                  className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-white transition"
                >
                  <option value="all">Hun Zavai (All Time)</option>
                  <option value="this_month">Kumin Thla (This Month)</option>
                  <option value="last_month">Thla Hmasa (Last Month)</option>
                  <option value="this_year">Kumin (This Year)</option>
                  <option value="today">Vawiin (Today)</option>
                  <option value="custom">Custom Date Range...</option>
                </select>

                {(dateFilterPreset === 'custom' || fromDateFilter || toDateFilter) && (
                  <div className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-xl text-xs shadow-2xs">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">From:</span>
                    <input
                      type="date"
                      value={fromDateFilter}
                      onChange={(e) => {
                        setFromDateFilter(e.target.value);
                        setDateFilterPreset('custom');
                      }}
                      className="text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    />
                    <span className="text-slate-300 font-bold">-</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">To:</span>
                    <input
                      type="date"
                      value={toDateFilter}
                      onChange={(e) => {
                        setToDateFilter(e.target.value);
                        setDateFilterPreset('custom');
                      }}
                      className="text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => handleDatePresetChange('all')}
                      className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer ml-1"
                    >
                      Reset
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Secondary Filters (Head, Payment Mode, Sort) & Filter Summary */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={selectedHeadFilter}
                  onChange={(e) => setSelectedHeadFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="all">Heads Zawng Zawng ({expenseHeads.length})</option>
                  {expenseHeads.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>

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

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="date_desc">Ni (Date): Thar Ber Hmasa</option>
                  <option value="date_asc">Ni (Date): Hma Ber Hmasa</option>
                  <option value="amount_desc">Amount: Tam Ber Hmasa</option>
                  <option value="amount_asc">Amount: Tlem Ber Hmasa</option>
                </select>

                {(searchQuery || selectedHeadFilter !== 'all' || selectedModeFilter !== 'all' || dateFilterPreset !== 'all' || fromDateFilter || toDateFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedHeadFilter('all');
                      setSelectedModeFilter('all');
                      handleDatePresetChange('all');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Counter summary */}
              <div className="text-xs font-bold text-slate-600 flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">
                <span>Vouchers: <strong className="text-slate-900">{filteredExpenses.length}</strong></span>
                <span>•</span>
                <span>Total: <strong className="text-rose-600 font-black">₹{filteredTotalExpenses.toLocaleString('en-IN')}</strong></span>
              </div>
            </div>
          </div>

          {/* Vouchers List / Empty State */}
          {filteredExpenses.length === 0 ? (
            <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center space-y-3 shadow-2xs">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-100 shadow-xs">
                <Receipt className="w-7 h-7" />
              </div>
              <h4 className="font-black text-slate-800 text-base">
                Expense Voucher engmah hmuh a ni rih lo
              </h4>
              <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                {fromDateFilter || toDateFilter || searchQuery || selectedHeadFilter !== 'all' || selectedModeFilter !== 'all'
                  ? 'I filter zawnna mil voucher a awm lo e. Filter dang thlang la emaw Reset rawh le.'
                  : 'Bawm atanga pawisa hman chhuah a awm chuan a chunga "+ Hmanna Thar" hmet hian record rawh le.'}
              </p>
              <div className="pt-2 flex items-center justify-center gap-2">
                {(fromDateFilter || toDateFilter || searchQuery || selectedHeadFilter !== 'all' || selectedModeFilter !== 'all') ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDatePresetChange('all');
                      setSelectedHeadFilter('all');
                      setSelectedModeFilter('all');
                      setSearchQuery('');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSubTab('record_expense')}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ Hmanna Thar Record Rawh</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Left: Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Date Badge */}
                      <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Date</span>
                        <span className="text-xs font-black text-slate-800 font-mono">
                          {formatDateDDMMYYYY(exp.spentDate)}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm">
                            {exp.purpose}
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                            {exp.head}
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                            {exp.voucherNo || 'VCH'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium">
                          Tu hnenah: <strong className="text-slate-800">{exp.paidTo}</strong> • Mode: <span className="font-bold text-slate-700">{exp.paymentMode}</span>
                          {exp.referenceNo && <span> • Ref: <span className="font-mono text-slate-700">{exp.referenceNo}</span></span>}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-base sm:text-lg font-black text-rose-600 tracking-tight">
                          -₹{exp.amount?.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Recorded by: {exp.recordedBy || 'Official'}
                        </div>
                      </div>

                      {/* Action buttons: Print Slip, View Receipt, Edit, Delete */}
                      <div className="flex items-center gap-1.5">
                        {/* Print Individual Voucher Slip */}
                        <button
                          type="button"
                          onClick={() => setPrintingVoucher(exp)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition cursor-pointer"
                          title="Print Payment Voucher Slip"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                        </button>

                        {/* View Receipt Image */}
                        {exp.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewReceiptUrl(exp.attachmentUrl || null)}
                            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                            title="View Receipt Attachment"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Edit Expense */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditExpense(exp)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                          title="Voucher siamtha rawh"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        {/* Delete Expense */}
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                          title="Voucher paih rawh"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Paih</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: CASH BOOK & LEDGER VIEW (High Polish, Mobile-Optimized) */}
      {subTab === 'cashbook' && (
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          {/* Header & Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-600" /> Cash Book & Ledger (Sum Vawnna Lehkhabu)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Opening Balance, Sum Lut (Receipts), Sum Chhuak (Payments), leh Running Balance vawn felna.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrintCashBook}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Print official Cash Book with Running Balances"
              >
                <Printer className="w-3.5 h-3.5" /> Print Book
              </button>
              <button
                type="button"
                onClick={handleDownloadCashBookPDF}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Download Cash Book as A4 PDF"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={handleExportCashBookCSV}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                title="Export Cash Book to CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
              </button>
              <button
                type="button"
                onClick={() => setSubTab('statement')}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer border border-rose-200"
                title="View Date-wise Expenditure Statement"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" /> Statement
              </button>
            </div>
          </div>

          {/* Cash Book 4-Pillar Financial Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80">
              <span className="text-[9.5px] font-bold text-slate-500 block uppercase">1. Opening Balance (B/F)</span>
              <span className="text-xs sm:text-sm font-black text-slate-800">₹{openingBalance.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200/80">
              <span className="text-[9.5px] font-bold text-emerald-700 block uppercase">2. Total Receipts (+)</span>
              <span className="text-xs sm:text-sm font-black text-emerald-700">₹{totalCollections.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-200/80">
              <span className="text-[9.5px] font-bold text-rose-700 block uppercase">3. Total Payments (-)</span>
              <span className="text-xs sm:text-sm font-black text-rose-700">₹{totalExpenses.toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-200/80">
              <span className="text-[9.5px] font-bold text-indigo-900 block uppercase">4. Closing Cash Balance (=)</span>
              <span className="text-xs sm:text-sm font-black text-indigo-950">₹{netBalance.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Head-wise Ledger Breakdown (Trial Balance / Category totals) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-600" /> Head-Wise Ledger (Hmanna Category Tlangpui)
              </h4>
              <span className="text-[10px] text-slate-400 font-bold">
                {headLedgerSummary.filter(h => h.total > 0).length} Active Categories
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {headLedgerSummary.map(item => (
                <div key={item.head} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 flex justify-between items-center transition">
                  <div className="min-w-0 pr-2">
                    <span className="text-xs font-bold text-slate-800 block truncate">{item.head}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {item.count} voucher{item.count === 1 ? '' : 's'} · {item.percentage}%
                    </span>
                  </div>
                  <span className={`text-xs font-black shrink-0 ${item.total > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    ₹{item.total.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Cash Book Toolbar: Search + Type Filter + View Mode Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              {/* Search Box */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cash Book zawnna (Particulars, Ref, Head, Date...)"
                  value={cashBookSearch}
                  onChange={(e) => setCashBookSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8.5 pr-8 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 outline-none font-medium"
                />
                {cashBookSearch && (
                  <button
                    type="button"
                    onClick={() => setCashBookSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setCashBookTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    cashBookTypeFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  A Zavai ({cashBookEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCashBookTypeFilter('receipt')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    cashBookTypeFilter === 'receipt'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-slate-200'
                  }`}
                >
                  Receipts (+)
                </button>
                <button
                  type="button"
                  onClick={() => setCashBookTypeFilter('payment')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                    cashBookTypeFilter === 'payment'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-rose-700 hover:bg-rose-50 border border-slate-200'
                  }`}
                >
                  Payments (-)
                </button>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-xl shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCashBookViewMode('responsive')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    cashBookViewMode === 'responsive'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setCashBookViewMode('table')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    cashBookViewMode === 'table'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Table
                </button>
              </div>
            </div>
          </div>

          {/* Chronological Unified Cash Book List / Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
              <span>Transactions: <strong className="text-slate-900">{filteredCashBookEntries.length}</strong></span>
              <span className="text-[11px] text-slate-400">Chronological with Running Balance</span>
            </div>

            {/* Opening Balance Card (Always shown if openingBalance > 0 and no strict search filter) */}
            {openingBalance > 0 && (!cashBookSearch || cashBookSearch.toLowerCase().includes('open')) && (
              <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs shrink-0">
                    B/F
                  </div>
                  <div className="min-w-0">
                    <span className="font-black text-xs text-indigo-950 block truncate">
                      Opening Balance in Hand / Bank (Brought Forward)
                    </span>
                    <span className="text-[10px] text-indigo-700 font-medium">Initial Fund Setup</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-700 block">+₹{openingBalance.toLocaleString('en-IN')}</span>
                  <span className="text-[10px] font-bold text-indigo-900">Bal: ₹{openingBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}

            {filteredCashBookEntries.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-slate-200">
                Cash book entry a la awm lo emaw i zawnna mil a awm lo e.
              </div>
            ) : cashBookViewMode === 'responsive' ? (
              /* Mobile & Small Screen Optimized Card Layout */
              <div className="space-y-2">
                {filteredCashBookEntries.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="p-3 bg-white rounded-2xl border border-slate-200/90 hover:border-slate-300 shadow-2xs space-y-2 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10.5px] font-mono text-slate-500 font-bold">
                          {formatDateDDMMYYYY(item.date)}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase ${
                          item.type === 'receipt'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.type === 'receipt' ? 'Receipt (+)' : 'Payment (-)'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.2 rounded">
                          {item.refNo}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs sm:text-sm font-black ${
                          item.type === 'receipt' ? 'text-emerald-700' : 'text-rose-600'
                        }`}>
                          {item.type === 'receipt' ? `+₹${item.receiptAmount.toLocaleString('en-IN')}` : `-₹${item.paymentAmount.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 truncate">{item.particulars}</p>
                        <p className="text-[10px] text-purple-700 font-medium truncate">{item.head}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9.5px] text-slate-400 font-bold block">Running Balance:</span>
                        <span className="text-xs font-black text-indigo-950">
                          ₹{item.runningBalance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Traditional Full Ledger Table (Scrollable on small screens) */
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Voucher / Ref</th>
                      <th className="p-2.5">Particulars / Narration</th>
                      <th className="p-2.5 text-right">Receipt (₹)</th>
                      <th className="p-2.5 text-right">Payment (₹)</th>
                      <th className="p-2.5 text-right">Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCashBookEntries.map((item) => (
                      <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 transition">
                        <td className="p-2.5 font-mono text-[10.5px] text-slate-600 whitespace-nowrap">
                          {formatDateDDMMYYYY(item.date)}
                        </td>
                        <td className="p-2.5">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                            item.type === 'receipt' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.type === 'receipt' ? 'Receipt' : 'Payment'}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono font-bold text-[10px] text-slate-600 whitespace-nowrap">
                          {item.refNo}
                        </td>
                        <td className="p-2.5 max-w-xs">
                          <div className="font-semibold text-slate-800 text-[11px] truncate">
                            {item.particulars}
                          </div>
                          <div className="text-[9.5px] text-slate-400">
                            {item.head}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-black text-emerald-700 whitespace-nowrap">
                          {item.receiptAmount > 0 ? `₹${item.receiptAmount.toLocaleString('en-IN')}` : '--'}
                        </td>
                        <td className="p-2.5 text-right font-black text-rose-600 whitespace-nowrap">
                          {item.paymentAmount > 0 ? `₹${item.paymentAmount.toLocaleString('en-IN')}` : '--'}
                        </td>
                        <td className="p-2.5 text-right font-black text-indigo-950 whitespace-nowrap">
                          ₹{item.runningBalance.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: RECORD NEW EXPENSE FORM */}
      {subTab === 'record_expense' && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-rose-600" /> Pawisa Hmanna Thar Record Rawh (New Voucher)
              </h3>
              <p className="text-[11px] text-slate-500">
                Organization/NGO sum atanga chhuak record felna (Manual save only).
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
                      + Head En / Siam Danglam
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

              {/* Action button */}
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

      {/* SUB-TAB 4: MANAGE EXPENSE HEADS (Full Customization — Requirement 1) */}
      {subTab === 'manage_heads' && (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-600" /> Expense Heads Management (Dah Chawp / Paih / Edit)
              </h3>
              <p className="text-[11px] text-slate-500">
                Creator-in in pawl/kohhran mamawh dan ang zelin Head hi i dah chawp, edit, emaw paih vek thei e.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRestoreDefaultHeads}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1"
                title="Restore original 9 defaults"
              >
                <RotateCcw className="w-3 h-3" /> Restore Defaults
              </button>
              <button
                type="button"
                onClick={() => setSubTab('vouchers')}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Back to List
              </button>
            </div>
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

          {/* Heads List (All editable & removable — Requirement 1) */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider">
              Active Expense Heads ({expenseHeads.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {expenseHeads.map((head) => {
                const count = expenseList.filter(e => e.head === head).length;
                const isEditingThis = editingHeadOldName === head;

                return (
                  <div
                    key={head}
                    className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition"
                  >
                    {isEditingThis ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <input
                          type="text"
                          value={editingHeadNewName}
                          onChange={(e) => setEditingHeadNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRenameHead();
                            if (e.key === 'Escape') setEditingHeadOldName(null);
                          }}
                          className="flex-1 px-2.5 py-1 bg-white border border-indigo-400 rounded-lg text-xs font-bold text-slate-900"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveRenameHead}
                          className="p-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs"
                          title="Save Head Name"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingHeadOldName(null)}
                          className="p-1.5 bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                          title="Cancel"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 truncate">{head}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {count} recorded voucher{count === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Edit / Rename button */}
                          <button
                            type="button"
                            onClick={() => handleStartEditHead(head)}
                            className="px-2.5 py-1 rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                            title="Edit / Rename Head"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit</span>
                          </button>

                          {/* Delete / Paih button (Works on ANY head!) */}
                          <button
                            type="button"
                            onClick={() => handleRemoveHead(head)}
                            className="px-2.5 py-1 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                            title="Head paih rawh"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Paih</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DATE-WISE STATEMENT & AUDIT REPORT */}
      {subTab === 'statement' && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xs space-y-4 animate-fadeIn">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 print:hidden">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-emerald-600" /> Date-Wise Expenditure & Audit Statement
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Official statement buatsaihna, print chhuahna, leh audit theih tura fel taka remkhawm.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrintExpenseStatement}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Print or Preview Statement"
              >
                <Printer className="w-3.5 h-3.5" /> Print Statement
              </button>
              <button
                type="button"
                onClick={handleDownloadExpenseStatementPDF}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Download Statement as PDF"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                type="button"
                onClick={handleExportExpenseCSV}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1 cursor-pointer"
                title="Export Vouchers to CSV / Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
              </button>
              <button
                type="button"
                onClick={() => setSubTab('vouchers')}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Back
              </button>
            </div>
          </div>

          {/* Report Date & Category Filter Controls (print:hidden) - Fel fai, hnawk lo & Custom date awlsam tak */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl print:hidden flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: Direct Date Range (From - To) & Quick Preset */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Hun Bi (Date Range):</span>
              </div>

              {/* Direct From - To Date Inputs */}
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-xl shadow-2xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">From:</span>
                <input
                  type="date"
                  value={fromDateFilter}
                  onChange={(e) => {
                    setFromDateFilter(e.target.value);
                    setDateFilterPreset('custom');
                  }}
                  className="text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  title="A tan ni (Start Date)"
                />
                <span className="text-slate-300 font-bold px-0.5">-</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">To:</span>
                <input
                  type="date"
                  value={toDateFilter}
                  onChange={(e) => {
                    setToDateFilter(e.target.value);
                    setDateFilterPreset('custom');
                  }}
                  className="text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  title="A tawp ni (End Date)"
                />
              </div>

              {/* Quick Preset Dropdown - Quiet & Unobtrusive */}
              <select
                value={dateFilterPreset}
                onChange={(e) => handleDatePresetChange(e.target.value as any)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer hover:border-slate-400 transition"
                title="Quick Date Presets"
              >
                <option value="all">Hun Zavai (All Time)</option>
                <option value="this_month">Kumin Thla (This Month)</option>
                <option value="last_month">Thla Hmasa (Last Month)</option>
                <option value="this_year">Kumin (This Year)</option>
                <option value="today">Vawiin (Today)</option>
                <option value="custom">Custom Range</option>
              </select>

              {(fromDateFilter || toDateFilter || dateFilterPreset !== 'all') && (
                <button
                  type="button"
                  onClick={() => handleDatePresetChange('all')}
                  className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline cursor-pointer px-1"
                  title="Reset date to all time"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Right: Category Head Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-600" /> Head:
              </span>
              <select
                value={selectedHeadFilter}
                onChange={(e) => setSelectedHeadFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-400 transition"
              >
                <option value="all">Heads Zawng Zawng ({expenseHeads.length})</option>
                {expenseHeads.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Official Printable Statement Sheet */}
          <div className="p-3.5 sm:p-6 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-4 print:border-none print:bg-white print:p-0">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-slate-200">
              <h2 className="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight">
                {campaign.title}
              </h2>
              {campaign.orgName && (
                <p className="text-xs sm:text-sm font-black text-indigo-900">{campaign.orgName}</p>
              )}
              <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                Pawisa Hman Chhuahna Statement (Expenditure & Audit Statement)
              </p>
              <p className="text-[10.5px] text-slate-500 font-medium">
                {fromDateFilter || toDateFilter ? (
                  <>Period: <strong>{fromDateFilter ? formatDateDDMMYYYY(fromDateFilter) : 'Start'}</strong> to <strong>{toDateFilter ? formatDateDDMMYYYY(toDateFilter) : 'Till Date'}</strong></>
                ) : (
                  <>Period: <strong>All Time Statement</strong></>
                )}
                {' · '}Head: <strong>{selectedHeadFilter === 'all' ? 'All Expenditure Heads' : selectedHeadFilter}</strong>
                {' · '}Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {/* Summary Balance Strip (4 items) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] font-bold text-slate-500 uppercase block">Opening Bal (B/F)</span>
                <span className="text-xs sm:text-sm font-black text-slate-800">₹{openingBalance.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] font-bold text-emerald-600 uppercase block">Total Collections</span>
                <span className="text-xs sm:text-sm font-black text-emerald-700">₹{totalCollections.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] font-bold text-rose-600 uppercase block">Period Expenses</span>
                <span className="text-xs sm:text-sm font-black text-rose-600">₹{filteredTotalExpenses.toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[9px] font-bold text-indigo-900 uppercase block">Closing Balance</span>
                <span className="text-xs sm:text-sm font-black text-indigo-950">₹{netBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Head-Wise Category Summary Table */}
            <div className="space-y-1.5 pt-1">
              <h4 className="text-[10.5px] font-black uppercase text-slate-600 tracking-wider">
                1. Category Summary (Head-Wise Breakdown)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Sl.</th>
                      <th className="p-2">Head / Category</th>
                      <th className="p-2 text-center">Vouchers</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                      <th className="p-2 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {headLedgerSummary.filter(h => h.total > 0).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-3 text-center text-slate-400 italic text-[11px]">
                          Category expense a la awm lo.
                        </td>
                      </tr>
                    ) : (
                      headLedgerSummary.filter(h => h.total > 0).map((h, i) => (
                        <tr key={h.head} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{h.head}</td>
                          <td className="p-2 text-center text-slate-600">{h.count}</td>
                          <td className="p-2 text-right font-black text-rose-600">₹{h.total.toLocaleString('en-IN')}</td>
                          <td className="p-2 text-right text-slate-500 font-bold">{h.percentage}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Detailed Itemized Schedule */}
            <div className="space-y-1.5 pt-1">
              <h4 className="text-[10.5px] font-black uppercase text-slate-600 tracking-wider">
                2. Itemized Expenditure Schedule (Voucher List)
              </h4>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Sl.</th>
                      <th className="p-2">Voucher No</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Head</th>
                      <th className="p-2">Particulars / Narration</th>
                      <th className="p-2">Paid To</th>
                      <th className="p-2">Mode</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                          No expenses recorded for this period.
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp, idx) => (
                        <tr key={exp.id} className="hover:bg-slate-50">
                          <td className="p-2 text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                          <td className="p-2 font-mono font-bold text-[10.5px] text-slate-700 whitespace-nowrap">{exp.voucherNo}</td>
                          <td className="p-2 font-mono text-[10.5px] text-slate-500 whitespace-nowrap">{formatDateDDMMYYYY(exp.spentDate)}</td>
                          <td className="p-2 font-bold text-purple-900 whitespace-nowrap">{exp.head}</td>
                          <td className="p-2 font-medium text-slate-800">{exp.purpose}</td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">{exp.paidTo}</td>
                          <td className="p-2 text-slate-600 whitespace-nowrap">{exp.paymentMode}</td>
                          <td className="p-2 text-right font-black text-rose-600 whitespace-nowrap">
                            ₹{exp.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                    {/* Total Row */}
                    <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300">
                      <td colSpan={7} className="p-2.5 text-right uppercase tracking-wider text-[11px]">
                        Total Expenditure for Period:
                      </td>
                      <td className="p-2.5 text-right text-rose-700 text-xs sm:text-sm font-black whitespace-nowrap">
                        ₹{filteredTotalExpenses.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Official Signature Area */}
            <div className="pt-8 sm:pt-10 grid grid-cols-3 text-center text-xs text-slate-700 font-bold gap-4">
              <div>
                <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[140px]">
                  Prepared by<br />
                  <span className="text-[10px] font-medium text-slate-500">(Treasurer / Fin. Secy)</span>
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[140px]">
                  Checked by<br />
                  <span className="text-[10px] font-medium text-slate-500">(Auditor / Accountant)</span>
                </div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1.5 mx-auto max-w-[140px]">
                  Approved by<br />
                  <span className="text-[10px] font-medium text-slate-500">(President / Leader)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 6: AUTHORIZED OFFICERS */}
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

          {/* Add Officer Form */}
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

      {/* EXPLICIT EDIT VOUCHER MODAL (Requirement 5 — NO auto update) */}
      {editingExpense && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setEditingExpense(null)}
        >
          <div 
            className="bg-white p-5 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
              <div>
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-600" /> Voucher Siamthatna (Edit Voucher)
                </h4>
                <p className="text-[10.5px] text-slate-400">
                  {editingExpense.voucherNo || editingExpense.id} • Siamthat hnuah "Vawng Tha Rawh" hmet rawh le.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpense(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditExpense} className="space-y-3">
              {editFormError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editFormError}</span>
                </div>
              )}

              {editFormSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{editFormSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={editAmountInput}
                    onChange={(e) => setEditAmountInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Expense Head *
                  </label>
                  <select
                    value={editHeadInput}
                    onChange={(e) => setEditHeadInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    {expenseHeads.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                  Purpose / Particulars *
                </label>
                <input
                  type="text"
                  required
                  value={editPurposeInput}
                  onChange={(e) => setEditPurposeInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Paid To *
                  </label>
                  <input
                    type="text"
                    required
                    value={editPaidToInput}
                    onChange={(e) => setEditPaidToInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={editPaymentModeInput}
                    onChange={(e) => setEditPaymentModeInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">PhonePe / UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Voucher No
                  </label>
                  <input
                    type="text"
                    value={editVoucherNoInput}
                    onChange={(e) => setEditVoucherNoInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Ref No
                  </label>
                  <input
                    type="text"
                    value={editReferenceNoInput}
                    onChange={(e) => setEditReferenceNoInput(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-600 block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editSpentDateInput}
                    onChange={(e) => setEditSpentDateInput(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                  />
                </div>
              </div>

              {/* Receipt Image */}
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <input
                  type="file"
                  ref={editFileInputRef}
                  accept="image/*"
                  onChange={handleEditReceiptFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                >
                  {editReceiptImage ? 'Change Receipt Photo' : 'Upload Receipt Photo'}
                </button>
                {editReceiptImage && (
                  <div className="flex items-center gap-2">
                    <img src={editReceiptImage} alt="receipt" className="w-8 h-8 object-cover rounded border" />
                    <button
                      type="button"
                      onClick={() => setEditReceiptImage('')}
                      className="text-rose-600 text-xs font-bold"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Manual Confirmation Save Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  <span>Siamthatna Vawng Tha Rawh (Save Changes)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE VOUCHER SLIP PRINT MODAL (Requirement 3) */}
      {printingVoucher && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setPrintingVoucher(null)}
        >
          <div 
            className="bg-white p-6 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl border border-slate-200 print:max-w-none print:shadow-none print:border-none print:p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 print:hidden">
              <h4 className="font-black text-xs text-slate-900 flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-emerald-600" /> Official Payment Voucher Slip Print
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    exportPaymentVoucherSlipPrint(campaign, creatorProfile, printingVoucher);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                  title="Print or Download PDF Voucher Slip"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF Slip
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingVoucher(null)}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Voucher Slip Paper Form */}
            <div className="border-2 border-slate-800 p-5 rounded-2xl bg-white space-y-4">
              <div className="text-center space-y-0.5 border-b-2 border-slate-800 pb-2.5">
                <h3 className="font-black text-sm uppercase text-slate-900 tracking-wide">
                  {campaign.title}
                </h3>
                {campaign.orgName && (
                  <p className="text-xs font-bold text-slate-700">{campaign.orgName}</p>
                )}
                <div className="inline-block px-3 py-0.5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-wider rounded-md mt-1">
                  PAYMENT VOUCHER (SUM CHHUAHNA LEHKHA)
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-500">Voucher No: </span>
                  <span className="font-mono font-black text-slate-900">{printingVoucher.voucherNo}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-500">Date: </span>
                  <span className="font-mono font-bold text-slate-900">{formatDateDDMMYYYY(printingVoucher.spentDate)}</span>
                </div>
              </div>

              <div className="space-y-2 text-xs divide-y divide-slate-200">
                <div className="pt-1.5 flex justify-between">
                  <span className="font-bold text-slate-600">Head of Account:</span>
                  <span className="font-bold text-indigo-900">{printingVoucher.head}</span>
                </div>
                <div className="pt-1.5 flex justify-between">
                  <span className="font-bold text-slate-600">Paid To (Hnenah):</span>
                  <span className="font-black text-slate-900">{printingVoucher.paidTo}</span>
                </div>
                <div className="pt-1.5 flex justify-between">
                  <span className="font-bold text-slate-600">Payment Mode:</span>
                  <span className="font-bold text-slate-700">{printingVoucher.paymentMode}</span>
                </div>
                {printingVoucher.referenceNo && (
                  <div className="pt-1.5 flex justify-between">
                    <span className="font-bold text-slate-600">Ref / Bill / UTR:</span>
                    <span className="font-mono text-slate-700">{printingVoucher.referenceNo}</span>
                  </div>
                )}
                <div className="pt-1.5">
                  <span className="font-bold text-slate-600 block mb-0.5">Particulars / Hmanna chhan:</span>
                  <p className="text-slate-800 font-medium pl-2 border-l-2 border-slate-300">
                    {printingVoucher.purpose}
                  </p>
                </div>
                <div className="pt-2 flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-black text-xs uppercase text-slate-700">Amount Paid:</span>
                  <span className="text-base font-black text-slate-950">₹{printingVoucher.amount.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="pt-8 grid grid-cols-2 gap-4 text-center text-xs">
                <div className="border-t border-slate-400 pt-1">
                  <div className="h-8 flex items-end justify-center text-[10px] text-slate-400 italic">
                    (Passed & Paid)
                  </div>
                  <span className="font-bold text-slate-800">Treasurer / Fin. Secretary</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <div className="h-8 flex items-end justify-center text-[10px] text-slate-400 italic">
                    (Received by)
                  </div>
                  <span className="font-bold text-slate-800">Payee Signature</span>
                </div>
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

      {/* 1. VOUCHER DELETE CONFIRMATION MODAL */}
      {voucherToDelete && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setVoucherToDelete(null)}
        >
          <div 
            className="bg-white p-5 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">Expense Voucher Paih Duhna</h4>
                <p className="text-[11px] text-slate-500">He voucher hi paih (delete) i chiang chiah em?</p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Voucher No:</span>
                <span className="font-mono font-black text-slate-800">{voucherToDelete.voucherNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Amount:</span>
                <span className="font-black text-rose-600">₹{voucherToDelete.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Head:</span>
                <span className="font-bold text-slate-700">{voucherToDelete.head}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Paid To:</span>
                <span className="font-bold text-slate-700">{voucherToDelete.paidTo}</span>
              </div>
              <div className="pt-1 text-[11px] text-slate-600 border-t border-slate-200 italic truncate">
                "{voucherToDelete.purpose}"
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Paih hnuah database leh live sync atangin a bo nghal ang a, chhui let theih a ni tawh lo ang.
            </p>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setVoucherToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Thulh Leh Rawh
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteExpense(voucherToDelete.id)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Paih Nghal Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXPENSE HEAD DELETE CONFIRMATION MODAL */}
      {headToDelete && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setHeadToDelete(null)}
        >
          <div 
            className="bg-white p-5 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <Tag className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">Expense Head Paih Duhna</h4>
                <p className="text-[11px] text-slate-500">He category hi paih i chiang em?</p>
              </div>
            </div>

            <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-black text-xs">Head hming: "{headToDelete}"</p>
              <p className="text-[11px] leading-relaxed">
                He Head hnuaia voucher awm tawh te chu a hming bo lovin <strong>"Thil Dang / Miscellaneous"</strong> hnuaiah an in-sawn nghal ang.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setHeadToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Thulh Leh Rawh
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteHead(headToDelete)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Paih Nghal Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. RESTORE DEFAULT HEADS CONFIRMATION MODAL */}
      {showRestoreConfirm && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowRestoreConfirm(false)}
        >
          <div 
            className="bg-white p-5 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">Default Heads Restore Duhna</h4>
                <p className="text-[11px] text-slate-500">He Bawm-a Dahsa (Default 9 Heads) te hi restore i duh em?</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Default Head 9 te hi dah let leh an ni ang a, i custom siam te erawh an bo dawn lo a ni.
            </p>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Thulh Leh Rawh
              </button>
              <button
                type="button"
                onClick={confirmRestoreDefaultHeads}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Nghal Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. CLEAR ALL VOUCHERS CONFIRMATION MODAL */}
      {showClearAllVouchersConfirm && (
        <div 
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowClearAllVouchersConfirm(false)}
        >
          <div 
            className="bg-white p-5 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-900">Voucher Zawng Zawng Paih Fai Duhna</h4>
                <p className="text-[11px] text-slate-500">He Bawm-a Expenditure vouchers zawng zawng paih fai vekna.</p>
              </div>
            </div>

            <div className="bg-rose-50 p-3.5 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-1">
              <p className="font-black">Bawm: {campaign.title}</p>
              <p className="text-[11px] leading-relaxed">
                Vouchers awm zawng zawng ({expenseList.length} vouchers) te hi paih fai vek an ni dawn a, Cash Book leh Ledger pawh reset a ni ang.
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowClearAllVouchersConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Thulh Leh Rawh
              </button>
              <button
                type="button"
                onClick={confirmClearAllVouchers}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Paih Fai Vek Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
