import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  Filter, 
  Search, 
  Layers,
  ChevronRight, 
  TrendingUp,
  Receipt,
  Download,
  Building2,
  PieChart,
  Table,
  Users,
  Lock,
  ShieldAlert,
  UserCheck,
  Edit3,
  Trash2,
  Plus,
  Check,
  X,
  Sparkles,
  Image as ImageIcon,
  MapPin,
  ZoomIn,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  FileCheck,
  Sliders,
  Settings,
  Eye,
  EyeOff,
  Zap,
  Banknote,
  MessageSquare,
  Target,
  Printer
} from 'lucide-react';
import { Transaction, Campaign, BawmCategory, CreatorProfile } from '../types';
import { 
  exportTransactionsToCSV, 
  exportFormattedExcel,
  printTransactionsPDF, 
  exportMasterLedgerPrint,
  exportMemberCategoryMatrixPrint,
  exportMemberPassbookVerticalPrint,
  buildKumtluangMatrix,
  computeMonthlyDistribution,
  MonthRangeConfig,
  ALL_MONTH_NAMES_SHORT,
  TargetExportInfo
} from '../utils/export';
import { getMembers } from '../utils/storage';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';

interface ReportsScreenProps {
  transactions: Transaction[];
  campaigns: Campaign[];
  creatorProfile: CreatorProfile;
  onBack: () => void;
  onOpenLogin?: () => void;
  onUpdateCampaign?: (campaign: Campaign) => void;
  onUpdateTransaction?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transactionId: string) => void;
  onOpenImagePreview?: (url: string, title?: string, subtitle?: string, location?: string) => void;
  onOpenMemberRoll?: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports') => void;
}

export const ReportsScreen: React.FC<ReportsScreenProps> = ({
  transactions,
  campaigns,
  creatorProfile,
  onBack,
  onOpenLogin,
  onUpdateCampaign,
  onUpdateTransaction,
  onDeleteTransaction,
  onOpenImagePreview,
  onOpenMemberRoll,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('kumtluang');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('2026-08-01');
  const [endDate, setEndDate] = useState<string>('2026-08-31');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc'>('date-desc');
  
  // Transaction Editing State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // CSV / Excel Export Feedback Toast State
  const [exportFeedback, setExportFeedback] = useState<{ message: string; count: number } | null>(null);

  // PDF & Report Customization State
  const [includeMonthlyChart, setIncludeMonthlyChart] = useState<boolean>(true);
  const [chartStartMonth, setChartStartMonth] = useState<string>('Apr');
  const [chartEndMonth, setChartEndMonth] = useState<string>('Mar');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [showExportOptions, setShowExportOptions] = useState<boolean>(false);
  const [reportPrintStyle, setReportPrintStyle] = useState<'standard_pdf' | 'master_ledger' | 'member_matrix' | 'member_passbook'>('standard_pdf');
  const [reportMemberId, setReportMemberId] = useState<string>('');

  // Memoized month range config (From startMonth Upto endMonth)
  const monthRangeConfig = useMemo<MonthRangeConfig>(() => ({
    startMonth: chartStartMonth,
    endMonth: chartEndMonth,
  }), [chartStartMonth, chartEndMonth]);

  // Check if current user is an authenticated QR creator
  const isCreator = Boolean(creatorProfile.isApproved && creatorProfile.phone);

  // Filter campaigns strictly owned/created by this creator
  const creatorCampaigns = campaigns.filter(c => {
    if (!isCreator) return false;
    // Match by creator phone or createdBy or name or creator's approved category
    if (c.createdBy && (c.createdBy === creatorProfile.phone || c.createdBy === creatorProfile.name)) {
      return true;
    }
    // Also include campaigns in creator's approved categories if created
    return creatorProfile.approvedCategories.includes(c.category);
  });

  const creatorCampaignIds = new Set(creatorCampaigns.map(c => c.id));

  // Available campaigns for selector based on creator scope
  const availableCampaigns = isCreator 
    ? creatorCampaigns.filter(c => selectedFilter === 'all' || c.category === selectedFilter)
    : [];

  // Filter transactions: STRICT CREATOR ONLY ACCESS
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Creator Security Barrier: Only show transactions belonging to Creator's campaigns
      if (!isCreator) return false;
      if (!creatorCampaignIds.has(t.campaignId) && !creatorCampaigns.some(c => c.title === t.campaignTitle)) {
        return false;
      }

      // 2. Category filter
      if (selectedFilter !== 'all') {
        if (t.category !== selectedFilter) return false;
      }

      // 3. Specific Campaign sub-filter
      if (selectedCampaignId !== 'all') {
        if (t.campaignId !== selectedCampaignId) return false;
      }

      // 4. Period / Month filter
      if (selectedPeriodFilter !== 'all') {
        if (t.periodLabel && !t.periodLabel.toLowerCase().includes(selectedPeriodFilter.toLowerCase())) {
          return false;
        }
      }

      // 5. Date range filter
      const txDate = t.timestamp.slice(0, 10);
      if (startDate && txDate < startDate) return false;
      if (endDate && txDate > endDate) return false;

      // 6. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.campaignTitle.toLowerCase().includes(q);
        const matchesDonor = t.donorName.toLowerCase().includes(q);
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesPeriod = t.periodLabel ? t.periodLabel.toLowerCase().includes(q) : false;
        if (!matchesTitle && !matchesDonor && !matchesId && !matchesPeriod) return false;
      }

      return true;
    });
  }, [transactions, isCreator, creatorCampaignIds, creatorCampaigns, selectedFilter, selectedCampaignId, selectedPeriodFilter, startDate, endDate, searchQuery]);

  // Sorted Transactions based on sortOrder (Alphabetical Name, Date, Amount)
  const sortedTransactions = useMemo(() => {
    return [...filteredTransactions].sort((a, b) => {
      if (sortOrder === 'name-asc') {
        const nameA = a.isAnonymous ? 'Anonymous' : (a.donorName || '');
        const nameB = b.isAnonymous ? 'Anonymous' : (b.donorName || '');
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      }
      if (sortOrder === 'name-desc') {
        const nameA = a.isAnonymous ? 'Anonymous' : (a.donorName || '');
        const nameB = b.isAnonymous ? 'Anonymous' : (b.donorName || '');
        return nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
      }
      if (sortOrder === 'amount-desc') {
        return b.amount - a.amount;
      }
      // date-desc (default)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [filteredTransactions, sortOrder]);

  // Calculate totals (Platform Fee is completely excluded from Reports)
  const totalCount = filteredTransactions.length;
  const uniqueDonorsCount = new Set(filteredTransactions.map(t => t.donorName)).size;
  const grandTotal = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Kumtluang matrix computation (Hming | Cat1 | Cat2 | Cat3 | Total)
  const isKumtluang = selectedFilter === 'kumtluang';
  const kumtluangMatrix = useMemo(() => {
    return buildKumtluangMatrix(filteredTransactions, sortOrder);
  }, [filteredTransactions, sortOrder]);

  // Selected campaign display name
  const selectedCampaignObj = creatorCampaigns.find(c => c.id === selectedCampaignId);
  const currentCampaignDisplayName = selectedCampaignObj 
    ? selectedCampaignObj.title 
    : (selectedFilter === 'all' ? 'All My Campaigns' : `${selectedFilter.toUpperCase()} BAWM (All My Campaigns)`);

  // 1. Text chung ber atan: NGO / Church / Hming / Title (Creator-in a Text Box a a chhut luh ang)
  const headerTitle = useMemo(() => {
    if (selectedCampaignObj) {
      return selectedCampaignObj.title || selectedCampaignObj.orgName || creatorProfile.orgName || creatorProfile.name || 'RonPay Community';
    }
    return creatorProfile.orgName || creatorProfile.name || (selectedFilter === 'all' ? 'All My Campaigns' : `${selectedFilter.toUpperCase()} BAWM`);
  }, [selectedCampaignObj, creatorProfile, selectedFilter]);

  // 2. A hnuai ah: Veng / Khua / Location (Creator-in a dah luh)
  const headerLocation = useMemo(() => {
    if (selectedCampaignObj?.location) {
      return selectedCampaignObj.location;
    }
    if (creatorProfile.address) {
      return creatorProfile.address;
    }
    return 'Mizoram, India';
  }, [selectedCampaignObj, creatorProfile]);

  // Active uploaded image associated with campaign / QR
  const activeCampaignImage = selectedCampaignObj?.imageUrl || (availableCampaigns.find(c => Boolean(c.imageUrl))?.imageUrl);

  const dateRangeText = startDate && endDate
    ? `${formatDateDDMMYYYY(startDate)} to ${formatDateDDMMYYYY(endDate)}`
    : (selectedPeriodFilter !== 'all' ? selectedPeriodFilter : 'All Time');

  const creatorMetadata = isCreator ? {
    name: creatorProfile.name || 'Authorized Official',
    orgName: headerTitle,
    phone: creatorProfile.phone,
    address: headerLocation
  } : undefined;

  // Active target information for the current campaign or filter context
  const activeTargetInfo: TargetExportInfo | null = useMemo(() => {
    if (selectedCampaignObj?.targetAmount && selectedCampaignObj.targetAmount > 0) {
      const targetAmount = selectedCampaignObj.targetAmount;
      const targetPeriod = selectedCampaignObj.targetPeriod;
      const periodLabel = targetPeriod === 'monthly' ? 'Thla tin' : targetPeriod === 'yearly' ? 'Kum tin' : 'Overall Target';
      const periodSuffix = targetPeriod === 'monthly' ? '/thla' : targetPeriod === 'yearly' ? '/kum' : '';
      const progressPct = targetAmount > 0 ? Math.round((grandTotal / targetAmount) * 100) : 0;
      const isCompleted = grandTotal >= targetAmount;
      const remaining = Math.max(0, targetAmount - grandTotal);
      const surplus = Math.max(0, grandTotal - targetAmount);

      return {
        targetAmount,
        targetPeriod,
        periodLabel,
        periodSuffix,
        progressPct,
        isCompleted,
        remaining,
        surplus,
        campaignTitle: selectedCampaignObj.title
      };
    }

    // Check if the current filter context has campaigns with target
    const targetedCampaigns = (selectedFilter === 'all' 
      ? creatorCampaigns 
      : creatorCampaigns.filter(c => c.category === selectedFilter)
    ).filter(c => Boolean(c.targetAmount && c.targetAmount > 0));

    if (targetedCampaigns.length === 1) {
      const c = targetedCampaigns[0];
      const targetAmount = c.targetAmount!;
      const targetPeriod = c.targetPeriod;
      const periodLabel = targetPeriod === 'monthly' ? 'Thla tin' : targetPeriod === 'yearly' ? 'Kum tin' : 'Overall Target';
      const periodSuffix = targetPeriod === 'monthly' ? '/thla' : targetPeriod === 'yearly' ? '/kum' : '';
      const campTxns = filteredTransactions.filter(t => t.campaignId === c.id || t.campaignTitle === c.title);
      const campTotal = campTxns.reduce((sum, t) => sum + t.amount, 0);
      const progressPct = targetAmount > 0 ? Math.round((campTotal / targetAmount) * 100) : 0;
      const isCompleted = campTotal >= targetAmount;
      const remaining = Math.max(0, targetAmount - campTotal);
      const surplus = Math.max(0, campTotal - targetAmount);

      return {
        targetAmount,
        targetPeriod,
        periodLabel,
        periodSuffix,
        progressPct,
        isCompleted,
        remaining,
        surplus,
        campaignTitle: c.title
      };
    } else if (targetedCampaigns.length > 1) {
      const combinedTarget = targetedCampaigns.reduce((sum, c) => sum + (c.targetAmount || 0), 0);
      const progressPct = combinedTarget > 0 ? Math.round((grandTotal / combinedTarget) * 100) : 0;
      const isCompleted = grandTotal >= combinedTarget;
      const remaining = Math.max(0, combinedTarget - grandTotal);
      const surplus = Math.max(0, grandTotal - combinedTarget);

      return {
        targetAmount: combinedTarget,
        targetPeriod: undefined,
        periodLabel: `${targetedCampaigns.length} Bawm Targets Combined`,
        periodSuffix: '',
        progressPct,
        isCompleted,
        remaining,
        surplus,
        campaignTitle: `${targetedCampaigns.length} Bawm Targets`
      };
    }

    return null;
  }, [selectedCampaignObj, grandTotal, selectedFilter, creatorCampaigns, filteredTransactions]);

  // Compute monthly trend for the live banner & reports with customizable month range
  const monthlyDistribution = useMemo(() => {
    return computeMonthlyDistribution(filteredTransactions, monthRangeConfig);
  }, [filteredTransactions, monthRangeConfig]);

  const showExportSuccessToast = (type: string, count: number) => {
    setExportFeedback({
      message: `${type} export hlawhtling ta! (${count} records saved)`,
      count,
    });
    setTimeout(() => {
      setExportFeedback(null);
    }, 4500);
  };

  // Formatted Excel (.xls) with custom cell styles, colors, headers, and borders
  const handleDownloadExcelFormatted = () => {
    if (!isCreator) {
      alert('🔒 Transaction Report download hi QR Creator chauhin an ti thei.');
      return;
    }
    if (sortedTransactions.length === 0) {
      alert('⚠️ No transactions to export for the selected filter.');
      return;
    }
    exportFormattedExcel(
      sortedTransactions,
      `${headerTitle}_${selectedFilter}_Statement`,
      isKumtluang,
      headerTitle,
      dateRangeText,
      creatorMetadata,
      sortOrder,
      activeTargetInfo || undefined
    );
    showExportSuccessToast(isKumtluang ? 'Formatted Excel (.xls) Matrix' : 'Formatted Excel (.xls) Statement', sortedTransactions.length);
  };

  // Plain CSV (.csv) for raw data export
  const handleDownloadCSV = () => {
    if (!isCreator) {
      alert('🔒 Transaction Report download hi QR Creator chauhin an ti thei.');
      return;
    }
    if (sortedTransactions.length === 0) {
      alert('⚠️ No transactions to export for the selected filter.');
      return;
    }
    exportTransactionsToCSV(
      sortedTransactions, 
      `${headerTitle}_${selectedFilter}_Report`, 
      isKumtluang,
      headerTitle,
      dateRangeText,
      creatorMetadata,
      sortOrder,
      activeTargetInfo || undefined
    );
    showExportSuccessToast(isKumtluang ? 'Kumtluang Matrix CSV' : 'Transaction CSV', sortedTransactions.length);
  };

  const handleDownloadPDF = () => {
    if (!isCreator) {
      alert('🔒 Transaction Report download hi QR Creator chauhin an ti thei.');
      return;
    }

    const allMembers = getMembers();
    const resolvedOrgName = selectedCampaignObj?.orgName || selectedCampaignObj?.title || creatorProfile.orgName || creatorProfile.name || 'RonPay Organization';
    const resolvedLogoUrl = activeCampaignImage || creatorProfile.logoUrl;
    const resolvedLocation = headerLocation;

    if (reportPrintStyle === 'master_ledger') {
      exportMasterLedgerPrint(
        allMembers, 
        transactions, 
        selectedCampaignObj?.title || headerTitle, 
        resolvedOrgName,
        resolvedLogoUrl,
        resolvedLocation
      );
      showExportSuccessToast('Format 1: Master Ledger Printout', allMembers.length);
      return;
    }

    if (reportPrintStyle === 'member_matrix') {
      if (!reportMemberId) {
        alert('Khawngaihin member thlang hmasa rawh le.');
        return;
      }
      const m = allMembers.find(x => x.id === reportMemberId);
      const defaultCategories = selectedCampaignObj?.subCategories && selectedCampaignObj.subCategories.length > 0
        ? selectedCampaignObj.subCategories
        : ['Pathian Ram Zauna', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];
      if (m) {
        exportMemberCategoryMatrixPrint(
          m, 
          defaultCategories, 
          transactions, 
          resolvedOrgName,
          resolvedLogoUrl,
          resolvedLocation
        );
        showExportSuccessToast(`Format 2: Category Matrix (${m.name})`, 1);
      }
      return;
    }

    if (reportPrintStyle === 'member_passbook') {
      if (!reportMemberId) {
        alert('Khawngaihin member thlang hmasa rawh le.');
        return;
      }
      const m = allMembers.find(x => x.id === reportMemberId);
      const defaultCategories = selectedCampaignObj?.subCategories && selectedCampaignObj.subCategories.length > 0
        ? selectedCampaignObj.subCategories
        : ['Pathian Ram Zauna', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];
      if (m) {
        exportMemberPassbookVerticalPrint(
          m, 
          defaultCategories, 
          transactions, 
          resolvedOrgName,
          resolvedLogoUrl,
          resolvedLocation
        );
        showExportSuccessToast(`Format 3: Mimal Passbook (${m.name})`, 1);
      }
      return;
    }

    // Default Standard PDF Statement
    if (sortedTransactions.length === 0) {
      alert('⚠️ No transactions to export for the selected filter.');
      return;
    }
    printTransactionsPDF(
      sortedTransactions, 
      `${headerTitle} - Reports & Financial Statements`, 
      isKumtluang,
      headerTitle,
      dateRangeText,
      activeCampaignImage,
      sortOrder,
      creatorMetadata,
      {
        includeMonthlyChart,
        monthRangeConfig,
        includeSignatures,
        targetInfo: activeTargetInfo || undefined
      }
    );
    showExportSuccessToast('PDF Statement', sortedTransactions.length);
  };

  const toggleNameSort = () => {
    setSortOrder(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc');
  };

  // Find a transaction by donor name for Kumtluang matrix row edit
  const handleEditDonorRow = (donorName: string) => {
    const tx = filteredTransactions.find(t => t.donorName === donorName);
    if (tx) {
      setEditingTransaction(tx);
    } else {
      alert('Transaction record hmuh a ni lo.');
    }
  };

  return (
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* Enhanced Top Screen Header */}
      <div className="bg-white p-3.5 sm:p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-95 shrink-0 shadow-2xs"
            title="Go back to Home"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Reports & Financial Statements
              </h2>
              <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-300 uppercase tracking-wide">
                Live Audit
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Official Bawm Collection Matrix, Donor History & Export Sheets
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[10.5px] bg-slate-100 text-slate-700 font-bold px-3 py-1.5 rounded-xl border border-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Active Session
          </span>
        </div>
      </div>

      {/* Creator Restriction Banner if not logged in */}
      {!isCreator ? (
        <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl text-center space-y-3">
          <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="font-black text-base text-white">QR Creator Chiahin Report An Download Thei</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto">
              Transaction Report leh Financial Statement reng reng hi QR Creator-in ama campaign create chin chiah a hmuin a download thei ang.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenLogin}
              className="bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Creator Login / Verify Account
            </button>
          </div>
        </div>
      ) : (
        /* Authenticated Creator Report Section */
        <>
          {/* Creator Scope Info Badge */}
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <div>
                <span className="font-black text-emerald-950">{creatorProfile.name}</span>
                <p className="text-[10px] text-emerald-700 font-medium">
                  {creatorProfile.orgName} ({creatorProfile.phone}) • {creatorCampaigns.length} Active Campaigns
                </p>
              </div>
            </div>
            <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-md border border-emerald-300 uppercase">
              Verified Creator Access
            </span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 space-y-3.5 shadow-xs text-xs">
            {/* Main Category Filter */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Bawm Category
                </label>
                <select
                  value={selectedFilter}
                  onChange={(e) => {
                    setSelectedFilter(e.target.value);
                    setSelectedCampaignId('all');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition text-xs"
                >
                  <option value="kumtluang">Kumtluang Bawm (Category Matrix View)</option>
                  <option value="ralna">Ralna Bawm (Chhiatni)</option>
                  <option value="khawlsak">Khawlsak Bawm (Riangvai)</option>
                  <option value="rikrum">Rikrum Bawm (Emergency)</option>
                  <option value="all">All My Created Categories</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  My Specific Campaign / QR
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition text-xs"
                >
                  <option value="all">All My Campaigns in this Bawm</option>
                  {availableCampaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title} {c.targetAmount && c.targetAmount > 0 ? `(🎯 Target: ₹${c.targetAmount.toLocaleString('en-IN')}${c.targetPeriod === 'monthly' ? '/thla' : c.targetPeriod === 'yearly' ? '/kum' : ''})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Period / Month filter, Search & Sort */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  📅 Month / Period Filter
                </label>
                <select
                  value={selectedPeriodFilter}
                  onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 text-xs"
                >
                  <option value="all">All Months & Periods</option>
                  <option value="August">August 2026</option>
                  <option value="July">July 2026</option>
                  <option value="June">June 2026</option>
                  <option value="Q3">Q3 (Jul - Sep)</option>
                  <option value="Q2">Q2 (Apr - Jun)</option>
                  <option value="2026">2026 Full Year</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Search Donor / TxID</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter donor, TxID, period..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-8 pr-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  🔤 Sort Order (Hming / Date)
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full bg-indigo-50/70 border border-indigo-300 rounded-xl p-2 font-bold text-indigo-950 focus:outline-none focus:bg-white focus:border-indigo-600 text-xs"
                >
                  <option value="date-desc">A Tharlam (Newest Date First)</option>
                  <option value="name-asc">Hming: Alphabetical (A - Z)</option>
                  <option value="name-desc">Hming: Alphabetical (Z - A)</option>
                  <option value="amount-desc">Amount: A Tam Ber (Highest First)</option>
                </select>
              </div>
            </div>

            {/* Date pickers */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 text-xs"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 text-xs"
                />
              </div>
            </div>

            {/* Active Report Focus Banner with Uploaded Campaign Image (Spacious & High-Visibility) */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-4 sm:p-5.5 rounded-3xl border border-indigo-700/60 shadow-lg flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="flex items-start sm:items-center gap-3.5 sm:gap-4.5 min-w-0 flex-1">
                {/* Vei lamah: Creator-in Thlalak a dah sa */}
                {activeCampaignImage ? (
                  <div 
                    onClick={() => onOpenImagePreview && onOpenImagePreview(
                      activeCampaignImage, 
                      headerTitle, 
                      headerLocation,
                      `Trxn Date: ${dateRangeText}`
                    )}
                    className="relative group shrink-0 cursor-pointer"
                    title="Click to preview full high-res photo"
                  >
                    <img 
                      src={activeCampaignImage} 
                      alt={headerTitle} 
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-amber-400 shadow-md transition-transform group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent rounded-2xl flex items-center justify-center transition-colors">
                      <span className="text-[8px] sm:text-[9px] font-black bg-slate-950/85 text-amber-300 px-1.5 py-0.5 rounded-md backdrop-blur-xs absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap border border-amber-400/40 flex items-center gap-1 shadow-sm">
                        <ZoomIn className="w-2.5 h-2.5" /> Thlalak
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-indigo-900/80 border border-indigo-700/60 flex flex-col items-center justify-center text-indigo-300 shrink-0 gap-1 shadow-md">
                    <ImageIcon className="w-8 h-8 text-indigo-400" />
                    <span className="text-[8.5px] text-indigo-300 font-bold uppercase tracking-wider">No Photo</span>
                  </div>
                )}

                {/* Thlalak sir / hrul ah: Text Hierarchy */}
                <div className="space-y-1 min-w-0 flex-1">
                  {/* 1. Chung ber atan: NGO / Church / Hming / Title (Hawrawp Font Size lian hlek) */}
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-white leading-tight break-words">
                    {headerTitle}
                  </h3>

                  {/* 2. A hnuai ah: Veng / Khua / etc Creatorin a dah luh kha (Hawrawp te deuh zawk) */}
                  <p className="text-xs sm:text-sm font-semibold text-amber-300/95 leading-normal flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{headerLocation}</span>
                  </p>

                  {/* 3. A hnuaiah: Reports & Financial Statements */}
                  <p className="text-[11px] sm:text-xs font-bold text-sky-400 tracking-wide">
                    Reports & Financial Statements
                  </p>

                  {/* 4. A hnuai leh ah: Trxn Date */}
                  <p className="text-[10.5px] sm:text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span>Trxn Date: <b className="text-white font-bold">{dateRangeText}</b></span>
                  </p>
                </div>
              </div>

              {/* Summary Total Card */}
              <div className="bg-slate-950/60 border border-indigo-500/30 p-3 sm:p-3.5 rounded-2xl text-left md:text-right shrink-0 md:min-w-[170px] flex md:flex-col justify-between items-center md:items-end">
                <div>
                  <span className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider block">
                    Pek Tling Khawm Zat
                  </span>
                  <span className="text-base sm:text-xl font-black text-emerald-400 leading-tight block mt-0.5">
                    ₹{grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
                <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold self-center md:self-end mt-0 md:mt-1">
                  100% Direct (0% Fee)
                </span>
              </div>
            </div>

            {/* TARGET & COLLECTION PROGRESS CARD (When Target is Configured) */}
            {activeTargetInfo && activeTargetInfo.targetAmount > 0 && (
              <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 border-2 border-indigo-500/60 p-3.5 sm:p-4.5 rounded-2xl text-white shadow-md space-y-2.5 animate-fadeIn">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-800/40 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-400/40 shrink-0">
                      <Target className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                          Target & Collection Progress
                        </span>
                        <span className="text-[9px] font-extrabold bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 px-2 py-0.5 rounded-md">
                          {activeTargetInfo.periodLabel}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 font-medium">
                        {activeTargetInfo.campaignTitle} • Stats & Completion Rate
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className={`text-xs font-black px-2.5 py-1 rounded-xl border flex items-center gap-1 shadow-xs ${
                      activeTargetInfo.isCompleted 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' 
                        : 'bg-indigo-500/25 text-indigo-200 border-indigo-400/40'
                    }`}>
                      {activeTargetInfo.isCompleted ? '🎉' : '📈'} {activeTargetInfo.progressPct}% Tling Tawh
                    </span>
                  </div>
                </div>

                {/* Metrics 3-box Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <div className="bg-slate-900/80 border border-indigo-500/30 p-2.5 rounded-xl">
                    <span className="text-[9.5px] text-indigo-300 font-bold uppercase block">🎯 Target Goal</span>
                    <span className="text-sm sm:text-base font-black text-white block mt-0.5">
                      ₹{activeTargetInfo.targetAmount.toLocaleString('en-IN')}{activeTargetInfo.periodSuffix}
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-indigo-500/30 p-2.5 rounded-xl">
                    <span className="text-[9.5px] text-emerald-400 font-bold uppercase block">📈 Pek Tling Zat (Collected)</span>
                    <span className="text-sm sm:text-base font-black text-emerald-400 block mt-0.5">
                      ₹{grandTotal.toLocaleString('en-IN')} <span className="text-xs font-bold text-slate-300">({activeTargetInfo.progressPct}%)</span>
                    </span>
                  </div>

                  <div className="bg-slate-900/80 border border-indigo-500/30 p-2.5 rounded-xl">
                    <span className={`text-[9.5px] font-bold uppercase block ${activeTargetInfo.isCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {activeTargetInfo.isCompleted ? '🎉 Target Khum Tawh' : '⏳ Mamawh Baki'}
                    </span>
                    <span className={`text-sm sm:text-base font-black block mt-0.5 ${activeTargetInfo.isCompleted ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {activeTargetInfo.isCompleted 
                        ? `+₹${activeTargetInfo.surplus.toLocaleString('en-IN')}` 
                        : `₹${activeTargetInfo.remaining.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                </div>

                {/* Progress Bar Track */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 px-0.5">
                    <span>0%</span>
                    <span>50%</span>
                    <span>🎯 Target (100%)</span>
                  </div>
                  <div className="w-full h-3 bg-slate-900 border border-indigo-500/40 rounded-full overflow-hidden p-0.5 shadow-inner">
                    <div 
                      style={{ width: `${Math.min(activeTargetInfo.progressPct, 100)}%` }} 
                      className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                        activeTargetInfo.isCompleted 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                          : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400'
                      }`}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* LIVE MONTHLY TREND BAR CHART (TOGGLEABLE & CUSTOMIZABLE WITH CLEAN FROM - UPTO MONTHS) */}
            {includeMonthlyChart ? (
              <div className="bg-slate-950/85 border border-indigo-500/30 p-3 sm:p-3.5 rounded-2xl animate-fadeIn space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-indigo-950/80 pb-2">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                        <BarChart3 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white font-black">Thla Tin Trend (Monthly Collections)</span>
                          <span className="text-[9px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30">
                            {monthlyDistribution.months.length === 1 
                              ? `${monthlyDistribution.months[0]} Chauh` 
                              : `${monthlyDistribution.months[0]} – ${monthlyDistribution.months[monthlyDistribution.months.length - 1]} (${monthlyDistribution.months.length} Thla)`}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-indigo-300/80 font-medium">
                          Peak: <b className="text-amber-300">₹{monthlyDistribution.maxVal.toLocaleString('en-IN')}</b> • PDF & Screen Overview
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Clean From - Upto Month Selectors & Paih Button */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-between sm:justify-end text-xs">
                    <div className="flex items-center gap-1 bg-slate-900 border border-indigo-500/40 rounded-xl px-2 py-1">
                      <span className="text-[10px] text-indigo-300 font-bold">From:</span>
                      <select
                        value={chartStartMonth}
                        onChange={(e) => setChartStartMonth(e.target.value)}
                        className="bg-transparent text-amber-300 text-[11px] font-bold focus:outline-none cursor-pointer"
                        title="Start Month (Hun Intanna)"
                      >
                        {ALL_MONTH_NAMES_SHORT.map(m => (
                          <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                        ))}
                      </select>

                      <span className="text-indigo-400 font-bold px-0.5">–</span>

                      <span className="text-[10px] text-indigo-300 font-bold">Upto:</span>
                      <select
                        value={chartEndMonth}
                        onChange={(e) => setChartEndMonth(e.target.value)}
                        className="bg-transparent text-amber-300 text-[11px] font-bold focus:outline-none cursor-pointer"
                        title="End Month (Hun Tawpna)"
                      >
                        {ALL_MONTH_NAMES_SHORT.map(m => (
                          <option key={m} value={m} className="bg-slate-900 text-white">{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quick Paih / Hide button */}
                    <button
                      onClick={() => setIncludeMonthlyChart(false)}
                      className="text-[10px] bg-slate-900 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/60 px-2 py-1.5 rounded-xl font-bold flex items-center gap-1 transition cursor-pointer"
                      title="Monthly Trend Chart hi paih / dah bo rawh"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Paih</span>
                    </button>
                  </div>
                </div>
                
                {/* Visual Bar Chart */}
                <div className="flex items-end justify-between gap-1 pt-2 h-20 px-1">
                  {monthlyDistribution.months.map((m) => {
                    const val = monthlyDistribution.monthTotals[m] || 0;
                    const heightPercent = monthlyDistribution.maxVal > 0 
                      ? Math.max(12, Math.round((val / monthlyDistribution.maxVal) * 100)) 
                      : 10;
                    const hasVal = val > 0;
                    const isSingle = monthlyDistribution.months.length === 1;
                    return (
                      <div key={m} className={`flex-1 flex flex-col items-center justify-end h-full group relative ${isSingle ? 'max-w-[120px] mx-auto' : 'min-w-[20px]'}`}>
                        {/* Tooltip on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded shadow-lg border border-slate-700 pointer-events-none whitespace-nowrap z-20">
                          {m}: ₹{val.toLocaleString('en-IN')}
                        </div>
                        <div 
                          style={{ height: `${heightPercent}%` }} 
                          className={`w-full ${isSingle ? 'max-w-[48px]' : 'max-w-[24px]'} rounded-t-md transition-all ${
                            hasVal 
                              ? 'bg-gradient-to-t from-rose-600 to-rose-400 border border-rose-300/40 shadow-xs' 
                              : 'bg-slate-800/80 border border-slate-700/40'
                          }`}
                        />
                        <span className={`text-[8.5px] font-bold mt-1 uppercase ${hasVal ? 'text-rose-300' : 'text-slate-500'}`}>
                          {m}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Compact Banner when Monthly Trend is turned OFF */
              <div className="bg-slate-950/60 border border-dashed border-indigo-500/30 p-2.5 sm:p-3 rounded-2xl flex items-center justify-between gap-2 text-xs animate-fadeIn">
                <div className="flex items-center gap-2 text-slate-400">
                  <EyeOff className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-[11px] font-medium">Thla Tin Bar Graph (Monthly Trend) chu paih / dah bo a ni.</span>
                </div>
                <button
                  onClick={() => setIncludeMonthlyChart(true)}
                  className="bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-400/40 text-[10.5px] font-bold px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>+ Tarlang Rawh (Show Trend)</span>
                </button>
              </div>
            )}

            {/* Summary Highlights (With explicit Online vs Cash breakdown & Target KPI) */}
            <div className={`grid gap-2 pt-2 border-t border-slate-100 text-center ${
              activeTargetInfo && activeTargetInfo.targetAmount > 0 
                ? 'grid-cols-2 sm:grid-cols-5' 
                : 'grid-cols-2 sm:grid-cols-4'
            }`}>
              <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
                <p className="text-[9px] text-slate-500 font-bold uppercase">Txns & Donors</p>
                <p className="text-xs sm:text-sm font-black text-indigo-900 mt-0.5">{totalCount} <span className="text-[10px] text-slate-500 font-semibold">({uniqueDonorsCount} Donors)</span></p>
              </div>
              <div className="bg-indigo-50/90 p-2.5 rounded-xl border border-indigo-200">
                <p className="text-[9px] text-indigo-700 font-bold uppercase flex items-center justify-center gap-1">⚡ Online (UPI)</p>
                <p className="text-xs sm:text-sm font-black text-indigo-950 mt-0.5">
                  ₹{filteredTransactions.filter(t => t.paymentMethod === 'online').reduce((s, t) => s + t.amount, 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200">
                <p className="text-[9px] text-amber-800 font-bold uppercase flex items-center justify-center gap-1">💵 Cash (Counter)</p>
                <p className="text-xs sm:text-sm font-black text-amber-950 mt-0.5">
                  ₹{filteredTransactions.filter(t => t.paymentMethod === 'cash').reduce((s, t) => s + t.amount, 0).toLocaleString('en-IN')}
                </p>
              </div>
              {activeTargetInfo && activeTargetInfo.targetAmount > 0 && (
                <div className="bg-violet-50/90 p-2.5 rounded-xl border border-violet-200">
                  <p className="text-[9px] text-violet-800 font-bold uppercase flex items-center justify-center gap-1">🎯 Target Goal</p>
                  <p className="text-xs sm:text-sm font-black text-violet-950 mt-0.5">
                    ₹{activeTargetInfo.targetAmount.toLocaleString('en-IN')}{activeTargetInfo.periodSuffix}
                    <span className="text-[10px] text-violet-700 font-bold block">({activeTargetInfo.progressPct}% achieved)</span>
                  </p>
                </div>
              )}
              <div className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                <p className="text-[9px] text-emerald-800 font-bold uppercase">Grand Total</p>
                <p className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">₹{grandTotal.toLocaleString('en-IN')}</p>
              </div>
            </div>

            {/* Export Feedback Banner */}
            {exportFeedback && (
              <div className="bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-md animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>{exportFeedback.message}</span>
                </div>
                <button 
                  onClick={() => setExportFeedback(null)} 
                  className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-emerald-700/50 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Export Customization & Format Controls */}
            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowExportOptions(prev => !prev)}
                  className="text-xs text-indigo-700 font-bold flex items-center gap-1.5 hover:underline cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Report Customization & Layout Settings</span>
                  <span className="text-[10px] text-slate-400">({showExportOptions ? 'Hide' : 'Show'})</span>
                </button>
                <span className="text-[10.5px] text-slate-500 font-medium">
                  {isKumtluang ? 'Kumtluang Matrix Mode' : 'Standard Itemized Mode'}
                </span>
              </div>

              {/* Customization Options Box */}
              {showExportOptions && (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3 text-xs animate-fadeIn">
                  <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                    PDF & Excel Export Preferences
                  </div>
                  
                  {/* Bar Graph Toggle & Month Range Controls */}
                  <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-rose-500 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800">Thla Tin Bar Graph (Monthly Trend)</p>
                          <p className="text-[10px] text-slate-500">PDF Report leh Screen Overview chhungah Monthly Bar Chart dah / paih bo</p>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={includeMonthlyChart} 
                        onChange={(e) => setIncludeMonthlyChart(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                      />
                    </label>

                    {includeMonthlyChart && (
                      <div className="pt-2 border-t border-slate-100 pl-6 space-y-2.5">
                        <label className="text-[10.5px] font-bold text-slate-700 block">
                          Thla Tin Trend Hun Thlanna (From – Upto):
                        </label>
                        <div className="grid grid-cols-2 gap-2 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                          <div>
                            <label className="text-[10px] font-bold text-indigo-950 block mb-1">From (Start Month)</label>
                            <select
                              value={chartStartMonth}
                              onChange={(e) => setChartStartMonth(e.target.value)}
                              className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                            >
                              {ALL_MONTH_NAMES_SHORT.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-indigo-950 block mb-1">Upto (End Month)</label>
                            <select
                              value={chartEndMonth}
                              onChange={(e) => setChartEndMonth(e.target.value)}
                              className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                            >
                              {ALL_MONTH_NAMES_SHORT.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium italic">
                          * Thla khat chauh duh tan <b>From</b> leh <b>Upto</b>-ah thla ngai thlan mai tur (e.g. From: Aug, Upto: Aug)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Digital Signature Toggle */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-indigo-50/40 transition">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800">Official Digital Signatures & Seal</p>
                        <p className="text-[10px] text-slate-500">Prepared by, Verified by leh Official Organization Seal PDF-ah tarlan</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={includeSignatures} 
                      onChange={(e) => setIncludeSignatures(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {/* Print Style Selector */}
              <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    <span>🖨️ Statement Print Style Thlanna:</span>
                  </label>
                  <select
                    value={reportPrintStyle}
                    onChange={(e) => setReportPrintStyle(e.target.value as any)}
                    className="bg-white border-2 border-indigo-400 rounded-xl px-2.5 py-1.5 text-xs font-black text-indigo-950 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="standard_pdf">Standard Audit Statement (Official PDF with Chart & Seal)</option>
                    <option value="master_ledger">Format 1: Kohhran / Pawl Master Ledger (Thla 12 Grid)</option>
                    <option value="member_matrix">Format 2: Mimal Record (Horizontal Category Matrix)</option>
                    <option value="member_passbook">Format 3: Mimal Passbook (Vertical Passbook Card)</option>
                  </select>
                </div>

                {/* If personal member format selected, show Member selector */}
                {(reportPrintStyle === 'member_matrix' || reportPrintStyle === 'member_passbook') && (
                  <div className="pt-2 border-t border-indigo-200/60 flex flex-col sm:flex-row sm:items-center gap-2 animate-fadeIn">
                    <span className="text-[11px] font-bold text-indigo-900 shrink-0">Member Thlang Rawh:</span>
                    <select
                      value={reportMemberId}
                      onChange={(e) => setReportMemberId(e.target.value)}
                      className="flex-1 bg-white border border-indigo-300 rounded-xl p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      <option value="">-- Member Thlang Rawh --</option>
                      {getMembers().map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id}) {m.section ? `• ${m.section}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Export Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Formatted Excel */}
                <button
                  onClick={handleDownloadExcelFormatted}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 text-xs"
                  title="Export styled Excel workbook with formatted cells, headers, borders, and totals"
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-200" />
                  <span>Export Formatted Excel (.xls)</span>
                </button>

                {/* Plain CSV */}
                <button
                  onClick={handleDownloadCSV}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 text-xs"
                  title="Export raw CSV file for database import or simple spreadsheet viewing"
                >
                  <Download className="w-4 h-4 shrink-0 text-slate-300" />
                  <span>Export CSV (.csv)</span>
                </button>

                {/* Formatted PDF */}
                <button
                  onClick={handleDownloadPDF}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 text-xs"
                  title="Print selected report style"
                >
                  <Printer className="w-4 h-4 shrink-0 text-indigo-200" />
                  <span>
                    {reportPrintStyle === 'standard_pdf' && 'Print PDF Statement'}
                    {reportPrintStyle === 'master_ledger' && 'Print Format 1: Master Ledger'}
                    {reportPrintStyle === 'member_matrix' && 'Print Format 2: Category Matrix'}
                    {reportPrintStyle === 'member_passbook' && 'Print Format 3: Mimal Passbook'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* KUMTLUANG MATRIX TABLE VIEW */}
          {isKumtluang ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <Table className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                    Kumtluang Bawm Matrix View
                  </h3>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {onOpenMemberRoll && (
                    <button
                      onClick={() => onOpenMemberRoll('members_list')}
                      className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                      title="Open Kumtluang Member Roll & Quick Entry Portal"
                    >
                      <Users className="w-3 h-3" />
                      <span>Member Roll & Cash Entry</span>
                    </button>
                  )}
                  <button
                    onClick={toggleNameSort}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                      sortOrder === 'name-asc' || sortOrder === 'name-desc'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                    }`}
                    title="Toggle Alphabetical Name Sort (A-Z / Z-A)"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>{sortOrder === 'name-asc' ? 'Hming: A - Z' : sortOrder === 'name-desc' ? 'Hming: Z - A' : 'Sort Hming (A-Z)'}</span>
                  </button>
                  <button
                    onClick={handleDownloadExcelFormatted}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 transition cursor-pointer active:scale-95"
                    title="Download Formatted Excel (.xls) file"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                    <span>Excel (.xls)</span>
                  </button>
                  <span className="text-[9.5px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg font-bold border border-indigo-200">
                    {kumtluangMatrix.rows.length} Donors
                  </span>
                </div>
              </div>

              {kumtluangMatrix.rows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No Kumtluang donations found</p>
                  <p className="text-[10px] text-slate-400">Try adjusting the date filter or category selection.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200">
                        <th className="py-2.5 px-3 border-r border-slate-200">
                          <button
                            onClick={toggleNameSort}
                            className="flex items-center gap-1.5 font-black text-slate-900 hover:text-indigo-600 transition cursor-pointer"
                            title="Click to sort by donor name"
                          >
                            <span>Hming (Donor)</span>
                            {sortOrder === 'name-asc' ? (
                              <ArrowUp className="w-3 h-3 text-indigo-600" />
                            ) : sortOrder === 'name-desc' ? (
                              <ArrowDown className="w-3 h-3 text-indigo-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-2.5 text-center border-r border-slate-200 whitespace-nowrap text-[10px] font-bold text-slate-600">
                          Mode
                        </th>
                        {kumtluangMatrix.categories.map((h) => (
                          <th key={h} className="py-2.5 px-2.5 text-right border-r border-slate-200 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right bg-indigo-100 text-indigo-950 font-black">
                          Total
                        </th>
                        <th className="py-2.5 px-2.5 text-center bg-slate-100 text-slate-700 font-black">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                      {kumtluangMatrix.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-200">
                            {row.donorName}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200 whitespace-nowrap">
                            {row.paymentMethodLabel === 'CASH' ? (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8.5px] font-bold px-1.5 py-0.5 rounded">💵 Cash</span>
                            ) : row.paymentMethodLabel === 'ONLINE' ? (
                              <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[8.5px] font-bold px-1.5 py-0.5 rounded">⚡ Online</span>
                            ) : (
                              <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[8px] font-bold px-1.5 py-0.5 rounded">⚡+💵 Mix</span>
                            )}
                          </td>
                          {kumtluangMatrix.categories.map((h) => (
                            <td key={h} className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                              {row.categoryAmounts[h] ? row.categoryAmounts[h].toLocaleString('en-IN') : '0'}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-black font-mono text-indigo-900 bg-indigo-50/50">
                            {row.total.toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <button
                              onClick={() => handleEditDonorRow(row.donorName)}
                              className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 mx-auto cursor-pointer border border-indigo-200 shadow-2xs"
                              title="Mimal Categories an pek dan siamtha rawh"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs">
                        <td className="py-2.5 px-3 uppercase tracking-wider">Total</td>
                        <td className="py-2.5 px-2 text-center text-[9px] text-slate-400 font-semibold border-r border-slate-800">ALL</td>
                        {kumtluangMatrix.categories.map((h) => (
                          <td key={h} className="py-2.5 px-2.5 text-right font-mono text-amber-300">
                            {kumtluangMatrix.columnTotals[h]?.toLocaleString('en-IN') || '0'}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 bg-slate-950 font-black text-sm">
                          ₹{kumtluangMatrix.grandTotal.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2.5 bg-slate-950"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* STANDARD DETAILED TRANSACTIONS LIST VIEW */
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                    Transaction Records ({sortedTransactions.length})
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleNameSort}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                      sortOrder === 'name-asc' || sortOrder === 'name-desc'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                    }`}
                    title="Toggle Alphabetical Name Sort (A-Z / Z-A)"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>{sortOrder === 'name-asc' ? 'Hming: A - Z' : sortOrder === 'name-desc' ? 'Hming: Z - A' : 'Sort Hming (A-Z)'}</span>
                  </button>
                  <button
                    onClick={handleDownloadExcelFormatted}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-300 flex items-center gap-1 transition cursor-pointer active:scale-95"
                    title="Download Formatted Excel (.xls) file"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                    <span>Excel (.xls)</span>
                  </button>
                  <span className="text-[9.5px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold">
                    Live Audit
                  </span>
                </div>
              </div>

              {sortedTransactions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">No transactions match your filters</p>
                  <p className="text-[10px] text-slate-400">Try selecting a different date range or category.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedTransactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="p-3 rounded-2xl border border-slate-200/90 bg-slate-50/80 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition text-xs space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-slate-900 text-xs">
                            {tx.isAnonymous ? 'Anonymous Donor' : tx.donorName}
                          </span>
                          <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            tx.category === 'ralna' ? 'bg-slate-900 text-white' :
                            tx.category === 'khawlsak' ? 'bg-emerald-100 text-emerald-800' :
                            tx.category === 'rikrum' ? 'bg-rose-100 text-rose-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {tx.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-xs">
                            ₹{tx.amount.toLocaleString('en-IN')}
                          </span>
                          <button
                            onClick={() => setEditingTransaction(tx)}
                            className="p-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="Edit transaction / categories"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-category breakdown summary if exists */}
                      {tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0 && (
                        <div className="flex flex-wrap gap-1 bg-white p-1.5 rounded-xl border border-slate-200 text-[10px]">
                          {Object.entries(tx.subCategoryBreakdown).map(([cat, amt]) => (
                            <span key={cat} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                              {cat}: <span className="font-mono text-indigo-700">₹{amt}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Remark if present (Compact space-saving inline) */}
                      {tx.remark && (
                        <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded-lg border border-slate-200/80 text-[10px] text-slate-600">
                          <MessageSquare className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                          <span className="font-semibold text-slate-700">Remark:</span>
                          <span className="italic truncate">{tx.remark}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <div className="flex items-center gap-1.5 truncate max-w-[220px]">
                          <span className="truncate">{tx.campaignTitle}</span>
                          {tx.periodLabel && (
                            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                              📅 {tx.periodLabel}
                            </span>
                          )}
                        </div>
                        <span>{formatDateTimeDDMMYYYY(tx.timestamp)}</span>
                      </div>

                      <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 border-t border-slate-200/60 font-mono">
                        <span>ID: {tx.id}</span>
                        <div className="flex items-center gap-1.5">
                          {tx.paymentMethod === 'online' ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                              <Zap className="w-2 h-2 text-amber-500" />Online
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[8.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                              <Banknote className="w-2 h-2 text-emerald-600" />Cash
                            </span>
                          )}
                          <span className="text-slate-400 font-bold">• {tx.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* TRANSACTION & CATEGORY BREAKDOWN EDIT MODAL */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          campaigns={campaigns}
          onClose={() => setEditingTransaction(null)}
          onSave={(updatedTx) => {
            if (onUpdateTransaction) {
              onUpdateTransaction(updatedTx);
            }
            setEditingTransaction(null);
          }}
          onDelete={(id) => {
            if (onDeleteTransaction) {
              onDeleteTransaction(id);
            }
            setEditingTransaction(null);
          }}
        />
      )}
    </div>
  );
};

/* -------------------------------------------------------------
   SUB-COMPONENT: EDIT TRANSACTION & CATEGORY BREAKDOWN MODAL
-------------------------------------------------------------- */
interface EditTransactionModalProps {
  transaction: Transaction;
  campaigns: Campaign[];
  onClose: () => void;
  onSave: (updated: Transaction) => void;
  onDelete: (id: string) => void;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  campaigns,
  onClose,
  onSave,
  onDelete,
}) => {
  const [donorName, setDonorName] = useState<string>(transaction.donorName || '');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(transaction.isAnonymous || false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>(transaction.paymentMethod || 'online');
  const [status, setStatus] = useState<'completed' | 'pending_verification'>(transaction.status || 'completed');
  const [remark, setRemark] = useState<string>(transaction.remark || '');
  
  // Breakdown state
  const campaign = campaigns.find(c => c.id === transaction.campaignId);
  const defaultCategories = campaign?.subCategories && campaign.subCategories.length > 0 
    ? campaign.subCategories 
    : ['Pathian Ram', 'Mission', 'Building Fund'];

  const initialBreakdown: { [key: string]: number } = transaction.subCategoryBreakdown || {
    [defaultCategories[0]]: transaction.amount || 0
  };

  const [breakdown, setBreakdown] = useState<{ [key: string]: number }>(initialBreakdown);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatAmount, setNewCatAmount] = useState<string>('');
  
  // Non-Kumtluang flat amount
  const [flatAmount, setFlatAmount] = useState<string>(transaction.amount.toString());

  const isKumtluang = transaction.category === 'kumtluang';

  const handleAmountChange = (catName: string, val: string) => {
    const num = parseFloat(val) || 0;
    setBreakdown(prev => ({
      ...prev,
      [catName]: num
    }));
  };

  const handleRemoveCategory = (catName: string) => {
    const next = { ...breakdown };
    delete next[catName];
    setBreakdown(next);
  };

  const handleAddCategory = () => {
    if (newCatName.trim()) {
      const num = parseFloat(newCatAmount) || 0;
      setBreakdown(prev => ({
        ...prev,
        [newCatName.trim()]: num
      }));
      setNewCatName('');
      setNewCatAmount('');
    }
  };

  // Calculate current subtotal
  const currentSubtotal: number = isKumtluang
    ? (Object.values(breakdown) as number[]).reduce((sum: number, v: number) => sum + (Number(v) || 0), 0)
    : (parseFloat(flatAmount) || 0);

  const platformFee: number = Math.round(currentSubtotal * 0.01);
  const totalAmount: number = currentSubtotal + platformFee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentSubtotal <= 0) {
      alert('Pek zat (Amount) hi ₹0 aia tam a ni tur a ni.');
      return;
    }

    const updated: Transaction = {
      ...transaction,
      donorName: donorName.trim(),
      isAnonymous: isAnonymous,
      amount: currentSubtotal,
      platformFee: platformFee,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      status: status,
      remark: remark.trim() || undefined,
      subCategoryBreakdown: isKumtluang ? breakdown : undefined,
    };

    onSave(updated);
  };

  const handleDeleteClick = () => {
    if (window.confirm(`I chiang maw? He transaction (Donor: ${transaction.donorName}, Amount: ₹${transaction.amount}) hi paih hlen a ni dawn e.`)) {
      onDelete(transaction.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 my-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Mimal Donation Siamthatna</h3>
              <p className="text-[10px] text-slate-500 font-medium font-mono">ID: {transaction.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Donor Name */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Petu Hming (Donor Name) *</label>
            <input
              type="text"
              required
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>

          {/* Anonymous toggle */}
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span>Hming thup (Anonymous Donation)</span>
          </label>

          {/* KUMTLUANG SUB-CATEGORIES ALLOCATION */}
          {isKumtluang ? (
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-2.5">
              <div className="flex items-center justify-between border-b border-blue-200 pb-1.5">
                <span className="text-[11px] font-black text-blue-950 uppercase tracking-wider">
                  Mimal Categories an pek dan (Breakdown)
                </span>
                <span className="text-[10px] font-black text-blue-700">
                  Subtotal: ₹{currentSubtotal.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Rows of categories */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {Object.entries(breakdown).map(([catName, amt]) => (
                  <div key={catName} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-blue-200">
                    <span className="flex-1 font-bold text-slate-900 truncate text-[11px]">{catName}</span>
                    <div className="flex items-center gap-1 w-28 shrink-0">
                      <span className="text-slate-500 font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={amt === 0 ? '' : amt}
                        onChange={(e) => handleAmountChange(catName, e.target.value)}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-right text-slate-900 text-xs focus:bg-white focus:border-indigo-600"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(catName)}
                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      title="Remove head"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add category head */}
              <div className="flex gap-1.5 pt-1.5 border-t border-blue-200">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category Head thar..."
                  className="flex-1 bg-white border border-blue-300 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-900"
                />
                <input
                  type="number"
                  value={newCatAmount}
                  onChange={(e) => setNewCatAmount(e.target.value)}
                  placeholder="Amount ₹"
                  className="w-24 bg-white border border-blue-300 rounded-xl px-2 py-1.5 text-xs font-mono font-bold text-right"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Belh
                </button>
              </div>
            </div>
          ) : (
            /* Flat amount for Ralna, Khawlsak, Rikrum */
            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Pek Zat (Amount ₹) *</label>
              <input
                type="number"
                required
                value={flatAmount}
                onChange={(e) => setFlatAmount(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>
          )}

          {/* Payment Method & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Payment Mode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900"
              >
                <option value="online">Online UPI</option>
                <option value="cash">Cash Counter</option>
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900"
              >
                <option value="completed">Completed</option>
                <option value="pending_verification">Pending Verification</option>
              </select>
            </div>
          </div>

          {/* Remark / Note field */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Remark / Note (Duham tan)</label>
            <input
              type="text"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Cash pek fel a ni / Thla tin thawh..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-medium text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>

          {/* Total calculations badge */}
          <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Calculated Total:</span>
            <span className="font-black font-mono text-indigo-900 text-sm">
              ₹{currentSubtotal.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Actions: Save & Delete */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save Siamthatna
              </button>
            </div>

            <button
              type="button"
              onClick={handleDeleteClick}
              className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1 border border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" /> He Transaction Record hi paih rawh (Delete)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
