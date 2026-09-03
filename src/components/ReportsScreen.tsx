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
  TargetExportInfo,
  GroupedDonorRecord,
  buildGroupedDonorRecords
} from '../utils/export';
import { 
  isTransactionInPeriodFilter, 
  getTransactionMonthInfo, 
  ALL_MONTH_NAMES_FULL 
} from '../utils/monthHelper';
import { 
  getMembers, 
  deleteMember,
  isCampaignCreator, 
  saveTransaction, 
  deleteStoredTransaction, 
  DEFAULT_INITIAL_CREATOR, 
  saveStoredCreatorProfile,
  updateDonorTransactions,
  saveMultipleTransactions,
  deleteMultipleTransactions
} from '../utils/storage';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, getCurrentMonthStartString, getCurrentMonthEndString } from '../utils/date';
import { DonorPaymentsEditorModal } from './DonorPaymentsEditorModal';

interface ReportsScreenProps {
  transactions: Transaction[];
  campaigns: Campaign[];
  creatorProfile: CreatorProfile;
  onBack: () => void;
  onOpenLogin?: () => void;
  onOpenCreateQR?: () => void;
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
  onOpenCreateQR,
  onUpdateCampaign,
  onUpdateTransaction,
  onDeleteTransaction,
  onOpenImagePreview,
  onOpenMemberRoll,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc'>('date-desc');
  
  // Transaction Editing State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Grouping & Display States (Defaults to Grouped by Donor as requested)
  const [groupByDonor, setGroupByDonor] = useState<boolean>(true);
  const [showDateTime, setShowDateTime] = useState<boolean>(true);

  // Multi-Month Donor Payments Editing Modal State
  const [donorPaymentsModalData, setDonorPaymentsModalData] = useState<{
    donorName: string;
    donorMemberId?: string;
    donorPhone?: string;
    donorSection?: string;
    transactions: Transaction[];
  } | null>(null);
  
  // CSV / Excel Export Feedback Toast State
  const [exportFeedback, setExportFeedback] = useState<{ message: string; count: number } | null>(null);

  // PDF & Report Customization State
  const [includeMonthlyChart, setIncludeMonthlyChart] = useState<boolean>(true);
  const [chartStartMonth, setChartStartMonth] = useState<string>('Jan');
  const [chartEndMonth, setChartEndMonth] = useState<string>('Dec');
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
  const isCreator = Boolean(creatorProfile && (creatorProfile.isApproved || creatorProfile.phone || creatorProfile.isAdmin));

  // Filter campaigns strictly owned/created by this creator (no cross-creator leakage)
  const creatorCampaigns = useMemo(() => {
    if (!isCreator) return [];
    if (creatorProfile.isAdmin) return campaigns;
    return campaigns.filter(c => isCampaignCreator(c, creatorProfile));
  }, [campaigns, isCreator, creatorProfile]);

  const creatorCampaignIds = useMemo(() => {
    return new Set(creatorCampaigns.map(c => c.id));
  }, [creatorCampaigns]);

  // Available campaigns for selector based on creator scope
  const availableCampaigns = useMemo(() => {
    if (!isCreator) return [];
    return creatorCampaigns.filter(c => selectedFilter === 'all' || c.category === selectedFilter);
  }, [isCreator, creatorCampaigns, selectedFilter]);

  // Available periods list for filter dropdown (All months, quarters, years, custom labels)
  const availablePeriodOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    
    const monthlyList: { value: string; label: string }[] = [];
    ALL_MONTH_NAMES_FULL.forEach(m => {
      monthlyList.push({
        value: `${m} ${currentYear}`,
        label: `📅 ${m} ${currentYear}`,
      });
    });

    const quartersList = [
      { value: `Q1 ${currentYear}`, label: `📊 Q1 (Jan - Mar) ${currentYear}` },
      { value: `Q2 ${currentYear}`, label: `📊 Q2 (Apr - Jun) ${currentYear}` },
      { value: `Q3 ${currentYear}`, label: `📊 Q3 (Jul - Sep) ${currentYear}` },
      { value: `Q4 ${currentYear}`, label: `📊 Q4 (Oct - Dec) ${currentYear}` },
    ];

    const yearsList = years.map(yr => ({
      value: `${yr}`,
      label: `🗓️ ${yr} Full Year (Kumtluan)`,
    }));

    const customList: { value: string; label: string }[] = [];
    transactions.forEach(t => {
      if (t.periodLabel && t.periodLabel.trim()) {
        const val = t.periodLabel.trim();
        const exists = monthlyList.some(o => o.value.toLowerCase() === val.toLowerCase()) ||
          quartersList.some(o => o.value.toLowerCase() === val.toLowerCase()) ||
          yearsList.some(o => o.value.toLowerCase() === val.toLowerCase()) ||
          customList.some(o => o.value.toLowerCase() === val.toLowerCase());
        if (!exists) {
          customList.push({
            value: val,
            label: `🏷️ ${val}`,
          });
        }
      }
    });

    return {
      monthlyList,
      quartersList,
      yearsList,
      customList,
    };
  }, [transactions]);

  // Filter transactions: STRICT CREATOR ONLY ACCESS (Strict user-isolation)
  const filteredTransactions = useMemo(() => {
    if (!isCreator) return [];

    return transactions.filter(t => {
      // 1. Creator Security Barrier: Only show transactions belonging to Creator's own verified campaigns
      if (!creatorProfile.isAdmin) {
        if (creatorCampaignIds.size > 0 && !creatorCampaignIds.has(t.campaignId)) {
          return false;
        }
      }

      // 2. Category filter
      if (selectedFilter !== 'all') {
        if (t.category !== selectedFilter) return false;
      }

      // 3. Specific Campaign sub-filter
      if (selectedCampaignId !== 'all') {
        if (t.campaignId !== selectedCampaignId) return false;
      }

      // 4. Period / Month filter (using robust month, quarter, year, and label matching)
      if (selectedPeriodFilter !== 'all') {
        if (!isTransactionInPeriodFilter(t, selectedPeriodFilter)) {
          return false;
        }
      }

      // 5. Date range filter (only applied when startDate or endDate is explicitly set)
      if (startDate || endDate) {
        const txDate = t.timestamp.slice(0, 10);
        if (startDate && txDate < startDate) return false;
        if (endDate && txDate > endDate) return false;
      }

      // 6. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (t.campaignTitle || '').toLowerCase().includes(q);
        const matchesDonor = (t.donorName || '').toLowerCase().includes(q);
        const matchesId = (t.id || '').toLowerCase().includes(q);
        const matchesPeriod = isTransactionInPeriodFilter(t, q);
        if (!matchesTitle && !matchesDonor && !matchesId && !matchesPeriod) return false;
      }

      return true;
    });
  }, [transactions, isCreator, creatorProfile, creatorCampaignIds, selectedFilter, selectedCampaignId, selectedPeriodFilter, startDate, endDate, searchQuery]);

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

  // Selected campaign display name
  const selectedCampaignObj = creatorCampaigns.find(c => c.id === selectedCampaignId);
  const currentCampaignDisplayName = selectedCampaignObj 
    ? selectedCampaignObj.title 
    : (selectedFilter === 'all' ? 'All My Campaigns' : `${selectedFilter.toUpperCase()} BAWM (All My Campaigns)`);

  // Kumtluang matrix computation (Hming | Cat1 | Cat2 | Cat3 | Total)
  const isKumtluang = selectedFilter === 'kumtluang';
  const kumtluangMatrix = useMemo(() => {
    return buildKumtluangMatrix(filteredTransactions, sortOrder, selectedCampaignObj?.subCategories);
  }, [filteredTransactions, sortOrder, selectedCampaignObj?.subCategories]);

  // Grouped donor records computation (Mi pakhat tlar khatah belhkhawm)
  const groupedDonorRecords = useMemo(() => {
    return buildGroupedDonorRecords(sortedTransactions, sortOrder);
  }, [sortedTransactions, sortOrder]);

  // Scoped members for the current selected campaign
  const scopedMembers = useMemo(() => {
    return getMembers(selectedCampaignId);
  }, [selectedCampaignId]);

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
    // 1. When a specific campaign is selected (selectedCampaignId !== 'all')
    if (selectedCampaignId !== 'all') {
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
      // If the selected specific campaign has no target configured, DO NOT show/mix targets from other campaigns!
      return null;
    }

    // 2. Only when "All My Campaigns in this Bawm" is selected (selectedCampaignId === 'all')
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
  }, [selectedCampaignId, selectedCampaignObj, grandTotal, selectedFilter, creatorCampaigns, filteredTransactions]);

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

    const targetMembers = scopedMembers.length > 0 ? scopedMembers : getMembers(selectedCampaignId);
    const resolvedOrgName = selectedCampaignObj?.orgName || selectedCampaignObj?.title || creatorProfile.orgName || creatorProfile.name || 'RonPay Organization';
    const resolvedLogoUrl = activeCampaignImage || creatorProfile.logoUrl;
    const resolvedLocation = headerLocation;

    if (reportPrintStyle === 'master_ledger') {
      exportMasterLedgerPrint(
        targetMembers, 
        filteredTransactions, 
        selectedCampaignObj?.title || headerTitle, 
        resolvedOrgName,
        resolvedLogoUrl,
        resolvedLocation
      );
      showExportSuccessToast('Format 1: Master Ledger (12-Thla Grid)', targetMembers.length);
      return;
    }

    if (reportPrintStyle === 'member_matrix') {
      const targetMemberId = reportMemberId || (targetMembers.length > 0 ? targetMembers[0].id : '');
      if (!targetMemberId) {
        alert('Khawngaihin Member hming i register hmasa rawh le.');
        return;
      }
      const m = targetMembers.find(x => x.id === targetMemberId) || targetMembers[0];
      const defaultCategories = selectedCampaignObj?.subCategories && selectedCampaignObj.subCategories.length > 0
        ? selectedCampaignObj.subCategories
        : (kumtluangMatrix.categories.length > 0 ? kumtluangMatrix.categories : ['General Collection']);
      if (m) {
        exportMemberCategoryMatrixPrint(
          m, 
          defaultCategories, 
          filteredTransactions, 
          resolvedOrgName,
          resolvedLogoUrl,
          resolvedLocation
        );
        showExportSuccessToast(`Format 3: Category Matrix (${m.name})`, 1);
      }
      return;
    }

    if (reportPrintStyle === 'member_passbook') {
      const targetMemberId = reportMemberId || (targetMembers.length > 0 ? targetMembers[0].id : '');
      if (!targetMemberId) {
        alert('Khawngaihin Member hming i register hmasa rawh le.');
        return;
      }
      const m = targetMembers.find(x => x.id === targetMemberId) || targetMembers[0];
      const defaultCategories = selectedCampaignObj?.subCategories && selectedCampaignObj.subCategories.length > 0
        ? selectedCampaignObj.subCategories
        : (kumtluangMatrix.categories.length > 0 ? kumtluangMatrix.categories : ['General Collection']);
      if (m) {
        exportMemberPassbookVerticalPrint(
          m, 
          defaultCategories, 
          filteredTransactions, 
          resolvedOrgName,
          resolvedLogoUrl,
          resolvedLocation
        );
        showExportSuccessToast(`Format 4: Mimal Passbook (${m.name})`, 1);
      }
      return;
    }

    // Default Standard PDF Statement
    if (sortedTransactions.length === 0) {
      alert('⚠️ He filter-ah hian transaction hmuh tur a awm rih lo.');
      return;
    }
    printTransactionsPDF(
      sortedTransactions, 
      `${headerTitle} - Financial Audit Statement`, 
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
        targetInfo: activeTargetInfo || undefined,
        groupByDonor,
        showDateTime,
        members: scopedMembers
      }
    );
    showExportSuccessToast('Format 1: Official Financial Statement PDF', sortedTransactions.length);
  };

  const toggleNameSort = () => {
    setSortOrder(prev => prev === 'name-asc' ? 'name-desc' : 'name-asc');
  };

  // State for deleting entire donor's record from Matrix
  const [deletingDonorInfo, setDeletingDonorInfo] = useState<{ donorName: string; total: number; txCount: number } | null>(null);

  // Open Multi-Month / Multi-Payment Donor Editor Modal
  const handleEditDonorRow = (donorName: string) => {
    const txs = filteredTransactions.filter(t => (t.donorName || '').toLowerCase().trim() === donorName.toLowerCase().trim());
    if (txs.length > 0) {
      const member = scopedMembers.find(m => m.name.toLowerCase().trim() === donorName.toLowerCase().trim());
      const firstTx = txs[0];
      setDonorPaymentsModalData({
        donorName: firstTx.donorName || donorName,
        donorMemberId: member?.id || firstTx.memberId,
        donorPhone: member?.phoneLast4 || member?.fullPhone || firstTx.donorPhone,
        donorSection: member?.section || firstTx.donorVeng,
        transactions: txs,
      });
    } else {
      alert('Transaction record hmuh a ni lo.');
    }
  };

  // Save all donor transactions from DonorPaymentsEditorModal
  const handleSaveAllDonorPayments = (updatedTxs: Transaction[], deletedIds: string[]) => {
    updateDonorTransactions(
      donorPaymentsModalData?.donorName || '',
      updatedTxs,
      deletedIds
    );
    // Notify parent handlers for live state sync
    if (deletedIds && deletedIds.length > 0 && onDeleteTransaction) {
      deletedIds.forEach(id => onDeleteTransaction(id));
    }
    if (updatedTxs && updatedTxs.length > 0 && onUpdateTransaction) {
      updatedTxs.forEach(tx => onUpdateTransaction(tx));
    }
    setDonorPaymentsModalData(null);
    showExportSuccessToast(`Siamthatna hlawhtling ta! (${updatedTxs.length} records updated)`, updatedTxs.length);
  };

  const handleDeleteDonorRow = (donorName: string, total: number) => {
    const txs = filteredTransactions.filter(t => t.donorName === donorName);
    setDeletingDonorInfo({ donorName, total, txCount: txs.length });
  };

  const handleConfirmDeleteDonorTxs = () => {
    if (!deletingDonorInfo) return;
    const cleanName = (deletingDonorInfo.donorName || '').toLowerCase().trim();
    const txs = filteredTransactions.filter(t => (t.donorName || '').toLowerCase().trim() === cleanName);
    deleteMultipleTransactions(txs.map(t => t.id));
    
    // Also clean up any member record with matching name or memberId if present
    const matchingMem = scopedMembers.find(m => (m.name || '').toLowerCase().trim() === cleanName);
    if (matchingMem) {
      deleteMember(matchingMem.id, selectedCampaignId !== 'all' ? selectedCampaignId : undefined);
    }
    
    if (onDeleteTransaction) {
      txs.forEach(t => onDeleteTransaction(t.id));
    }
    setDeletingDonorInfo(null);
    showExportSuccessToast(`"${deletingDonorInfo.donorName}" record leh transactions chu paih bo fel a ni ta!`, txs.length);
  };

  return (
    <div className="space-y-4 pb-1 animate-fadeIn">
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

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={onOpenLogin}
              className="bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer"
            >
              Creator Login / Verify Account
            </button>
            <button
              onClick={() => {
                saveStoredCreatorProfile(DEFAULT_INITIAL_CREATOR);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-4 py-2.5 rounded-xl text-xs border border-amber-400/40 transition cursor-pointer"
            >
              ✨ Quick Login as Demo Creator (BCM Ebenezer)
            </button>
          </div>
        </div>
      ) : creatorCampaigns.length === 0 ? (
        /* Authenticated Creator with 0 Campaigns */
        <div className="space-y-4">
          {/* Creator Scope Info Badge */}
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700" />
              <div>
                <span className="font-black text-emerald-950">{creatorProfile.name}</span>
                <p className="text-[10px] text-emerald-700 font-medium">
                  {creatorProfile.orgName} ({creatorProfile.phone}) • 0 Active Campaigns
                </p>
              </div>
            </div>
            <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-md border border-emerald-300 uppercase">
              Verified Creator Access
            </span>
          </div>

          <div className="bg-white border border-slate-200/90 p-8 sm:p-12 rounded-3xl text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto border border-indigo-100 shadow-inner">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                No Campaigns Found
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                I account hnuaiah hian QR Campaign / Post siam a la awm lo a, midang campaign leh sum luh dan record-te chu privacy vawn him nan a lang lo a ni. Campaign thar i siam veleh a report leh matrix hi a rawn lang nghal ang.
              </p>
            </div>
            {onOpenCreateQR && (
              <div className="pt-2">
                <button
                  onClick={onOpenCreateQR}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition cursor-pointer active:scale-95 inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create QR / Campaign Thar</span>
                </button>
              </div>
            )}
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
                  {availableCampaigns.length === 0 ? (
                    <option value="none" disabled>No {selectedFilter.toUpperCase()} campaigns created</option>
                  ) : (
                    <>
                      <option value="all">All My Campaigns in this Bawm ({availableCampaigns.length})</option>
                      {availableCampaigns.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.title} {c.targetAmount && c.targetAmount > 0 ? `(🎯 Target: ₹${c.targetAmount.toLocaleString('en-IN')}${c.targetPeriod === 'monthly' ? '/thla' : c.targetPeriod === 'yearly' ? '/kum' : ''})` : ''}
                        </option>
                      ))}
                    </>
                  )}
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
                  <option value="all">🌟 All Months & Periods (Zawng zawng)</option>
                  <optgroup label="Thla tin (Monthly Selection)">
                    {availablePeriodOptions.monthlyList.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Quarters (Thla 3 dan zela pek)">
                    {availablePeriodOptions.quartersList.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Kumtluan (Full Year)">
                    {availablePeriodOptions.yearsList.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  {availablePeriodOptions.customList.length > 0 && (
                    <optgroup label="Other / Custom Records">
                      {availablePeriodOptions.customList.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </optgroup>
                  )}
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

            {/* Date pickers with quick presets */}
            <div className="space-y-1.5">
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

              {/* Quick Date Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setSelectedPeriodFilter('all');
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                    !startDate && !endDate && selectedPeriodFilter === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  🌟 All Time
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartDate(getCurrentMonthStartString());
                    setEndDate(getCurrentMonthEndString());
                  }}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                    startDate === getCurrentMonthStartString() && endDate === getCurrentMonthEndString()
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  📅 This Month
                </button>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                  >
                    ✕ Clear Date
                  </button>
                )}
              </div>
            </div>

            {availableCampaigns.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200/90 p-8 rounded-2xl text-center space-y-2.5">
                <Receipt className="w-8 h-8 mx-auto text-slate-400" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  He Category ({selectedFilter.toUpperCase()}) Ah Hian Campaign I La Siam Lo
                </h4>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Category dang thlang rawh le, emaw he category pual hian Create QR screen atangin QR thar siam rawh le.
                </p>
                {onOpenCreateQR && (
                  <button
                    onClick={onOpenCreateQR}
                    className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1 cursor-pointer transition shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" /> + Create {selectedFilter.toUpperCase()} QR
                  </button>
                )}
              </div>
            ) : (
              <>

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
                  <div className="flex items-start sm:items-center justify-between sm:justify-start gap-2 min-w-0">
                    <div className="flex items-start sm:items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0 mt-0.5 sm:mt-0">
                        <BarChart3 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs text-white font-black">Thla Tin Trend</span>
                          <span className="text-[8.5px] sm:text-[9px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30 whitespace-nowrap">
                            {monthlyDistribution.months.length === 1 
                              ? `${monthlyDistribution.months[0]} Chauh` 
                              : `${monthlyDistribution.months[0]} – ${monthlyDistribution.months[monthlyDistribution.months.length - 1]} (${monthlyDistribution.months.length} Thla)`}
                          </span>
                        </div>
                        <p className="text-[9.5px] text-indigo-300/80 font-medium truncate">
                          Peak: <b className="text-amber-300">₹{monthlyDistribution.maxVal.toLocaleString('en-IN')}</b> • PDF & Screen
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Clean From - Upto Month Selectors, Quick Presets & Paih Button */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-between sm:justify-end text-xs">
                    {/* Quick 1-Click Range Presets */}
                    <div className="flex items-center gap-1 bg-slate-900/90 border border-indigo-500/30 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => { setChartStartMonth('Jan'); setChartEndMonth('Dec'); }}
                        className={`text-[9.5px] px-2 py-1 rounded-lg font-black transition cursor-pointer ${
                          chartStartMonth === 'Jan' && chartEndMonth === 'Dec'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Jan – Dec (Calendar Year - Default)"
                      >
                        Jan–Dec (Default)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setChartStartMonth('Apr'); setChartEndMonth('Mar'); }}
                        className={`text-[9.5px] px-2 py-1 rounded-lg font-black transition cursor-pointer ${
                          chartStartMonth === 'Apr' && chartEndMonth === 'Mar'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title="Apr – Mar (Financial Year)"
                      >
                        Apr–Mar (Fin Year)
                      </button>
                    </div>

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
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="text-[10.5px] font-bold text-slate-700 block">
                            Thla Tin Trend Hun Thlanna (From – Upto):
                          </label>
                          {/* Quick Range Presets */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => { setChartStartMonth('Jan'); setChartEndMonth('Dec'); }}
                              className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                                chartStartMonth === 'Jan' && chartEndMonth === 'Dec'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              Jan–Dec (Default)
                            </button>
                            <button
                              type="button"
                              onClick={() => { setChartStartMonth('Apr'); setChartEndMonth('Mar'); }}
                              className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                                chartStartMonth === 'Apr' && chartEndMonth === 'Mar'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              Apr–Mar (Fin Year)
                            </button>
                          </div>
                        </div>
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

                  {/* Group By Donor Option (Format 1) */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-indigo-50/40 transition">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800">Mi pakhat tlar khatah belhkhawm (Group by Donor)</p>
                        <p className="text-[10px] text-slate-500">Mi pakhatin vawi tam tak a pek pawhin PDF-ah tlar khatah a total tarlanna</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={groupByDonor} 
                      onChange={(e) => setGroupByDonor(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </label>

                  {/* Show Date and Time Option */}
                  <label className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:bg-indigo-50/40 transition">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800">Date & Hun Column Tarlan (Show Date / Time)</p>
                        <p className="text-[10px] text-slate-500">PDF table-ah Date & Time / Thla pek hun column dah lan duh tan</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={showDateTime} 
                      onChange={(e) => setShowDateTime(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </label>

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
                    onChange={(e) => {
                      const style = e.target.value as any;
                      setReportPrintStyle(style);
                      if ((style === 'member_matrix' || style === 'member_passbook') && !reportMemberId) {
                        const mList = scopedMembers.length > 0 ? scopedMembers : getMembers(selectedCampaignId);
                        if (mList.length > 0) setReportMemberId(mList[0].id);
                      }
                    }}
                    className="bg-white border-2 border-indigo-400 rounded-xl px-2.5 py-1.5 text-xs font-black text-indigo-950 focus:outline-none focus:border-indigo-600 cursor-pointer"
                  >
                    <option value="standard_pdf">Format 1: Official Financial Statement (PDF + Chart + Signatures)</option>
                    <option value="master_ledger">Format 2: Kohhran / Pawl Master Ledger (Thla 12 Grid)</option>
                    <option value="member_matrix">Format 3: Mimal Record (Horizontal Category Matrix)</option>
                    <option value="member_passbook">Format 4: Mimal Passbook (Vertical Card Slip)</option>
                  </select>
                </div>

                {/* If personal member format selected, show Member selector */}
                {(reportPrintStyle === 'member_matrix' || reportPrintStyle === 'member_passbook') && (
                  <div className="pt-2 border-t border-indigo-200/60 flex flex-col sm:flex-row sm:items-center gap-2 animate-fadeIn">
                    <span className="text-[11px] font-bold text-indigo-900 shrink-0">Member Thlang Rawh:</span>
                    <select
                      value={reportMemberId || (scopedMembers.length > 0 ? scopedMembers[0].id : '')}
                      onChange={(e) => setReportMemberId(e.target.value)}
                      className="flex-1 bg-white border border-indigo-300 rounded-xl p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    >
                      {scopedMembers.length === 0 && <option value="">-- Member an la awm lo --</option>}
                      {scopedMembers.map(m => (
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

                {/* Formatted PDF / Print Preview */}
                <button
                  onClick={handleDownloadPDF}
                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md shadow-indigo-700/20 cursor-pointer active:scale-95 text-xs"
                  title="Open Print & PDF Preview with mobile zoom, WhatsApp share and PDF download"
                >
                  <Eye className="w-4 h-4 shrink-0 text-indigo-200" />
                  <span>
                    {reportPrintStyle === 'standard_pdf' && 'Preview & Print: PDF Statement'}
                    {reportPrintStyle === 'master_ledger' && 'Preview & Print: Master Ledger'}
                    {reportPrintStyle === 'member_matrix' && 'Preview & Print: Category Matrix'}
                    {reportPrintStyle === 'member_passbook' && 'Preview & Print: Mimal Passbook'}
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {availableCampaigns.length > 0 && (
        <>
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
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleEditDonorRow(row.donorName)}
                                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer border border-indigo-200 shadow-2xs"
                                title="Mimal Categories an pek dan siamtha rawh"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteDonorRow(row.donorName, row.total)}
                                className="px-1.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer border border-rose-200 shadow-2xs"
                                title="He donor record leh payment zawng zawng hi paih rawh"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" /> Paih
                              </button>
                            </div>
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
            /* STANDARD / GROUPED TRANSACTIONS VIEW */
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              {/* View Mode & Column Visibility Toolbar */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 mr-1">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                      {groupByDonor ? `Donors (${groupedDonorRecords.length})` : `Transactions (${sortedTransactions.length})`}
                    </h3>
                  </div>
                  
                  {/* Group By Donor Switcher */}
                  <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                    <button
                      onClick={() => setGroupByDonor(true)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[10.5px] transition cursor-pointer flex items-center gap-1 ${
                        groupByDonor ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Mi pakhat pek zawng zawng tlar khatah belhkhawm (Group by donor)"
                    >
                      <Users className="w-3 h-3" />
                      <span>👥 Group by Donor</span>
                    </button>
                    <button
                      onClick={() => setGroupByDonor(false)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[10.5px] transition cursor-pointer flex items-center gap-1 ${
                        !groupByDonor ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Transaction zawng zawng a mal malin tarlanna (Itemized view)"
                    >
                      <Receipt className="w-3 h-3" />
                      <span>📋 Itemized</span>
                    </button>
                  </div>

                  {/* Date Column Toggle */}
                  <button
                    onClick={() => setShowDateTime(!showDateTime)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                      showDateTime ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}
                    title="Toggle Date & Time display"
                  >
                    <Calendar className="w-3 h-3" />
                    <span>{showDateTime ? '🕒 Date: Lang' : '🕒 Date: Hliah'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
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
              ) : groupByDonor ? (
                /* GROUPED BY DONOR TABLE VIEW */
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-extrabold border-b border-slate-200 text-[11px]">
                        <th className="py-2.5 px-3 text-center w-10 border-r border-slate-200 text-slate-500">#</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">
                          <button
                            onClick={toggleNameSort}
                            className="flex items-center gap-1.5 font-black text-slate-900 hover:text-indigo-600 transition cursor-pointer"
                          >
                            <span>Petu Hming (Donor)</span>
                            {sortOrder === 'name-asc' ? (
                              <ArrowUp className="w-3 h-3 text-indigo-600" />
                            ) : sortOrder === 'name-desc' ? (
                              <ArrowDown className="w-3 h-3 text-indigo-600" />
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </th>
                        <th className="py-2.5 px-2.5 text-center border-r border-slate-200 whitespace-nowrap text-[10px] text-slate-600">Mode</th>
                        {showDateTime && (
                          <th className="py-2.5 px-3 border-r border-slate-200 text-slate-700 whitespace-nowrap text-[10.5px]">
                            Date / Thla Pek Zat
                          </th>
                        )}
                        <th className="py-2.5 px-3 border-r border-slate-200 text-slate-700 text-[10.5px]">
                          Hman Chhan / Breakdown
                        </th>
                        <th className="py-2.5 px-3 text-right bg-indigo-100 text-indigo-950 font-black whitespace-nowrap text-xs">
                          Total (₹)
                        </th>
                        <th className="py-2.5 px-2.5 text-center bg-slate-100 text-slate-700 font-black text-[10.5px] w-24">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-700 text-xs">
                      {groupedDonorRecords.map((row, idx) => {
                        const member = scopedMembers.find(m => m.name.toLowerCase().trim() === row.donorName.toLowerCase().trim());
                        const displayVeng = row.donorSection || member?.section;
                        const displayId = row.donorMemberId || member?.id;

                        return (
                          <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="py-2.5 px-3 text-center font-mono text-[10px] text-slate-400 border-r border-slate-200">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 border-r border-slate-200">
                              <div className="font-bold text-slate-900">{row.donorName}</div>
                              {(displayVeng || displayId) && (
                                <div className="text-[10px] text-slate-500 font-normal">
                                  {displayVeng && <span>{displayVeng}</span>}
                                  {displayVeng && displayId && <span> • </span>}
                                  {displayId && <span className="font-mono text-indigo-600 font-bold">#{displayId}</span>}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-2 text-center border-r border-slate-200 whitespace-nowrap">
                              {row.paymentMethodLabel === 'CASH' ? (
                                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded">💵 Cash</span>
                              ) : row.paymentMethodLabel === 'ONLINE' ? (
                                <span className="bg-indigo-100 text-indigo-900 border border-indigo-200 text-[9px] font-bold px-1.5 py-0.5 rounded">⚡ Online</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-800 border border-slate-300 text-[8.5px] font-bold px-1.5 py-0.5 rounded">⚡+💵 Mix ({row.txCount || row.transactionsCount || 1})</span>
                              )}
                            </td>
                            {showDateTime && (
                              <td className="py-2.5 px-3 border-r border-slate-200 text-[11px] text-slate-600">
                                {Array.isArray(row.datesPaid) && row.datesPaid.length > 0 && (
                                  <div className="font-mono text-[10px] text-slate-500">{row.datesPaid.join(', ')}</div>
                                )}
                                {Array.isArray(row.monthsPaid) && row.monthsPaid.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {row.monthsPaid.map((m: string) => (
                                      <span key={m} className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded text-[9px] font-bold border border-indigo-100">
                                        {m}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="py-2.5 px-3 border-r border-slate-200 text-[11px]">
                              {row.categoryBreakdown && Object.keys(row.categoryBreakdown).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(row.categoryBreakdown).map(([cat, amt]) => (
                                    <span key={cat} className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[9.5px] font-medium">
                                      {cat}: <strong className="font-mono text-slate-900">₹{Number(amt || 0).toLocaleString('en-IN')}</strong>
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-500 italic text-[10px]">General / Uncategorized</span>
                              )}
                              {Array.isArray(row.remarks) && row.remarks.length > 0 && (
                                <div className="text-[10px] text-slate-500 italic mt-0.5 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                  <span>{row.remarks.join('; ')}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black font-mono text-indigo-950 bg-indigo-50/40 text-xs">
                              ₹{row.totalAmount.toLocaleString('en-IN')}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleEditDonorRow(row.donorName)}
                                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer border border-indigo-200 shadow-2xs active:scale-95"
                                  title="Edit all payments, dates and months for this donor"
                                >
                                  <Edit3 className="w-3 h-3" /> Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteDonorRow(row.donorName, row.totalAmount)}
                                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold transition cursor-pointer border border-rose-200 shadow-2xs active:scale-95"
                                  title="Paih (Delete all payments for this donor)"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs">
                        <td colSpan={showDateTime ? 5 : 4} className="py-2.5 px-3 uppercase tracking-wider text-right">
                          GRAND TOTAL ({groupedDonorRecords.length} Donors, {sortedTransactions.length} Payments):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-emerald-400 bg-slate-950 font-black text-sm">
                          ₹{groupedDonorRecords.reduce((sum, r) => sum + r.totalAmount, 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-2 bg-slate-950"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                /* ITEMIZED INDIVIDUAL TRANSACTIONS VIEW */
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
                            onClick={() => handleEditDonorRow(tx.donorName)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-extrabold transition flex items-center gap-1 cursor-pointer border border-indigo-200 shadow-2xs active:scale-95"
                            title="Edit transaction / categories / months"
                          >
                            <Edit3 className="w-3 h-3" /> Edit
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
        </>
      )}

      {/* MULTI-MONTH & MULTI-PAYMENT DONOR EDITOR MODAL */}
      {donorPaymentsModalData && (
        <DonorPaymentsEditorModal
          donorName={donorPaymentsModalData.donorName}
          donorMemberId={donorPaymentsModalData.donorMemberId}
          donorPhone={donorPaymentsModalData.donorPhone}
          donorSection={donorPaymentsModalData.donorSection}
          transactions={donorPaymentsModalData.transactions}
          campaigns={campaigns}
          activeCampaignId={selectedCampaignId}
          onClose={() => setDonorPaymentsModalData(null)}
          onSaveAll={handleSaveAllDonorPayments}
        />
      )}

      {/* SINGLE TRANSACTION BACKUP EDIT MODAL */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          campaigns={campaigns}
          onClose={() => setEditingTransaction(null)}
          onSave={(updatedTx) => {
            saveTransaction(updatedTx);
            if (onUpdateTransaction) {
              onUpdateTransaction(updatedTx);
            }
            setEditingTransaction(null);
          }}
          onDelete={(id) => {
            deleteStoredTransaction(id);
            if (onDeleteTransaction) {
              onDeleteTransaction(id);
            }
            setEditingTransaction(null);
          }}
        />
      )}

      {/* CONFIRM DELETE DONOR'S ALL TRANSACTIONS MODAL */}
      {deletingDonorInfo && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn text-slate-800">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative my-auto text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-base font-black text-slate-900">Donor Record Paih I Chiang Em?</h3>
              <p className="text-xs text-slate-500 mt-1">
                He donor <span className="font-bold text-slate-800">"{deletingDonorInfo.donorName}"</span> record leh transaction zawng zawng ({deletingDonorInfo.txCount} record, Total ₹{deletingDonorInfo.total.toLocaleString('en-IN')}) hi database atangin paih hlen a ni dawn e.
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-left text-xs font-medium space-y-1.5">
              <div className="flex justify-between">
                <span className="text-rose-700 font-bold">Donor Hming:</span>
                <span className="font-black text-rose-950">{deletingDonorInfo.donorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-700 font-bold">Pek Zat Total:</span>
                <span className="font-black text-rose-950 font-mono">₹{deletingDonorInfo.total.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-rose-700 font-bold">Records Zat:</span>
                <span className="font-bold text-rose-900">{deletingDonorInfo.txCount} tx</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingDonorInfo(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDonorTxs}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Paih Bo Rawh</span>
              </button>
            </div>
          </div>
        </div>
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
  const initialMonthInfo = getTransactionMonthInfo(transaction);
  const [donorName, setDonorName] = useState<string>(transaction.donorName || '');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(transaction.isAnonymous || false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>((transaction.paymentMethod as any) || 'online');
  const [status, setStatus] = useState<'completed' | 'pending_verification'>((transaction.status as any) || 'completed');
  const [remark, setRemark] = useState<string>(transaction.remark || '');
  
  // Period & Month Editing States
  const [periodType, setPeriodType] = useState<string>(transaction.periodType || 'monthly');
  const [periodMonth, setPeriodMonth] = useState<string>(transaction.periodMonth || initialMonthInfo.fullMonth);
  const [periodQuarter, setPeriodQuarter] = useState<string>(
    transaction.periodMonth && transaction.periodMonth.includes('Q') ? transaction.periodMonth : 'Q1 (Jan - Mar)'
  );
  const [periodYear, setPeriodYear] = useState<string>(transaction.periodYear || initialMonthInfo.year || '2026');

  // Breakdown state
  const campaign = campaigns.find(c => c.id === transaction.campaignId);
  const campaignSubcats = campaign?.subCategories && campaign.subCategories.length > 0 
    ? campaign.subCategories 
    : [];

  const initialBreakdown: { [key: string]: number } = {};
  if (transaction.subCategoryBreakdown && Object.keys(transaction.subCategoryBreakdown).length > 0) {
    Object.entries(transaction.subCategoryBreakdown).forEach(([k, v]) => {
      initialBreakdown[k] = Number(v) || 0;
    });
  } else if (transaction.subCategory) {
    initialBreakdown[transaction.subCategory] = transaction.amount || 0;
  } else if (campaignSubcats.length > 0) {
    campaignSubcats.forEach((cat, idx) => {
      initialBreakdown[cat] = idx === 0 ? (transaction.amount || 0) : 0;
    });
  } else {
    initialBreakdown['General Collection'] = transaction.amount || 0;
  }

  // Also include any campaign defined categories that might not be in the breakdown yet with 0
  campaignSubcats.forEach(cat => {
    if (initialBreakdown[cat] === undefined) {
      initialBreakdown[cat] = 0;
    }
  });

  const [breakdown, setBreakdown] = useState<{ [key: string]: number }>(initialBreakdown);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatAmount, setNewCatAmount] = useState<string>('');
  
  // Non-Kumtluang flat amount
  const [flatAmount, setFlatAmount] = useState<string>(transaction.amount.toString());

  const isKumtluang = transaction.category === 'kumtluang';

  // Compute live computed preview label
  const livePeriodLabel = useMemo(() => {
    if (periodType === 'monthly') return `${periodMonth} ${periodYear}`;
    if (periodType === 'quarterly') return `${periodQuarter} ${periodYear}`;
    if (periodType === 'yearly') return `${periodYear} (Kumtluan)`;
    return `${periodMonth} ${periodYear}`;
  }, [periodType, periodMonth, periodQuarter, periodYear]);

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

  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (currentSubtotal <= 0) {
      const wantDelete = window.confirm('Pek zat hi ₹0 a ni a, he transaction record hi paih (delete) i duh em?');
      if (wantDelete) {
        handleConfirmDelete();
      }
      return;
    }

    // Filter out 0-amount categories from breakdown to keep data clean
    const cleanBreakdown: { [k: string]: number } = {};
    Object.entries(breakdown).forEach(([k, v]) => {
      const n = Number(v) || 0;
      if (n > 0) {
        cleanBreakdown[k] = n;
      }
    });

    const primaryCat = Object.keys(cleanBreakdown)[0] || Object.keys(breakdown)[0] || 'General';
    const finalMonth = periodType === 'monthly' ? periodMonth : periodType === 'quarterly' ? periodQuarter : 'All Months';

    const updated: Transaction = {
      ...transaction,
      donorName: donorName.trim() || 'Unknown Donor',
      isAnonymous: isAnonymous,
      amount: currentSubtotal,
      platformFee: platformFee,
      totalAmount: totalAmount,
      paymentMethod: paymentMethod,
      status: status,
      subCategory: isKumtluang ? primaryCat : transaction.subCategory,
      remark: remark.trim() || undefined,
      periodType: periodType,
      periodMonth: finalMonth,
      periodYear: periodYear,
      periodLabel: livePeriodLabel,
      subCategoryBreakdown: isKumtluang ? (Object.keys(cleanBreakdown).length > 0 ? cleanBreakdown : breakdown) : undefined,
    };

    onSave(updated);
  };

  const handleConfirmDelete = () => {
    onDelete(transaction.id);
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

          {/* PEK HUN THLA BI / PERIOD SELECTOR */}
          <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pek Hun / Thla Bi (Payment Month & Period)</span>
              </span>
              <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">
                {livePeriodLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Frequency */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Pek Dan (Type)</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value)}
                  className="w-full bg-white border border-indigo-200 rounded-xl p-2 font-bold text-slate-900 text-xs focus:border-indigo-600"
                >
                  <option value="monthly">Thla tin (Monthly)</option>
                  <option value="quarterly">Thla 3 dan (Quarterly)</option>
                  <option value="yearly">Kumtluan (Yearly)</option>
                  <option value="one_time">Vawi khat pek (One-time)</option>
                </select>
              </div>

              {/* Target Year */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Kum (Year)</label>
                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(e.target.value)}
                  className="w-full bg-white border border-indigo-200 rounded-xl p-2 font-bold text-slate-900 text-xs focus:border-indigo-600"
                >
                  <option value="2024">2024</option>
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                  <option value="2029">2029</option>
                  <option value="2030">2030</option>
                </select>
              </div>
            </div>

            {/* Target Month or Quarter */}
            {periodType === 'monthly' || periodType === 'one_time' ? (
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Pek Thla (Target Month)</label>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                  className="w-full bg-white border border-indigo-200 rounded-xl p-2 font-bold text-slate-900 text-xs focus:border-indigo-600"
                >
                  {ALL_MONTH_NAMES_FULL.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            ) : periodType === 'quarterly' ? (
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Quarter (Thla 3 Bi)</label>
                <select
                  value={periodQuarter}
                  onChange={(e) => setPeriodQuarter(e.target.value)}
                  className="w-full bg-white border border-indigo-200 rounded-xl p-2 font-bold text-slate-900 text-xs focus:border-indigo-600"
                >
                  <option value="Q1 (Jan - Mar)">Q1 (Jan - Mar)</option>
                  <option value="Q2 (Apr - Jun)">Q2 (Apr - Jun)</option>
                  <option value="Q3 (Jul - Sep)">Q3 (Jul - Sep)</option>
                  <option value="Q4 (Oct - Dec)">Q4 (Oct - Dec)</option>
                </select>
              </div>
            ) : null}
          </div>

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

            {confirmDelete ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center space-y-2 animate-fadeIn">
                <p className="text-xs font-bold text-rose-900">
                  I chiang chiah em? He transaction record (₹{transaction.amount?.toLocaleString('en-IN')}) hi paih hlen a ni dawn e.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-1.5 rounded-lg text-xs hover:bg-slate-50 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Paih Bo Rawh
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold py-2 rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1 border border-rose-200"
              >
                <Trash2 className="w-3.5 h-3.5" /> He Transaction Record hi paih rawh (Delete)
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
