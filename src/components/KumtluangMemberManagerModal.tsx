import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  X, 
  UserPlus, 
  Search, 
  Check, 
  Printer, 
  CreditCard, 
  Users, 
  PlusCircle, 
  Edit2,
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  Camera,
  Upload,
  User,
  Image as ImageIcon,
  Building2,
  Filter,
  FileSpreadsheet,
  FileText,
  Calendar,
  Layers,
  Award,
  DollarSign,
  ShieldAlert,
  UserCheck,
  Lock
} from 'lucide-react';
import { MemberRecord, MemberDependent, Campaign, Transaction, CreatorProfile } from '../types';
import { 
  getMembers, 
  addOrUpdateMember, 
  deleteMember, 
  deleteMemberWithTransactions,
  saveTransaction, 
  deleteStoredTransaction, 
  isCampaignCreator,
  getStoredTransactions,
  saveStoredTransactions
} from '../utils/storage';
import { 
  exportMasterLedgerPrint, 
  exportMemberCategoryMatrixPrint, 
  exportMemberPassbookVerticalPrint,
  printTransactionsPDF,
  exportFormattedExcel,
  exportKumtluangMatrixToCSV,
  ALL_MONTH_NAMES_SHORT,
  MonthRangeConfig
} from '../utils/export';
import { compressImageFile } from '../utils/imageCompressor';

interface KumtluangMemberManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'mizo' | 'english';
  creatorProfile: CreatorProfile;
  campaigns: Campaign[];
  transactions: Transaction[];
  initialTab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports';
  initialCampaignId?: string;
  onDataUpdated: () => void;
  onOpenCreateQR?: () => void;
}

export const KumtluangMemberManagerModal: React.FC<KumtluangMemberManagerModalProps> = ({
  isOpen,
  onClose,
  language,
  creatorProfile,
  campaigns,
  transactions,
  initialTab = 'members_list',
  initialCampaignId,
  onDataUpdated,
  onOpenCreateQR
}) => {
  const [activeTab, setActiveTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>(initialTab || 'members_list');
  const [members, setMembers] = useState<MemberRecord[]>([]);

  // Calculate scoped campaigns strictly owned/created by this creator (or all if admin)
  // Kumtluang / Organization member-based campaigns should be prioritized; 
  // only Kumtluang category campaigns genuinely manage member rolls.
  const allowedCampaigns = useMemo(() => {
    const baseList = creatorProfile.isAdmin
      ? campaigns
      : campaigns.filter(c => isCampaignCreator(c, creatorProfile));

    // Filter to Kumtluang category campaigns first if any exist, or campaigns having members/orgCodes
    const kumtluangList = baseList.filter(c => c.category === 'kumtluang');
    const targetList = kumtluangList.length > 0 ? kumtluangList : baseList;

    return [...targetList].sort((a, b) => {
      const isKumA = a.category === 'kumtluang' ? 1 : 0;
      const isKumB = b.category === 'kumtluang' ? 1 : 0;
      if (isKumA !== isKumB) return isKumB - isKumA;

      const actA = a.status === 'active' ? 1 : 0;
      const actB = b.status === 'active' ? 1 : 0;
      if (actA !== actB) return actB - actA;

      return (a.title || '').localeCompare(b.title || '');
    });
  }, [campaigns, creatorProfile]);

  // Helper to format campaign label clearly showing Bawm Creator / Bawm Pui Hming (no individual member names)
  const formatCampaignOptionLabel = useCallback((camp: Campaign, count?: number) => {
    const prefix = camp.orgCode || 'QR';
    const isKum = camp.category === 'kumtluang';
    const icon = isKum ? '🏛️' : '📁';
    const title = (camp.title || '').trim();
    const org = (camp.orgName || '').trim();
    const creator = (camp.creatorName || '').trim();
    
    let mainName = title;
    if (org && org.toLowerCase() !== title.toLowerCase()) {
      mainName = `${title} • ${org}`;
    } else if (creator && creator.toLowerCase() !== title.toLowerCase()) {
      mainName = `${title} (${creator})`;
    }

    const countSuffix = typeof count === 'number' ? ` — ${count} Members` : '';
    return `${icon} [${prefix}] ${mainName}${countSuffix}`;
  }, []);

  const allowedCampaignIds = useMemo(() => new Set(allowedCampaigns.map(c => c.id)), [allowedCampaigns]);
  const allowedOrgCodes = useMemo(() => new Set(allowedCampaigns.map(c => (c.orgCode || '').toUpperCase()).filter(Boolean)), [allowedCampaigns]);

  // Helper to filter any members array to only this creator's scope
  const filterMembersForScope = useCallback((list: MemberRecord[]) => {
    if (creatorProfile.isAdmin) return list;
    if (allowedCampaigns.length === 0) return [];
    return list.filter(m => {
      if (m.campaignId && allowedCampaignIds.has(m.campaignId)) return true;
      if (m.orgCode && allowedOrgCodes.has(m.orgCode.toUpperCase())) return true;
      if (m.id) {
        const prefix = m.id.split('-')[0].toUpperCase();
        if (allowedOrgCodes.has(prefix)) return true;
      }
      return false;
    });
  }, [creatorProfile.isAdmin, allowedCampaigns.length, allowedCampaignIds, allowedOrgCodes]);

  // Safe getter for scoped members based on campaign ID
  const getScopedMembersForView = useCallback((campId: string) => {
    if (allowedCampaigns.length === 0 && !creatorProfile.isAdmin) {
      return [];
    }
    if (campId === 'all') {
      const allM = getMembers('all');
      return filterMembersForScope(allM);
    }
    if (!creatorProfile.isAdmin && !allowedCampaignIds.has(campId)) {
      return [];
    }
    const campMembers = getMembers(campId);
    return filterMembersForScope(campMembers);
  }, [allowedCampaigns.length, creatorProfile.isAdmin, filterMembersForScope, allowedCampaignIds]);

  // Active Global QR / Bawm Filter ('all' or campaign.id)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  // Local synchronized transactions list for zero-latency UI updates
  const [localTxList, setLocalTxList] = useState<Transaction[]>(() => getStoredTransactions());

  useEffect(() => {
    setLocalTxList(getStoredTransactions());
  }, [transactions, isOpen]);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const custom = e as CustomEvent<Transaction[]>;
      if (custom.detail && Array.isArray(custom.detail)) {
        setLocalTxList(custom.detail);
      } else {
        setLocalTxList(getStoredTransactions());
      }
    };
    window.addEventListener('ronpay_transactions_updated', handleSync);
    window.addEventListener('ronpay-transactions-updated', handleSync);
    return () => {
      window.removeEventListener('ronpay_transactions_updated', handleSync);
      window.removeEventListener('ronpay-transactions-updated', handleSync);
    };
  }, []);

  // Quick Entry State
  const [quickPhone4, setQuickPhone4] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [selectedPayerType, setSelectedPayerType] = useState<string>('primary'); // 'primary' or subId
  const [quickEntryCampaignId, setQuickEntryCampaignId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Pathian Ram Zauna');
  const [selectedMonth, setSelectedMonth] = useState<string>('August');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [entryAmount, setEntryAmount] = useState<string>('500');
  const [entryPaymentMethod, setEntryPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [entryTxRef, setEntryTxRef] = useState<string>('');
  const [entryRemark, setEntryRemark] = useState<string>('');
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);
  const [entryFilterType, setEntryFilterType] = useState<'all' | 'cash' | 'online'>('all');
  const [entrySearchQuery, setEntrySearchQuery] = useState<string>('');

  // Edit / Delete Transaction State (inside Kumtluang modal)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxDonorName, setEditTxDonorName] = useState<string>('');
  const [editTxAmount, setEditTxAmount] = useState<string>('');
  const [editTxCategory, setEditTxCategory] = useState<string>('Pathian Ram Zauna');
  const [editTxMonth, setEditTxMonth] = useState<string>('August');
  const [editTxYear, setEditTxYear] = useState<string>('2026');
  const [editTxPaymentMethod, setEditTxPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [editTxRemark, setEditTxRemark] = useState<string>('');
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  // New Member Registration State
  const [regTargetCampaignId, setRegTargetCampaignId] = useState<string>('');
  const [newHming, setNewHming] = useState<string>('');
  const [newOrgCode, setNewOrgCode] = useState<string>('BCM');
  const [newPhone4, setNewPhone4] = useState<string>('');
  const [newFullPhone, setNewFullPhone] = useState<string>('');
  const [newSection, setNewSection] = useState<string>('');
  const [newAvatarUrl, setNewAvatarUrl] = useState<string>('');
  const [newDependents, setNewDependents] = useState<{ name: string; relation: string }[]>([]);
  const [depNameInput, setDepNameInput] = useState<string>('');
  const [depRelInput, setDepRelInput] = useState<string>('Fa');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [existingDuplicateMatch, setExistingDuplicateMatch] = useState<MemberRecord | null>(null);
  const [duplicateModalTarget, setDuplicateModalTarget] = useState<{
    existingMember: MemberRecord;
    newDraft: MemberRecord;
    reason: string;
  } | null>(null);

  // Editing Member State
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [editCampaignId, setEditCampaignId] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editOrgCode, setEditOrgCode] = useState<string>('');
  const [editPhone4, setEditPhone4] = useState<string>('');
  const [editFullPhone, setEditFullPhone] = useState<string>('');
  const [editSection, setEditSection] = useState<string>('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  const [editDependents, setEditDependents] = useState<MemberDependent[]>([]);
  const [editDepName, setEditDepName] = useState<string>('');
  const [editDepRel, setEditDepRel] = useState<string>('Fa');

  // Loading state for image compression
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Print Styles & Configuration State
  const [printOrgScope, setPrintOrgScope] = useState<string>('cmp-kumtluang-1');
  const [printStyle, setPrintStyle] = useState<'style1_master' | 'style2_matrix' | 'style3_passbook' | 'style4_audit'>('style1_master');
  const [printMemberId, setPrintMemberId] = useState<string>('');
  const [printYear, setPrintYear] = useState<string>('2026');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includeMonthlyChart, setIncludeMonthlyChart] = useState<boolean>(true);
  const [chartStartMonth, setChartStartMonth] = useState<string>('Jan');
  const [chartEndMonth, setChartEndMonth] = useState<string>('Dec');

  // Search in directory
  const [dirSearch, setDirSearch] = useState<string>('');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Initialize and synchronize campaign selection & member roll
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'members_list');
      
      let activeId = '';
      if (allowedCampaigns.length > 0) {
        if (initialCampaignId && allowedCampaignIds.has(initialCampaignId)) {
          activeId = initialCampaignId;
        } else if (selectedCampaignId && (selectedCampaignId === 'all' ? (creatorProfile.isAdmin || allowedCampaigns.length > 1) : allowedCampaignIds.has(selectedCampaignId))) {
          activeId = selectedCampaignId;
        } else {
          const initialCamp = allowedCampaigns.find(c => c.category === 'kumtluang') || allowedCampaigns[0];
          activeId = initialCamp?.id || allowedCampaigns[0]?.id || '';
        }
      } else if (creatorProfile.isAdmin) {
        activeId = 'all';
      }

      setSelectedCampaignId(activeId);
      setQuickEntryCampaignId(activeId || (allowedCampaigns[0]?.id || ''));
      setRegTargetCampaignId(activeId || (allowedCampaigns[0]?.id || ''));
      setPrintOrgScope(activeId || (allowedCampaigns[0]?.id || 'all'));

      if (activeId) {
        const mList = getScopedMembersForView(activeId);
        setMembers(mList);

        const foundCamp = allowedCampaigns.find(c => c.id === activeId);
        if (foundCamp?.orgCode) {
          setNewOrgCode(foundCamp.orgCode);
        }
      } else {
        setMembers([]);
      }
    }
  }, [isOpen, allowedCampaigns, initialTab, initialCampaignId, creatorProfile.isAdmin, getScopedMembersForView, allowedCampaignIds]);

  // Real-time synchronization listener: updates member list instantly when cloud sync arrives from mobile / other devices
  useEffect(() => {
    const handleRemoteMembersUpdate = () => {
      if (isOpen && selectedCampaignId) {
        const refreshed = getScopedMembersForView(selectedCampaignId);
        setMembers(refreshed);
      }
    };

    window.addEventListener('ronpay-members-updated', handleRemoteMembersUpdate);
    window.addEventListener('ronpay-campaigns-updated', handleRemoteMembersUpdate);
    window.addEventListener('storage', handleRemoteMembersUpdate);

    return () => {
      window.removeEventListener('ronpay-members-updated', handleRemoteMembersUpdate);
      window.removeEventListener('ronpay-campaigns-updated', handleRemoteMembersUpdate);
      window.removeEventListener('storage', handleRemoteMembersUpdate);
    };
  }, [isOpen, selectedCampaignId, getScopedMembersForView]);

  // When selectedCampaignId changes, reload scoped members
  useEffect(() => {
    if (isOpen) {
      if (!selectedCampaignId || (allowedCampaigns.length === 0 && !creatorProfile.isAdmin)) {
        setMembers([]);
        setSelectedMember(null);
        return;
      }
      const mList = getScopedMembersForView(selectedCampaignId);
      setMembers(mList);

      if (selectedCampaignId !== 'all') {
        const camp = allowedCampaigns.find(c => c.id === selectedCampaignId);
        if (camp) {
          setQuickEntryCampaignId(camp.id);
          setRegTargetCampaignId(camp.id);
          setPrintOrgScope(camp.id);
          if (camp.orgCode) {
            setNewOrgCode(camp.orgCode);
          }
        }
      } else {
        setPrintOrgScope(allowedCampaigns.length > 0 ? (allowedCampaigns[0]?.id || 'all') : 'all');
        const firstCamp = allowedCampaigns[0];
        if (firstCamp) {
          setQuickEntryCampaignId(firstCamp.id);
          setRegTargetCampaignId(firstCamp.id);
          if (firstCamp.orgCode) {
            setNewOrgCode(firstCamp.orgCode);
          }
        }
      }
      setSelectedMember(null);
    }
  }, [selectedCampaignId, isOpen, allowedCampaigns, getScopedMembersForView, creatorProfile.isAdmin]);

  // When regTargetCampaignId changes during member creation, auto sync prefix
  useEffect(() => {
    if (regTargetCampaignId) {
      const camp = allowedCampaigns.find(c => c.id === regTargetCampaignId);
      if (camp?.orgCode) {
        setNewOrgCode(camp.orgCode);
      }
    }
  }, [regTargetCampaignId, allowedCampaigns]);

  // Active campaign object based on quick entry / active filter
  const activeScopedCampaign = (selectedCampaignId !== 'all' 
    ? allowedCampaigns.find(c => c.id === selectedCampaignId) 
    : allowedCampaigns.find(c => c.id === quickEntryCampaignId)) || allowedCampaigns[0] || null;

  const activeRegisterCampaign = (regTargetCampaignId 
    ? allowedCampaigns.find(c => c.id === regTargetCampaignId) 
    : null) || activeScopedCampaign;

  const activeEditCampaign = (editCampaignId 
    ? allowedCampaigns.find(c => c.id === editCampaignId) 
    : null) || activeScopedCampaign;

  const campaignCategories = (activeScopedCampaign?.subCategories && activeScopedCampaign.subCategories.length > 0)
    ? activeScopedCampaign.subCategories
    : [];

  const hasCampaignSections = useMemo(() => {
    if (selectedCampaignId === 'all') {
      return Boolean(allowedCampaigns.some(c => c.definedSections && c.definedSections.length > 0));
    }
    return Boolean(activeScopedCampaign?.definedSections && activeScopedCampaign.definedSections.length > 0);
  }, [selectedCampaignId, allowedCampaigns, activeScopedCampaign]);

  const resolvedOrgTitle = activeScopedCampaign?.orgName || activeScopedCampaign?.title || creatorProfile.orgName || creatorProfile.name || 'Organization / Church';
  const resolvedLogoUrl = activeScopedCampaign?.imageUrl || creatorProfile.logoUrl;
  const resolvedLocation = activeScopedCampaign?.location || creatorProfile.address;

  // Image compressor handler for photo upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImageFile(file, 320, 320, 0.75);
      if (isEdit) {
        setEditAvatarUrl(compressedBase64);
      } else {
        setNewAvatarUrl(compressedBase64);
      }
    } catch (err) {
      console.error('Failed to compress avatar photo', err);
      alert('Thlalak load a buai deuh a ni, thlalak dang thlang rawh le.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Auto-search members by last 4 digits, name or ID
  const searchResults = quickPhone4.trim().length >= 2 
    ? members.filter(m => 
        m.phoneLast4.includes(quickPhone4.trim()) || 
        m.name.toLowerCase().includes(quickPhone4.trim().toLowerCase()) || 
        m.id.toLowerCase().includes(quickPhone4.trim().toLowerCase()) ||
        (m.dependents && m.dependents.some(d => d.name.toLowerCase().includes(quickPhone4.trim().toLowerCase()) || d.subId.toLowerCase().includes(quickPhone4.trim().toLowerCase())))
      )
    : [];

  const handleSelectQuickMember = (m: MemberRecord) => {
    setSelectedMember(m);
    setSelectedPayerType('primary');
    setQuickPhone4(m.phoneLast4);
    if (m.campaignId) {
      setQuickEntryCampaignId(m.campaignId);
    }
  };

  const handleSaveQuickPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      alert(language === 'english' ? 'Please select a member first' : 'Member thlang hmasa rawh le');
      return;
    }
    const amt = Number(entryAmount);
    if (isNaN(amt) || amt <= 0) {
      alert(language === 'english' ? 'Enter valid amount' : 'Pawisa zat dik tak chhu lut rawh');
      return;
    }

    let payerName = selectedMember.name;
    let payerId = selectedMember.id;

    if (selectedPayerType !== 'primary' && selectedMember.dependents) {
      const dep = selectedMember.dependents.find(d => d.subId === selectedPayerType);
      if (dep) {
        payerName = `${dep.name} (${selectedMember.name} chhung)`;
        payerId = dep.subId;
      }
    }

    const targetCampaign = campaigns.find(c => c.id === quickEntryCampaignId) || activeScopedCampaign;
    const modeLabel = entryPaymentMethod === 'cash' ? 'Cash' : 'Direct UPI';
    const txRemark = `${selectedMonth} ${selectedYear} [${selectedCategory}] [${modeLabel}] ${entryRemark ? `- ${entryRemark}` : ''} (ID: ${payerId})`;

    const refPrefix = entryPaymentMethod === 'cash' ? 'CASH' : 'UPI';
    const generatedRef = `${refPrefix}-${payerId}-${Date.now().toString().slice(-6)}`;
    const finalRef = entryPaymentMethod === 'online' && entryTxRef.trim() ? entryTxRef.trim() : generatedRef;

    const newTx: Transaction = {
      id: `TX-MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      campaignId: targetCampaign?.id || 'manual',
      campaignTitle: targetCampaign?.title || 'Kumtluang Bawm',
      category: 'kumtluang',
      donorName: payerName,
      donorPhone: selectedMember.fullPhone || `****${selectedMember.phoneLast4}`,
      donorVeng: selectedMember.section || '',
      isAnonymous: false,
      amount: amt,
      platformFee: 0,
      totalAmount: amt,
      timestamp: new Date().toISOString(),
      txHash: finalRef,
      status: 'completed',
      paymentMethod: entryPaymentMethod,
      referenceNo: finalRef,
      remark: txRemark,
      isSynced: true,
      createdAt: new Date().toISOString(),
      subCategory: selectedCategory,
      subCategoryBreakdown: { [selectedCategory]: amt },
      periodType: 'monthly',
      periodMonth: selectedMonth,
      periodYear: selectedYear,
      periodLabel: `${selectedMonth} ${selectedYear}`,
      platformFeeBearer: 'org_paid'
    };

    saveTransaction(newTx);
    const refreshed = getStoredTransactions();
    setLocalTxList(refreshed);
    setEntrySuccess(`₹${amt.toLocaleString('en-IN')} (${selectedCategory} - ${selectedMonth}) chu ${payerName} (${payerId}) pualin [${modeLabel}] record fel a ni ta!`);
    onDataUpdated();
    setTimeout(() => {
      setEntrySuccess(null);
      setEntryRemark('');
      setEntryTxRef('');
    }, 4000);
  };

  const handleOpenEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTxDonorName(tx.donorName || '');
    setEditTxAmount(String(tx.amount || 0));
    setEditTxCategory(tx.subCategory || tx.category || 'Pathian Ram Zauna');
    setEditTxMonth(tx.periodMonth || selectedMonth || 'August');
    setEditTxYear(tx.periodYear || selectedYear || '2026');
    setEditTxPaymentMethod((tx.paymentMethod === 'online' ? 'online' : 'cash'));
    setEditTxRemark(tx.remark || '');
  };

  const handleSaveEditedTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = Number(editTxAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Pawisa zat dik tak chhu lut rawh le.');
      return;
    }

    const catName = editTxCategory.trim() || 'General';
    const updatedTx: Transaction = {
      ...editingTx,
      donorName: editTxDonorName.trim() || editingTx.donorName,
      amount: amt,
      totalAmount: amt,
      paymentMethod: editTxPaymentMethod,
      category: editingTx.category || 'kumtluang',
      subCategory: catName,
      subCategoryBreakdown: { [catName]: amt },
      periodType: 'monthly',
      periodMonth: editTxMonth,
      periodYear: editTxYear,
      periodLabel: `${editTxMonth} ${editTxYear}`,
      remark: editTxRemark.trim() || undefined
    };

    saveTransaction(updatedTx);
    const refreshed = getStoredTransactions();
    setLocalTxList(refreshed);
    setEditingTx(null);
    setEntrySuccess(`₹${amt.toLocaleString('en-IN')} record chu hlawhtling takin siamthat (updated) a ni ta!`);
    onDataUpdated();
    setTimeout(() => setEntrySuccess(null), 3500);
  };

  const handleRequestDeleteTx = (tx: Transaction) => {
    setDeletingTx(tx);
  };

  const handleConfirmDeleteTx = () => {
    if (!deletingTx) return;
    const targetId = deletingTx.id;
    deleteStoredTransaction(targetId);
    const refreshed = getStoredTransactions();
    setLocalTxList(refreshed);
    if (editingTx?.id === targetId) {
      setEditingTx(null);
    }
    setDeletingTx(null);
    setEntrySuccess(`Transaction record (ID: ${targetId}) chu hlawhtling takin paih (deleted) a ni ta!`);
    onDataUpdated();
    setTimeout(() => setEntrySuccess(null), 3500);
  };

  // Add dependent to new member draft
  const handleAddDraftDependent = () => {
    if (!depNameInput.trim()) return;
    setNewDependents(prev => [...prev, { name: depNameInput.trim(), relation: depRelInput }]);
    setDepNameInput('');
  };

  const handleRemoveDraftDependent = (index: number) => {
    setNewDependents(prev => prev.filter((_, i) => i !== index));
  };

  // Check duplicate when typing in Registration
  const checkDuplicate = (org: string, p4: string, fullPhone: string, name: string, targetCampId: string) => {
    const targetId = `${(org || 'EBE').toUpperCase()}-${p4}`.trim();
    const allList = getMembers('all');

    if (p4 && p4.length === 4) {
      const idMatch = allList.find(m => m.id.toUpperCase() === targetId.toUpperCase());
      if (idMatch) {
        setDuplicateWarning(`Hriattirna: Member ID [${idMatch.id}] (${idMatch.name}) hi a awm sa tawh a ni.`);
        setExistingDuplicateMatch(idMatch);
        return idMatch;
      }
    }

    const cleanFull = fullPhone.replace(/\D/g, '');
    if (cleanFull.length === 10) {
      const phoneMatch = allList.find(m => m.fullPhone === cleanFull || (m.campaignId === targetCampId && m.phoneLast4 === cleanFull.slice(-4)));
      if (phoneMatch) {
        setDuplicateWarning(`Hriattirna: Phone number [${cleanFull}] hi ${phoneMatch.name} (${phoneMatch.id}) hian a hmang tawh a ni.`);
        setExistingDuplicateMatch(phoneMatch);
        return phoneMatch;
      }
    }

    if (name.trim().length >= 2 && targetCampId) {
      const nameMatch = allList.find(m => m.campaignId === targetCampId && m.name.toLowerCase().trim() === name.toLowerCase().trim());
      if (nameMatch) {
        setDuplicateWarning(`Hriattirna: Hming "${nameMatch.name}" (${nameMatch.id}) hi he Bawm chhungah hian a awm sa tawh a ni.`);
        setExistingDuplicateMatch(nameMatch);
        return nameMatch;
      }
    }

    setDuplicateWarning(null);
    setExistingDuplicateMatch(null);
    return null;
  };

  // Handle Full Phone Input in Registration (Max 10 digits, auto-fills last 4 digits)
  const handleFullPhoneChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setNewFullPhone(cleaned);
    const p4 = cleaned.length >= 4 ? cleaned.slice(-4) : newPhone4;
    if (cleaned.length >= 4) {
      setNewPhone4(p4);
    }
    const targetCamp = allowedCampaigns.find(c => c.id === regTargetCampaignId) || activeScopedCampaign || allowedCampaigns[0];
    checkDuplicate(newOrgCode, p4, cleaned, newHming, targetCamp?.id || '');
  };

  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
    setNewPhone4(cleaned);
    const targetCamp = allowedCampaigns.find(c => c.id === regTargetCampaignId) || activeScopedCampaign || allowedCampaigns[0];
    checkDuplicate(newOrgCode, cleaned, newFullPhone, newHming, targetCamp?.id || '');
  };

  const executeSaveMember = (memberToSave: MemberRecord) => {
    addOrUpdateMember(memberToSave);
    
    // Explicitly reload members scoped to the current dropdown filter
    const updated = getMembers(selectedCampaignId);
    setMembers(updated);

    const depCount = memberToSave.dependents?.length || 0;
    setRegSuccess(`Member [${memberToSave.id}] ${memberToSave.name} ${depCount > 0 ? `leh dependent ${depCount}` : ''} chu vawn fel a ni ta!`);
    setSelectedMember(memberToSave);
    setSelectedPayerType('primary');
    setQuickPhone4(memberToSave.phoneLast4);
    if (memberToSave.campaignId) {
      setQuickEntryCampaignId(memberToSave.campaignId);
    }
    
    // Reset form so user can immediately register the next member
    setNewHming('');
    setNewPhone4('');
    setNewFullPhone('');
    setNewSection('');
    setNewAvatarUrl('');
    setNewDependents([]);
    setDuplicateWarning(null);
    setExistingDuplicateMatch(null);
    setDuplicateModalTarget(null);
    onDataUpdated();

    setTimeout(() => {
      setRegSuccess(null);
    }, 5000);
  };

  const handleRegisterMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHming.trim()) {
      alert(language === 'english' ? 'Please enter member name' : 'Member hming chhu lut rawh');
      return;
    }
    if (!newPhone4 || newPhone4.length < 4) {
      alert(language === 'english' ? 'Please enter 4 digits phone suffix or 10-digit phone number' : 'Phone number (digit 10) emaw phone tawp digit 4 chhu lut rawh');
      return;
    }

    const targetCamp = allowedCampaigns.find(c => c.id === regTargetCampaignId) || activeScopedCampaign || allowedCampaigns[0];
    const org = (newOrgCode.trim().toUpperCase() || targetCamp?.orgCode || 'EBE');
    const p4 = newPhone4.slice(-4);
    const generatedId = `${org}-${p4}`;
    const cleanFull = newFullPhone.replace(/\D/g, '');

    // Check duplicate
    const allList = getMembers('all');
    const existingById = allList.find(m => m.id.toUpperCase() === generatedId.toUpperCase());
    const existingByPhone = cleanFull.length === 10
      ? allList.find(m => m.fullPhone === cleanFull && m.campaignId === targetCamp?.id)
      : null;
    const existingByName = allList.find(m => m.campaignId === targetCamp?.id && m.name.toLowerCase().trim() === newHming.toLowerCase().trim());

    const duplicate = existingById || existingByPhone || existingByName;

    // Convert draft dependents into MemberDependent objects with subIds
    const formattedDependents: MemberDependent[] = newDependents.map((dep, idx) => ({
      subId: `${generatedId}-${String(idx + 1).padStart(2, '0')}`,
      name: dep.name,
      relation: dep.relation
    }));

    const newM: MemberRecord = {
      id: generatedId,
      campaignId: targetCamp?.id || 'cmp-kumtluang-1',
      name: newHming.trim(),
      orgCode: org,
      phoneLast4: p4,
      fullPhone: cleanFull || undefined,
      section: newSection.trim() || undefined,
      avatarUrl: newAvatarUrl || undefined,
      isFamilyHead: true,
      dependents: formattedDependents,
      createdAt: new Date().toISOString()
    };

    if (duplicate) {
      let reason = `Member ID [${generatedId}] hi ${duplicate.name} pualin a awm sa tawh a ni.`;
      if (duplicate.id !== generatedId && existingByPhone) {
        reason = `Phone number [${cleanFull}] hi ${duplicate.name} (${duplicate.id}) hian a hmang tawh a ni.`;
      } else if (duplicate.id !== generatedId && existingByName) {
        reason = `Hming "${newHming}" hi ID [${duplicate.id}] nen he Bawm-ah hian a awm sa tawh a ni.`;
      }

      setDuplicateModalTarget({
        existingMember: duplicate,
        newDraft: newM,
        reason
      });
      return;
    }

    executeSaveMember(newM);
  };

  // Open Edit Member Modal
  const handleOpenEdit = (m: MemberRecord) => {
    setEditingMember(m);
    setEditCampaignId(m.campaignId || campaigns[0]?.id || '');
    setEditName(m.name);
    setEditOrgCode(m.orgCode);
    setEditPhone4(m.phoneLast4);
    setEditFullPhone(m.fullPhone || '');
    setEditSection(m.section || '');
    setEditAvatarUrl(m.avatarUrl || '');
    setEditDependents(m.dependents || []);
  };

  // Add dependent in edit mode
  const handleAddEditDependent = () => {
    if (!editDepName.trim() || !editingMember) return;
    const nextIdx = editDependents.length + 1;
    const org = editOrgCode.trim().toUpperCase() || editingMember.orgCode;
    const p4 = editPhone4.slice(-4) || editingMember.phoneLast4;
    const baseId = `${org}-${p4}`;

    const newDep: MemberDependent = {
      subId: `${baseId}-${String(nextIdx).padStart(2, '0')}`,
      name: editDepName.trim(),
      relation: editDepRel
    };
    setEditDependents(prev => [...prev, newDep]);
    setEditDepName('');
  };

  const handleRemoveEditDependent = (subId: string) => {
    setEditDependents(prev => prev.filter(d => d.subId !== subId));
  };

  // Save Edit Member
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    const org = editOrgCode.trim().toUpperCase() || editingMember.orgCode;
    const p4 = editPhone4.slice(-4) || editingMember.phoneLast4;
    const newId = `${org}-${p4}`;

    // Re-index subIds if ID changed
    const updatedDeps: MemberDependent[] = editDependents.map((dep, idx) => ({
      ...dep,
      subId: `${newId}-${String(idx + 1).padStart(2, '0')}`
    }));

    // If ID changed, delete old one
    if (newId !== editingMember.id) {
      deleteMember(editingMember.id, editingMember.campaignId || selectedCampaignId);
    }

    const updatedM: MemberRecord = {
      id: newId,
      campaignId: editCampaignId || editingMember.campaignId || activeScopedCampaign?.id,
      name: editName.trim() || editingMember.name,
      orgCode: org,
      phoneLast4: p4,
      fullPhone: editFullPhone.trim() || undefined,
      section: editSection.trim() || '',
      avatarUrl: editAvatarUrl || undefined,
      isFamilyHead: true,
      dependents: updatedDeps,
      createdAt: editingMember.createdAt
    };

    addOrUpdateMember(updatedM);
    const updated = getMembers(selectedCampaignId);
    setMembers(updated);
    if (selectedMember?.id === editingMember.id) {
      setSelectedMember(updatedM);
    }
    setEditingMember(null);
    onDataUpdated();
    alert(`✅ Member record (${newId}) siamthat (updated) hlawhtling ta e!`);
  };

  // Delete Member state and dialog handlers
  const [deletingMemberTarget, setDeletingMemberTarget] = useState<{
    member: MemberRecord;
    txCount: number;
    totalAmount: number;
  } | null>(null);
  const [deleteSuccessNotice, setDeleteSuccessNotice] = useState<string | null>(null);

  const handlePromptDeleteMember = (targetMember: MemberRecord) => {
    const allTxs = getStoredTransactions();
    const cleanId = (targetMember.id || '').trim().toLowerCase();
    const matching = allTxs.filter(t => {
      if (!t) return false;
      const tMemberId = (t.memberId || '').trim().toLowerCase();
      const tRemark = (t.remark || '').trim().toLowerCase();
      const tRef = (t.referenceNo || '').trim().toLowerCase();
      const tHash = (t.txHash || '').trim().toLowerCase();
      if (tMemberId && tMemberId === cleanId) return true;
      if (tRemark && tRemark.includes(cleanId)) return true;
      if (tRef && tRef.includes(cleanId)) return true;
      if (tHash && tHash.includes(cleanId)) return true;
      return false;
    });
    const validTxns = matching.filter(t => t.status !== 'failed' && t.status !== 'rejected');
    const sumAmount = validTxns.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

    setDeletingMemberTarget({
      member: targetMember,
      txCount: matching.length,
      totalAmount: sumAmount
    });
  };

  const handleExecuteDeleteMember = (deleteRecords: boolean) => {
    if (!deletingMemberTarget) return;
    const { member } = deletingMemberTarget;
    const campId = member.campaignId || (selectedCampaignId !== 'all' ? selectedCampaignId : undefined);
    
    if (deleteRecords) {
      const res = deleteMemberWithTransactions(member.id, campId);
      setDeleteSuccessNotice(`Member "${member.name}" (${member.id}) leh a chhunga transaction ${res.deletedTxCount} chu hlawhtling takin paih bo (deleted) a ni!`);
    } else {
      deleteMember(member.id, campId);
      setDeleteSuccessNotice(`Member "${member.name}" (${member.id}) chu hlawhtling takin paih bo (deleted) a ni!`);
    }

    const updated = getMembers(selectedCampaignId);
    setMembers(updated);
    setLocalTxList(getStoredTransactions());
    if (selectedMember?.id === member.id) {
      setSelectedMember(null);
    }
    if (editingMember?.id === member.id) {
      setEditingMember(null);
    }
    setDeletingMemberTarget(null);
    onDataUpdated();
    
    setTimeout(() => {
      setDeleteSuccessNotice(null);
    }, 6000);
  };

  const handleDeleteMember = (memberId: string, memberName: string) => {
    const mem = members.find(m => (m.id || '').trim().toLowerCase() === (memberId || '').trim().toLowerCase()) 
      || getMembers('all').find(m => (m.id || '').trim().toLowerCase() === (memberId || '').trim().toLowerCase());
    if (mem) {
      handlePromptDeleteMember(mem);
    } else {
      deleteMember(memberId, selectedCampaignId);
      setMembers(getMembers(selectedCampaignId));
      onDataUpdated();
    }
  };

  // Calculate campaign member counts for the dropdown badges
  const allMembersList = useMemo(() => {
    const rawAll = getMembers('all');
    return filterMembersForScope(rawAll);
  }, [members, isOpen, allowedCampaigns, creatorProfile]);

  const campaignCounts = useMemo(() => {
    const counts: { [campId: string]: number } = {};
    allowedCampaigns.forEach(c => {
      counts[c.id] = allMembersList.filter(m => m.campaignId === c.id || (c.orgCode && m.orgCode === c.orgCode)).length;
    });
    return counts;
  }, [allowedCampaigns, allMembersList]);

  // Filtered members for Member Roll Table
  const filteredTableMembers = useMemo(() => {
    return members.filter(m => {
      if (!m) return false;
      if (!dirSearch.trim()) return true;
      const q = dirSearch.toLowerCase().trim();
      const matchName = m.name ? m.name.toLowerCase().includes(q) : false;
      const matchId = m.id ? m.id.toLowerCase().includes(q) : false;
      const matchPhone = (m.phoneLast4 && m.phoneLast4.includes(q)) || (m.fullPhone && m.fullPhone.includes(q)) || false;
      const matchSec = m.section ? m.section.toLowerCase().includes(q) : false;
      const matchDep = m.dependents ? m.dependents.some(d => (d.name && d.name.toLowerCase().includes(q)) || (d.subId && d.subId.toLowerCase().includes(q))) : false;
      return matchName || matchId || matchPhone || matchSec || matchDep;
    });
  }, [members, dirSearch]);

  // Target campaign for Print Tab
  const printTargetCampaign = printOrgScope !== 'all' 
    ? allowedCampaigns.find(c => c.id === printOrgScope) 
    : undefined;

  const printTargetTransactions = useMemo(() => {
    if (printOrgScope === 'all') {
      if (creatorProfile.isAdmin) return transactions;
      return transactions.filter(t => allowedCampaignIds.has(t.campaignId));
    }
    return transactions.filter(t => 
      t.campaignId === printOrgScope || 
      (printTargetCampaign?.title && t.campaignTitle === printTargetCampaign.title) ||
      (printTargetCampaign?.orgCode && (t.memberId?.startsWith(`${printTargetCampaign.orgCode}-`) || t.txHash?.includes(printTargetCampaign.orgCode)))
    );
  }, [transactions, printOrgScope, printTargetCampaign, allowedCampaignIds, creatorProfile]);

  const printTargetMembers = useMemo(() => {
    if (printOrgScope === 'all') {
      return filterMembersForScope(getMembers('all'));
    }
    return getMembers(printOrgScope);
  }, [printOrgScope, allowedCampaigns]);

  // Selected member transactions for Quick Entry History / Edit / Delete
  const selectedMemberTransactions = useMemo(() => {
    if (!selectedMember) return [];
    const p4 = selectedMember.phoneLast4;
    const fullP = selectedMember.fullPhone;
    const mId = (selectedMember.id || '').toLowerCase().trim();
    const mName = (selectedMember.name || '').toLowerCase().trim();
    const depIds = (selectedMember.dependents || []).map(d => (d.subId || '').toLowerCase().trim()).filter(Boolean);
    const depNames = (selectedMember.dependents || []).map(d => (d.name || '').toLowerCase().trim()).filter(Boolean);

    return localTxList.filter(t => {
      if (!t || !t.id) return false;
      const r = (t.remark || '').toLowerCase();
      const ref = (t.referenceNo || '').toLowerCase();
      const hash = (t.txHash || '').toLowerCase();
      const dName = (t.donorName || '').toLowerCase();
      const dPhone = (t.donorPhone || '').toLowerCase();
      const tId = (t.id || '').toLowerCase();

      // Check payment type filter
      if (entryFilterType === 'cash' && t.paymentMethod !== 'cash') return false;
      if (entryFilterType === 'online' && t.paymentMethod === 'cash') return false;

      // Check search query if typed
      if (entrySearchQuery.trim()) {
        const sq = entrySearchQuery.toLowerCase().trim();
        const matchesQuery = dName.includes(sq) || r.includes(sq) || ref.includes(sq) || tId.includes(sq) || String(t.amount || '').includes(sq) || (t.subCategory || '').toLowerCase().includes(sq) || (t.periodMonth || '').toLowerCase().includes(sq);
        if (!matchesQuery) return false;
      }

      if (mId && (r.includes(mId) || ref.includes(mId) || hash.includes(mId) || tId.includes(mId))) return true;
      if (depIds.some(did => did && (r.includes(did) || ref.includes(did) || hash.includes(did)))) return true;
      if (fullP && (dPhone === fullP.toLowerCase() || dPhone.includes(fullP.toLowerCase()))) return true;
      if (p4 && dPhone.endsWith(p4)) return true;
      if (mName && dName.includes(mName)) return true;
      if (depNames.some(dn => dn && dName.includes(dn))) return true;
      return false;
    }).sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime());
  }, [selectedMember, localTxList, entryFilterType, entrySearchQuery]);

  // Active Bawm recent transactions
  const activeBawmTransactions = useMemo(() => {
    return localTxList.filter(t => {
      if (!t || !t.id) return false;
      
      // Filter by active campaign if scoped
      if (activeScopedCampaign) {
        const campId = activeScopedCampaign.id;
        const campTitle = (activeScopedCampaign.title || '').toLowerCase();
        const orgCode = (activeScopedCampaign.orgCode || '').toLowerCase();
        const isCampMatch = t.campaignId === campId || 
          (campTitle && (t.campaignTitle || '').toLowerCase().includes(campTitle)) ||
          (orgCode && ((t.referenceNo || '').toLowerCase().includes(orgCode) || (t.remark || '').toLowerCase().includes(orgCode) || (t.txHash || '').toLowerCase().includes(orgCode)));
        if (!isCampMatch) return false;
      }

      // Check payment type filter
      if (entryFilterType === 'cash' && t.paymentMethod !== 'cash') return false;
      if (entryFilterType === 'online' && t.paymentMethod === 'cash') return false;

      // Check search query if typed
      if (entrySearchQuery.trim()) {
        const sq = entrySearchQuery.toLowerCase().trim();
        const dName = (t.donorName || '').toLowerCase();
        const r = (t.remark || '').toLowerCase();
        const ref = (t.referenceNo || '').toLowerCase();
        const tId = (t.id || '').toLowerCase();
        const matchesQuery = dName.includes(sq) || r.includes(sq) || ref.includes(sq) || tId.includes(sq) || String(t.amount || '').includes(sq) || (t.subCategory || '').toLowerCase().includes(sq) || (t.periodMonth || '').toLowerCase().includes(sq);
        if (!matchesQuery) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime()).slice(0, 50);
  }, [activeScopedCampaign, localTxList, entryFilterType, entrySearchQuery]);

  if (!isOpen) return null;

  // Enforce QR Creator exclusive access check
  const isAuthorizedCreator = creatorProfile.isApproved || creatorProfile.isAdmin;

  if (!isAuthorizedCreator) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn text-slate-800">
        <div className="bg-white border border-indigo-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative flex flex-col items-center text-center my-auto shrink-0 max-h-[90vh] overflow-y-auto">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mb-3 shadow-xs">
            <ShieldAlert className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1">
            QR Creator Chauhin A Access Thei
          </h3>
          <span className="text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-900 px-3 py-0.5 rounded-full mb-3">
            Creator Authentication Required
          </span>
          <p className="text-xs text-slate-600 leading-relaxed mb-6">
            Member Roll, Digit 4 Quick Entry (Passbook), Statement Print leh Member Registration hi <b>QR Creator (Biakin, Pawl, Khawtlang hotute)</b> chauh tana duan a ni.<br/><br/>
            Khawngaihin i Creator Account-ah lut la, emaw QR Creator thar angin in-register rawh le.
          </p>

          <div className="w-full flex flex-col gap-2.5">
            {onOpenCreateQR && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreateQR();
                }}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-xs shadow-md transition active:opacity-90 flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>Creator Login / Register-ah Lut Rawh</span>
              </button>
            )}
            
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
            >
              Khirh Leh Rawh (Close)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white border-0 sm:border border-slate-200 sm:rounded-3xl rounded-none w-full max-w-4xl h-full sm:h-[90vh] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col relative shrink-0">
        
        {/* Top Header with Vibrant Gradient & Live Stats */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
          <div className="flex items-center gap-3 min-w-0">
            {/* Creator Photo / Avatar */}
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-indigo-400/50 bg-slate-800 flex items-center justify-center text-white shadow-md overflow-hidden shrink-0">
              {creatorProfile.avatarUrl ? (
                <img src={creatorProfile.avatarUrl} alt={creatorProfile.name || 'Creator'} className="w-full h-full object-cover" />
              ) : creatorProfile.logoUrl ? (
                <img src={creatorProfile.logoUrl} alt={creatorProfile.name || 'Creator'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center font-black text-sm sm:text-base tracking-wider text-white">
                  {(creatorProfile.name || 'CR').split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'CR'}
                </div>
              )}
            </div>

            {/* Creator Name & Details */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm sm:text-base tracking-wide text-white truncate">
                  {creatorProfile.name || 'Authenticated Creator'}
                </h3>
                <span className="text-[9px] sm:text-[10px] uppercase font-mono font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full shrink-0 shadow-xs">
                  {creatorProfile.isAdmin ? 'Admin Master Roll' : (creatorProfile.designation || 'Creator Verified')}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-200/90 truncate flex items-center gap-1.5 mt-0.5">
                <span className="font-semibold text-slate-200 truncate">{creatorProfile.orgName || 'RonPay Verified Creator'}</span>
                <span className="text-indigo-400 shrink-0">•</span>
                <span className="text-indigo-300 font-mono text-[10px] sm:text-[11px] shrink-0">{creatorProfile.phone || 'Verified'}</span>
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            id="close-kumtluang-modal-btn"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0 ml-2"
            title="Close"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* PROMINENT TOP-LEVEL QR / BAWM FILTER BAR */}
        <div className="bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-slate-50 border-b border-indigo-100 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <label htmlFor="active-bawm-dropdown" className="text-xs font-black text-indigo-950 uppercase tracking-wider block">
                Select Active QR / Bawm:
              </label>
              <p className="text-[10px] text-slate-500 truncate hidden sm:block">
                Choose a specific Bawm to manage, or select All Lists
              </p>
            </div>
          </div>
          
          <div className="flex-1 max-w-md w-full">
            <div className="relative">
              <select
                id="active-bawm-dropdown"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                disabled={allowedCampaigns.length === 0}
                className="w-full pl-3.5 pr-8 py-2.5 bg-white border-2 border-indigo-400 hover:border-indigo-600 rounded-xl text-xs font-black text-indigo-950 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer appearance-none truncate disabled:bg-slate-100 disabled:text-slate-400"
              >
                {creatorProfile.isAdmin && (
                  <option value="all">
                    🌐 All Lists (Bawm Zawng Zawng) — Consolidated Master Roll ({allMembersList.length} Members)
                  </option>
                )}
                {!creatorProfile.isAdmin && allowedCampaigns.length > 1 && (
                  <option value="all">
                    📂 Ka Bawm Zawng Zawng — Master Roll ({allMembersList.length} Members)
                  </option>
                )}
                {allowedCampaigns.length === 0 && (
                  <option value="">
                    ⚠️ Bawm a awm lo (Bawm thar siam a ngai)
                  </option>
                )}
                {allowedCampaigns.map(camp => (
                  <option key={camp.id} value={camp.id}>
                    {formatCampaignOptionLabel(camp, campaignCounts[camp.id] || 0)}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-700">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 gap-1.5 sm:gap-2 pt-2 overflow-x-auto shrink-0 no-scrollbar">
          <button
            type="button"
            id="tab-btn-quick-entry"
            onClick={() => setActiveTab('quick_entry')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'quick_entry'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Quick Entry (Digit 4)</span>
          </button>

          <button
            type="button"
            id="tab-btn-register-member"
            onClick={() => setActiveTab('register_member')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'register_member'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Member / Family</span>
          </button>

          <button
            type="button"
            id="tab-btn-print-reports"
            onClick={() => setActiveTab('print_reports')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'print_reports'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Statement Print (4 Formats)</span>
          </button>

          <button
            type="button"
            id="tab-btn-members-list"
            onClick={() => setActiveTab('members_list')}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs font-black border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'members_list'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Member Roll ({filteredTableMembers.length})</span>
          </button>
        </div>

        {/* SCROLLABLE MAIN CONTENT BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 bg-white space-y-4">
          {deleteSuccessNotice && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-fadeIn">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{deleteSuccessNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDeleteSuccessNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ACTIVE BAWM PUI SUMMARY CARD */}
          {activeScopedCampaign && (
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-xl shrink-0">
                  {activeScopedCampaign.category === 'kumtluang' ? '🏛️' : '📁'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-black text-sm sm:text-base text-white tracking-wide truncate">
                      {activeScopedCampaign.title}
                    </h4>
                    <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                      Prefix: {activeScopedCampaign.orgCode || 'QR'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    <span className="font-semibold text-slate-200">{activeScopedCampaign.orgName || creatorProfile.orgName || 'Organization'}</span>
                    {activeScopedCampaign.creatorName && (
                      <>
                        <span className="text-slate-500 mx-1.5">•</span>
                        <span className="text-slate-400">Creator: {activeScopedCampaign.creatorName}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Enrolled Members</div>
                  <div className="text-sm sm:text-base font-black font-mono text-emerald-400">
                    {campaignCounts[activeScopedCampaign.id] || members.length || 0} Members
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('register_member')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Add Member</span>
                </button>
              </div>
            </div>
          )}

          {allowedCampaigns.length === 0 && (
            <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 block">Kumtluang / Organization Bawm i la nei lo</span>
                  <span className="text-[11px] text-slate-600">I account ({creatorProfile.name || creatorProfile.phone}) tan Bawm thar siam a, member-te nen link theih a ni.</span>
                </div>
              </div>
              {onOpenCreateQR && (
                <button
                  type="button"
                  onClick={onOpenCreateQR}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shrink-0 self-start sm:self-auto cursor-pointer shadow-xs transition"
                >
                  + Bawm Thar Siam Rawh
                </button>
              )}
            </div>
          )}

          {/* TAB 1: QUICK ENTRY */}
          {activeTab === 'quick_entry' && (
            <div className="space-y-6">
              {entrySuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{entrySuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Left Column: 4-Digit Search & Member Selection */}
                <div className="md:col-span-5 space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Phone Last 4 Digits / Hming / Sub-ID <span className="text-indigo-600">*</span>
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        id="quick-entry-search-input"
                        value={quickPhone4}
                        onChange={(e) => {
                          setQuickPhone4(e.target.value);
                          if (!e.target.value) setSelectedMember(null);
                        }}
                        placeholder="e.g. 1460, 8622, Rammuanpuia..."
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-indigo-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Digit 4 emaw Hming chhutin Member an lo lang nghal ang.
                    </p>
                  </div>

                  {/* Auto-suggest list */}
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {searchResults.map(m => {
                      const memberCamp = campaigns.find(c => c.id === m.campaignId);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectQuickMember(m)}
                          className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                            selectedMember?.id === m.id
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-indigo-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs ${
                              selectedMember?.id === m.id ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{m.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black flex items-center gap-1.5 flex-wrap">
                                <span className="truncate">{m.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${selectedMember?.id === m.id ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-100 text-slate-700'}`}>
                                  {m.id}
                                </span>
                                {memberCamp && selectedCampaignId === 'all' && (
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${selectedMember?.id === m.id ? 'bg-indigo-700 text-indigo-100' : 'bg-blue-100 text-blue-800'}`}>
                                    {memberCamp.orgCode || memberCamp.title}
                                  </span>
                                )}
                                {m.dependents && m.dependents.length > 0 && (
                                  <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${selectedMember?.id === m.id ? 'bg-indigo-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                    +{m.dependents.length} Chhungte
                                  </span>
                                )}
                              </div>
                              <div className={`text-[10.5px] mt-0.5 ${selectedMember?.id === m.id ? 'text-indigo-100' : 'text-slate-500'}`}>
                                Phone: ****{m.phoneLast4}{hasCampaignSections && m.section ? ` • ${m.section}` : ''}
                              </div>
                            </div>
                          </div>
                          {selectedMember?.id === m.id && <Check className="w-4 h-4 text-white shrink-0" />}
                        </button>
                      );
                    })}

                    {quickPhone4 && searchResults.length === 0 && (
                      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                        <p className="text-xs text-amber-800 font-bold">He Phone / Hming hi Roll-ah a la awm lo</p>
                        <button
                          type="button"
                          onClick={() => {
                            setNewPhone4(quickPhone4.slice(-4));
                            setActiveTab('register_member');
                          }}
                          className="text-xs font-black text-indigo-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          + Member thar atan register nghal rawh
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Payment Form */}
                <div className="md:col-span-7 space-y-4">
                  <form onSubmit={handleSaveQuickPayment} className="space-y-4">
                    {/* Selected Member Header Card */}
                    <div className={`p-4 rounded-2xl border ${
                      selectedMember 
                        ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950' 
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {selectedMember && (
                            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white border border-indigo-200 shadow-xs shrink-0 flex items-center justify-center font-black text-indigo-900 text-base">
                              {selectedMember.avatarUrl ? (
                                <img src={selectedMember.avatarUrl} alt={selectedMember.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{selectedMember.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                          )}
                          <div>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Chhungkaw Hotu (Family Head)</div>
                            <div className="text-sm font-black text-slate-900">
                              {selectedMember ? selectedMember.name : 'Khawngaihin vei lam atangin member thlang rawh'}
                            </div>
                          </div>
                        </div>
                        {selectedMember && (
                          <span className="font-mono text-xs font-black px-2.5 py-1 bg-indigo-600 text-white rounded-xl shadow-xs">
                            {selectedMember.id}
                          </span>
                        )}
                      </div>

                      {/* Dual-User Selector (Family Head vs Dependents) */}
                      {selectedMember && selectedMember.dependents && selectedMember.dependents.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-indigo-200/60 space-y-1.5">
                          <label className="text-[10px] uppercase font-black text-indigo-900 block">
                            Tunge Thawh Dawn? (Select Payer Member):
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPayerType('primary')}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                selectedPayerType === 'primary'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-indigo-50'
                              }`}
                            >
                              <span>{selectedMember.name} (Hotu)</span>
                              <span className="text-[9px] font-mono opacity-80">{selectedMember.id}</span>
                            </button>

                            {selectedMember.dependents.map(dep => (
                              <button
                                key={dep.subId}
                                type="button"
                                onClick={() => setSelectedPayerType(dep.subId)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                  selectedPayerType === dep.subId
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-indigo-50'
                                  }`}
                              >
                                <span>{dep.name}</span>
                                <span className="text-[9px] font-mono opacity-80">{dep.subId}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Campaign / Bawm Dropdown */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Kumtluang Bawm / Campaign Target</label>
                      <select
                        value={quickEntryCampaignId}
                        onChange={(e) => setQuickEntryCampaignId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      >
                        {allowedCampaigns.map(c => (
                          <option key={c.id} value={c.id}>{formatCampaignOptionLabel(c)}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category & Month */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Fund Head / Category</label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          {campaignCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Thla (Month)</label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          {monthsList.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Payment Mode Selector */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">
                        Pekna Hmanraw Thlan Tur (Payment Mode) <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEntryPaymentMethod('cash')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border ${
                            entryPaymentMethod === 'cash'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>💵 Cash Counter (Cash)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEntryPaymentMethod('online')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer border ${
                            entryPaymentMethod === 'online'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>⚡ Direct UPI / Bank</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {entryPaymentMethod === 'cash' 
                          ? 'Kut-a pawisa fai (cash) dawn chhinchhiahna.' 
                          : 'Biakin/Pawl UPI ID / Account-a an lo thawn direct (Outside RonPay) chhinchhiahna.'}
                      </p>
                    </div>

                    {/* Amount, UTR/Ref & Remark */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Pek Zat (Amount ₹) <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                          <input
                            type="number"
                            value={entryAmount}
                            onChange={(e) => setEntryAmount(e.target.value)}
                            className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            required
                          />
                        </div>
                      </div>

                      {entryPaymentMethod === 'online' ? (
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">UPI Ref / UTR (Optional)</label>
                          <input
                            type="text"
                            value={entryTxRef}
                            onChange={(e) => setEntryTxRef(e.target.value)}
                            placeholder="e.g. UTR123456789"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Remark (Optional)</label>
                          <input
                            type="text"
                            value={entryRemark}
                            onChange={(e) => setEntryRemark(e.target.value)}
                            placeholder="e.g. Inkhawm thawh / Cash counter"
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />
                        </div>
                      )}
                    </div>

                    {entryPaymentMethod === 'online' && (
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Remark / Note (Optional)</label>
                        <input
                          type="text"
                          value={entryRemark}
                          onChange={(e) => setEntryRemark(e.target.value)}
                          placeholder="e.g. GPay kaltlanga rawn pe / Direct UPI"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!selectedMember}
                      className={`w-full py-3.5 text-white rounded-2xl text-xs font-black transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                        entryPaymentMethod === 'cash'
                          ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      <span>
                        {entryPaymentMethod === 'cash'
                          ? 'Cash Thawhkhawm Chhinchhiah Rawh (Save Cash Payment)'
                          : 'Direct UPI Thawhkhawm Chhinchhiah Rawh (Save UPI Payment)'}
                      </span>
                    </button>
                  </form>
                </div>

                {/* RECENT ENTRIES & EDIT/DELETE SECTION */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <h4 className="text-xs font-black text-slate-900">
                          {selectedMember 
                            ? `${selectedMember.name} (${selectedMember.id}) Sulhnu & Records`
                            : `${activeScopedCampaign?.title || 'Kumtluang Bawm'} Sulhnu & Records`}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Record-te hi [✏️ Edit / Siamtha] emaw [🗑️ Paih / Delete] awlsam takin a tih theih
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setEntryFilterType('all')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          entryFilterType === 'all'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryFilterType('cash')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          entryFilterType === 'cash'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        💵 Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntryFilterType('online')}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer ${
                          entryFilterType === 'online'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        ⚡ UPI
                      </button>
                    </div>
                  </div>

                  {/* Search box within recent entries */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={entrySearchQuery}
                      onChange={(e) => setEntrySearchQuery(e.target.value)}
                      placeholder="Zawnna (Hming, ID, Amount, Category, Thla...)"
                      className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {entrySearchQuery && (
                      <button
                        type="button"
                        onClick={() => setEntrySearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {selectedMember ? (
                    selectedMemberTransactions.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        He member tan hian record zawn hmuh a awm rih lo.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {selectedMemberTransactions.map(tx => (
                          <div 
                            key={tx.id}
                            className="bg-slate-50 border border-slate-200/80 hover:border-indigo-300 rounded-xl p-3 flex items-center justify-between gap-3 transition shadow-2xs"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                  tx.paymentMethod === 'cash' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                }`}>
                                  {tx.paymentMethod === 'cash' ? '💵 Cash' : '⚡ UPI'}
                                </span>
                                <span className="text-xs font-black text-slate-900">
                                  ₹{tx.amount?.toLocaleString('en-IN')}
                                </span>
                                <span className="text-[11px] font-bold text-slate-700">
                                  {tx.subCategory || tx.category}
                                </span>
                                {tx.periodMonth && (
                                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {tx.periodMonth} {tx.periodYear || ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                                <span className="font-medium">{new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                {tx.donorName && tx.donorName !== selectedMember.name && (
                                  <span className="font-bold text-slate-700">Pual: {tx.donorName}</span>
                                )}
                                {tx.remark && <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[200px]">{tx.remark}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditTx(tx)}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Siamtha / Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteTx(tx)}
                                className="px-2.5 py-1.5 bg-white border border-rose-200 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 text-rose-600 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Paih / Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Paih</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    activeBawmTransactions.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        He bawm pual hian transaction zawn hmuh a awm rih lo.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {activeBawmTransactions.map(tx => (
                          <div 
                            key={tx.id}
                            className="bg-slate-50 border border-slate-200/80 hover:border-indigo-300 rounded-xl p-3 flex items-center justify-between gap-3 transition shadow-2xs"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                  tx.paymentMethod === 'cash' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                }`}>
                                  {tx.paymentMethod === 'cash' ? '💵 Cash' : '⚡ UPI'}
                                </span>
                                <span className="text-xs font-black text-slate-900">
                                  ₹{tx.amount?.toLocaleString('en-IN')}
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {tx.donorName || 'Anonymous'}
                                </span>
                                <span className="text-[10px] font-medium text-slate-500">
                                  ({tx.subCategory || tx.category || 'General'})
                                </span>
                                {tx.periodMonth && (
                                  <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                    {tx.periodMonth} {tx.periodYear || ''}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 flex-wrap">
                                <span className="font-medium">{new Date(tx.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                {tx.remark && <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-[220px]">{tx.remark}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditTx(tx)}
                                className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Siamtha / Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRequestDeleteTx(tx)}
                                className="px-2.5 py-1.5 bg-white border border-rose-200 hover:border-rose-500 hover:bg-rose-50 hover:text-rose-700 text-rose-600 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Paih / Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Paih</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: REGISTER MEMBER / FAMILY TREE */}
          {activeTab === 'register_member' && (
            <div className="max-w-xl mx-auto space-y-4">
              {regSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-950 animate-fadeIn shadow-xs">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-black text-emerald-900">{regSuccess}</p>
                      <p className="text-[10px] text-emerald-700 font-medium">A dawt chhungkaw member dang i chhunzawm nghal thei e (Form a in-reset sa).</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('members_list')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 transition cursor-pointer shadow-xs active:scale-95"
                  >
                    Roll List En Rawh &rarr;
                  </button>
                </div>
              )}

              {duplicateWarning && (
                <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-2 animate-fadeIn shadow-xs">
                  <div className="flex items-start gap-2.5 text-xs font-bold text-amber-900">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-black text-amber-950 uppercase tracking-wide">Duplicate Record Hriattirna</div>
                      <p className="mt-0.5">{duplicateWarning}</p>
                      {existingDuplicateMatch && (
                        <div className="mt-2 p-2.5 bg-white rounded-xl border border-amber-200 text-[11px] space-y-1 shadow-2xs">
                          <div className="font-bold text-slate-800">
                            Awm sa: <span className="text-indigo-900 font-mono font-black">{existingDuplicateMatch.id}</span> - {existingDuplicateMatch.name}
                            {existingDuplicateMatch.section ? ` (${existingDuplicateMatch.section})` : ''}
                          </div>
                          <div className="text-slate-600 font-mono text-[10.5px]">
                            Phone: {existingDuplicateMatch.fullPhone || `****${existingDuplicateMatch.phoneLast4}`}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {existingDuplicateMatch && (
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200/80">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(existingDuplicateMatch)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Awmsa Siamtha Rawh (Edit Member)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleRegisterMember} className="space-y-4 bg-slate-50 p-5 sm:p-6 rounded-3xl border border-slate-200">
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-600" />
                    <span>Chhungkaw Hotu & Dependents Registration</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Chhungkaw Hotu pui ber hming leh phone hmangin Unique ID a insiam ang a, phone nei lo chhungte tana Sub-ID siam theih a ni.
                  </p>
                </div>

                {/* Target Bawm Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Select Target QR / Bawm (He Member hi eng Bawm-ah nge enroll dawn?): <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={regTargetCampaignId}
                    onChange={(e) => {
                      const newCampId = e.target.value;
                      setRegTargetCampaignId(newCampId);
                      checkDuplicate(newOrgCode, newPhone4, newFullPhone, newHming, newCampId);
                    }}
                    className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  >
                    {allowedCampaigns.map(c => (
                      <option key={c.id} value={c.id}>
                        {formatCampaignOptionLabel(c)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Chhungkaw Hotu Hming (Family Head Full Name) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newHming}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewHming(val);
                      const targetCamp = allowedCampaigns.find(c => c.id === regTargetCampaignId) || activeScopedCampaign || allowedCampaigns[0];
                      checkDuplicate(newOrgCode, newPhone4, newFullPhone, val, targetCamp?.id || '');
                    }}
                    placeholder="e.g. Rammuanpuia Ralte"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Full Phone Number (Digit 10) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Auto-fills Last 4 Digits
                    </span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={newFullPhone}
                    onChange={(e) => handleFullPhoneChange(e.target.value)}
                    placeholder="e.g. 9862123456 (Digit 10 chiah)"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Pawl Code (Prefix) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={newOrgCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setNewOrgCode(val);
                        const targetCamp = allowedCampaigns.find(c => c.id === regTargetCampaignId) || activeScopedCampaign || allowedCampaigns[0];
                        checkDuplicate(val, newPhone4, newFullPhone, newHming, targetCamp?.id || '');
                      }}
                      placeholder="e.g. EBE / BCM / YMA"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Phone No. Last 4 Digits <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={newPhone4}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="e.g. 3456"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Preview of generated ID */}
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-indigo-900 font-bold">Auto-Generated Primary ID:</span>
                  <span className="font-mono font-black text-indigo-950 bg-white px-2.5 py-1 rounded-lg border border-indigo-300">
                    {newOrgCode.toUpperCase() || 'EBE'}-{newPhone4 ? newPhone4.slice(-4) : 'XXXX'}
                  </span>
                </div>

                {activeRegisterCampaign?.definedSections && activeRegisterCampaign.definedSections.length > 0 && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      {activeRegisterCampaign.sectionLabel || 'Section / Bial / Veng'}
                    </label>
                    <select
                      value={newSection}
                      onChange={(e) => setNewSection(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Thlang Rawh ({activeRegisterCampaign.sectionLabel || 'Bial / Section'}) --</option>
                      {activeRegisterCampaign.definedSections.map((sec, idx) => (
                        <option key={idx} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Member Profile Photo Upload */}
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      <span>Mimal Thlalak / Profile Photo (Optional)</span>
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">Statement Print-ah a lang ang</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative group">
                      {newAvatarUrl ? (
                        <img src={newAvatarUrl} alt="Member Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-slate-400" />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1">
                      <input
                        ref={newFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handlePhotoSelect(e, false)}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => newFileInputRef.current?.click()}
                          disabled={isCompressing}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{newAvatarUrl ? 'Thlak Rawh' : 'Thlalak Thlang Rawh'}</span>
                        </button>
                        {newAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => setNewAvatarUrl('')}
                            className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Paih Rawh
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Auto-compressed under 100KB (Phone memory ti rit lo turin)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dependents Addition Section */}
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 uppercase">
                      + Dependents (Phone nei hrang lo chhungte)
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">Sub-ID Auto Generate</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={depNameInput}
                      onChange={(e) => setDepNameInput(e.target.value)}
                      placeholder="Chhungte Hming (e.g. Lalrinchhani)"
                      className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <select
                      value={depRelInput}
                      onChange={(e) => setDepRelInput(e.target.value)}
                      className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                    >
                      <option value="Nupui">Nupui</option>
                      <option value="Pasal">Pasal</option>
                      <option value="Fa">Fa</option>
                      <option value="Nu">Nu</option>
                      <option value="Pa">Pa</option>
                      <option value="Nau">Nau</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAddDraftDependent}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>

                  {newDependents.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {newDependents.map((dep, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                              {newOrgCode || 'EBE'}-{newPhone4.slice(-4) || 'XXXX'}-{String(idx + 1).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-slate-900">{dep.name}</span>
                            <span className="text-[10px] text-slate-500">({dep.relation})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftDependent(idx)}
                            className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Member Vawng Rawh (Save & Add Next)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('members_list')}
                    className="py-3.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Users className="w-4 h-4 text-slate-600" />
                    <span>Member List En Rawh</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: STATEMENT PRINT WITH ORG SELECTOR & STANDARD AUDIT STATEMENT */}
          {activeTab === 'print_reports' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-black text-slate-900 uppercase flex items-center justify-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span>Financial Statement & Report Print Portal</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Audit Statement, Kohhran Master Ledger, emaw Mimal Passbook A4 format-ah a lo chhuak ang.
                </p>
              </div>

              {/* Print Configuration Box */}
              <div className="bg-slate-50 p-5 sm:p-6 rounded-3xl border border-slate-200 space-y-4">
                
                {/* 1. Org / Campaign Selector for Printing */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>1. Print Tur Organization / Bawm Thlanna:</span>
                  </label>
                  <select
                    value={printOrgScope}
                    onChange={(e) => {
                      setPrintOrgScope(e.target.value);
                      setPrintMemberId('');
                    }}
                    className="w-full p-2.5 bg-white border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {allowedCampaigns.map(camp => (
                      <option key={camp.id} value={camp.id}>
                        {formatCampaignOptionLabel(camp)}
                      </option>
                    ))}
                    {creatorProfile.isAdmin && (
                      <option value="all">🌐 All Campaigns (Consolidated Combined Report)</option>
                    )}
                    {!creatorProfile.isAdmin && allowedCampaigns.length > 1 && (
                      <option value="all">📂 Ka Bawm Zawng Zawng (Combined Report)</option>
                    )}
                  </select>
                </div>

                {/* 2. Format Selection (4 Formats) */}
                <div>
                  <label className="text-xs font-black text-slate-800 block mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>2. Report Format & Print Style:</span>
                  </label>
                  <select
                    value={printStyle}
                    onChange={(e) => setPrintStyle(e.target.value as any)}
                    className="w-full p-3 bg-white border-2 border-indigo-500 rounded-2xl text-xs font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="style1_master">
                      📋 Format 1: Kohhran / Pawl Master Ledger (Member zawng zawng Thla 12 Grid - Landscape)
                    </option>
                    <option value="style4_audit">
                      📊 Format 2: Standard Financial Audit Statement (Official Letterhead, Online/Cash Badges & Signatures)
                    </option>
                    <option value="style2_matrix">
                      📑 Format 3: Mimal Record (Horizontal Category Matrix - Thla 12)
                    </option>
                    <option value="style3_passbook">
                      💳 Format 4: Mimal Passbook Slip (Vertical Card Slip)
                    </option>
                  </select>
                </div>

                {/* If Mimal format, show Member selector */}
                {(printStyle === 'style2_matrix' || printStyle === 'style3_passbook') && (
                  <div className="animate-fadeIn p-3 bg-white border border-indigo-200 rounded-2xl space-y-1">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Member Thlang Rawh (Select Member for Personal Statement):
                    </label>
                    <select
                      value={printMemberId}
                      onChange={(e) => setPrintMemberId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="">-- Member Thlang Rawh ({printTargetMembers.length} Available) --</option>
                      {printTargetMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id}) {hasCampaignSections && m.section ? `• ${m.section}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Audit Statement Options */}
                {printStyle === 'style4_audit' && (
                  <div className="animate-fadeIn p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
                    <div className="text-xs font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Audit Statement Configuration</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeSignatures}
                          onChange={(e) => setIncludeSignatures(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Include Official Signatures (Recorder, Treasurer, Secretary)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeMonthlyChart}
                          onChange={(e) => setIncludeMonthlyChart(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Include Monthly Trend Visual Chart</span>
                      </label>
                    </div>

                    {includeMonthlyChart && (
                      <div className="pt-2 border-t border-indigo-200/70 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="text-[10.5px] font-black text-indigo-950 block">
                            Monthly Trend Chart Range (From – Upto):
                          </label>
                          {/* Quick 1-Click Range Presets */}
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => { setChartStartMonth('Jan'); setChartEndMonth('Dec'); }}
                              className={`text-[9.5px] px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                                chartStartMonth === 'Jan' && chartEndMonth === 'Dec'
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
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
                                  : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100'
                              }`}
                            >
                              Apr–Mar (Fin Year)
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-xl border border-indigo-200">
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">From (Start Month)</label>
                            <select
                              value={chartStartMonth}
                              onChange={(e) => setChartStartMonth(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                            >
                              {ALL_MONTH_NAMES_SHORT.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-700 block mb-1">Upto (End Month)</label>
                            <select
                              value={chartEndMonth}
                              onChange={(e) => setChartEndMonth(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                            >
                              {ALL_MONTH_NAMES_SHORT.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Print Button */}
                <button
                  type="button"
                  id="execute-statement-print-btn"
                  onClick={() => {
                    const activeCamp = printOrgScope !== 'all' ? campaigns.find(c => c.id === printOrgScope) : undefined;
                    const orgDisplay = activeCamp?.orgName || activeCamp?.title || creatorProfile.orgName || creatorProfile.name || 'RONPAY ORGANIZATION';
                    const logoDisplay = activeCamp?.imageUrl || creatorProfile.logoUrl;
                    const locationDisplay = activeCamp?.location || creatorProfile.address;

                    if (printStyle === 'style1_master') {
                      exportMasterLedgerPrint(
                        printTargetMembers, 
                        printTargetTransactions, 
                        activeCamp?.title || 'Consolidated Kumtluang Master Roll', 
                        orgDisplay,
                        logoDisplay,
                        locationDisplay
                      );
                    } else if (printStyle === 'style4_audit') {
                      printTransactionsPDF(
                        printTargetTransactions,
                        'Financial Audit Statement',
                        true,
                        activeCamp?.title || 'All Campaigns',
                        `Financial Year ${printYear}`,
                        logoDisplay,
                        'name-asc',
                        {
                          name: creatorProfile.name,
                          orgName: orgDisplay,
                          phone: creatorProfile.phone || '',
                          address: locationDisplay
                        },
                        {
                          includeMonthlyChart,
                          monthRangeConfig: {
                            startMonth: chartStartMonth,
                            endMonth: chartEndMonth
                          },
                          includeSignatures,
                          preparedByTitle: 'Prepared by (Treasurer / Recorder)',
                          verifiedByTitle: 'Verified by (Auditor / Finance)',
                          approvedByTitle: 'Approved by (Leader / Secretary)',
                          targetInfo: activeCamp?.targetAmount ? {
                            targetAmount: activeCamp.targetAmount,
                            targetPeriod: activeCamp.targetPeriod || 'total',
                            periodLabel: activeCamp.targetPeriod || 'Goal',
                            campaignTitle: activeCamp.title
                          } : undefined
                        }
                      );
                    } else if (printStyle === 'style2_matrix') {
                      if (!printMemberId) {
                        alert('Khawngaihin member thlang hmasa rawh le.');
                        return;
                      }
                      const m = printTargetMembers.find(x => x.id === printMemberId) || allMembersList.find(x => x.id === printMemberId);
                      if (m) {
                        exportMemberCategoryMatrixPrint(
                          m, 
                          campaignCategories, 
                          printTargetTransactions, 
                          orgDisplay,
                          logoDisplay,
                          locationDisplay
                        );
                      }
                    } else if (printStyle === 'style3_passbook') {
                      if (!printMemberId) {
                        alert('Khawngaihin member thlang hmasa rawh le.');
                        return;
                      }
                      const m = printTargetMembers.find(x => x.id === printMemberId) || allMembersList.find(x => x.id === printMemberId);
                      if (m) {
                        exportMemberPassbookVerticalPrint(
                          m, 
                          campaignCategories, 
                          printTargetTransactions, 
                          orgDisplay,
                          logoDisplay,
                          locationDisplay
                        );
                      }
                    }
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {printStyle === 'style1_master' && 'Print Format 1: Master Ledger (Landscape Grid)'}
                    {printStyle === 'style4_audit' && 'Print Format 2: Official Financial Audit Statement (PDF)'}
                    {printStyle === 'style2_matrix' && 'Print Format 3: Mimal Category Matrix'}
                    {printStyle === 'style3_passbook' && 'Print Format 4: Mimal Passbook Card Slip'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: MEMBER ROLL & EDIT / DELETE WITH DYNAMIC FILTERING */}
          {activeTab === 'members_list' && (
            <div className="space-y-4">
              {/* Filter Banner & Top Controls */}
              <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200 space-y-3">
                
                {/* Active QR Scope Status Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 shrink-0">
                      Active View:
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {selectedCampaignId === 'all' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-blue-100 text-blue-950 border border-blue-200 truncate">
                          🌐 Consolidated Master Roll (All Organizations)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-100 text-indigo-950 border border-indigo-200 truncate">
                          🏛️ {activeScopedCampaign?.orgName || activeScopedCampaign?.title || 'Selected Bawm'} [{activeScopedCampaign?.orgCode || 'QR'}]
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="table-quick-qr-filter" className="text-[10.5px] font-bold text-slate-600 shrink-0">
                      Filter QR:
                    </label>
                    <select
                      id="table-quick-qr-filter"
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      disabled={allowedCampaigns.length === 0}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {creatorProfile.isAdmin && (
                        <option value="all">🌐 All Lists ({allMembersList.length})</option>
                      )}
                      {!creatorProfile.isAdmin && allowedCampaigns.length > 1 && (
                        <option value="all">📂 Ka Bawm Zawng Zawng ({allMembersList.length})</option>
                      )}
                      {allowedCampaigns.length === 0 && (
                        <option value="">⚠️ Bawm a awm lo</option>
                      )}
                      {allowedCampaigns.map(c => (
                        <option key={c.id} value={c.id}>
                          {formatCampaignOptionLabel(c, campaignCounts[c.id] || 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Bar and Action Counter */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      id="member-roll-filter-search-input"
                      value={dirSearch}
                      onChange={(e) => setDirSearch(e.target.value)}
                      placeholder={hasCampaignSections ? "Hming, ID, Phone, Section zawnna..." : "Hming, ID, Phone zawnna..."}
                      className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    {dirSearch && (
                      <button
                        type="button"
                        onClick={() => setDirSearch('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-[11px] font-bold text-indigo-900 bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200">
                      {filteredTableMembers.length} {filteredTableMembers.length === 1 ? 'Member' : 'Members'} Listed
                    </span>

                    <button
                      type="button"
                      onClick={() => setActiveTab('register_member')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Add Member</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Cards View (sm/md screens) */}
              <div className="block md:hidden space-y-3">
                {filteredTableMembers.map(m => {
                  const memberCamp = campaigns.find(c => c.id === m.campaignId);
                  return (
                    <div key={m.id} className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shadow-xs">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                            ) : (
                              <span>{m.name.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-sm truncate">{m.name}</div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                                {m.id}
                              </span>
                              {hasCampaignSections && m.section && (
                                <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                  {m.section}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {selectedCampaignId === 'all' && (
                          <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-lg text-[9.5px] font-bold shrink-0">
                            {memberCamp?.orgCode || 'QR'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <span className="font-mono text-[11px]">
                          📱 {m.fullPhone ? m.fullPhone : `****${m.phoneLast4}`}
                        </span>
                        {m.dependents && m.dependents.length > 0 && (
                          <span className="text-[10px] text-slate-500 font-medium">
                            {m.dependents.length} Chhungte
                          </span>
                        )}
                      </div>

                      {m.dependents && m.dependents.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {m.dependents.map(d => (
                            <span key={d.subId} className="inline-block bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-mono text-[10px]">
                              {d.name} ({d.relation})
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectQuickMember(m);
                            setActiveTab('quick_entry');
                          }}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-xs text-center"
                        >
                          + Pay
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(m)}
                          className="px-3 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(m.id, m.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Members Table (Desktop / Tablet) */}
              <div className="hidden md:block border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="p-3">Member ID</th>
                        {selectedCampaignId === 'all' && (
                          <th className="p-3">QR / Bawm</th>
                        )}
                        <th className="p-3">Chhungkaw Hotu & Dependents</th>
                        <th className="p-3">Phone (Last 4)</th>
                        {hasCampaignSections && (
                          <th className="p-3">
                            {activeScopedCampaign?.sectionLabel || 'Section / Bial'}
                          </th>
                        )}
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredTableMembers.map(m => {
                        const memberCamp = campaigns.find(c => c.id === m.campaignId);
                        return (
                          <tr key={m.id} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="p-3 font-mono font-black text-indigo-700">
                              <span className="bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200/80">
                                {m.id}
                              </span>
                            </td>

                            {selectedCampaignId === 'all' && (
                              <td className="p-3">
                                <span className="inline-block bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-blue-200">
                                  {memberCamp?.orgName || memberCamp?.title || m.orgCode || 'General'}
                                </span>
                              </td>
                            )}

                            <td className="p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shadow-xs">
                                  {m.avatarUrl ? (
                                    <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span>{m.name.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900">{m.name}</div>
                                  {m.dependents && m.dependents.length > 0 && (
                                    <div className="text-[10px] text-slate-500 mt-0.5 space-x-1 flex flex-wrap gap-1">
                                      {m.dependents.map(d => (
                                        <span key={d.subId} className="inline-block bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 font-mono">
                                          {d.name} ({d.subId.split('-').pop()})
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-3 text-slate-600 font-mono font-bold">
                              {m.fullPhone ? m.fullPhone : `****${m.phoneLast4}`}
                            </td>

                            {hasCampaignSections && (
                              <td className="p-3 text-slate-600 font-medium">
                                {m.section ? (
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md text-[10.5px]">
                                    {m.section}
                                  </span>
                                ) : '-'}
                              </td>
                            )}

                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleSelectQuickMember(m);
                                    setActiveTab('quick_entry');
                                  }}
                                  className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg font-black text-[10.5px] transition cursor-pointer shadow-2xs"
                                  title="Add Quick Payment"
                                >
                                  + Pay
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(m)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Edit Member Details"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m.id, m.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete Member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredTableMembers.length === 0 && (
                        <tr>
                          <td colSpan={selectedCampaignId === 'all' ? 6 : 5} className="p-8 text-center text-slate-400">
                            <div className="max-w-md mx-auto space-y-3">
                              <Users className="w-10 h-10 text-slate-300 mx-auto" />
                              <div className="space-y-1">
                                <p className="text-xs font-black text-slate-700">
                                  {dirSearch ? 'Zawnna mil Member hmuh a ni lo.' : 'He QR/Bawm-ah hian Member an la awm lo.'}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {selectedCampaignId !== 'all'
                                    ? `[${activeScopedCampaign?.orgName || activeScopedCampaign?.title || 'Selected Bawm'}] ah hian member an la in register lo.`
                                    : 'Member an la awm lo.'}
                                </p>
                              </div>
                              
                              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                                {selectedCampaignId !== 'all' && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedCampaignId('all')}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                                  >
                                    🌐 All Lists En Rawh
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setDirSearch('');
                                    setActiveTab('register_member');
                                  }}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                                >
                                  + Member thar chhinchhiah rawh
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* EDIT MEMBER MODAL (For correcting mistakes) */}
      {editingMember && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shadow-xs">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Member Record Siamthatna (Edit)</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Tihsual palh siamthatna leh Chhungte thlakna</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              {/* Linked Bawm */}
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Linked Campaign / QR Bawm
                </label>
                <select
                  value={editCampaignId}
                  onChange={(e) => {
                    setEditCampaignId(e.target.value);
                    const c = allowedCampaigns.find(x => x.id === e.target.value);
                    if (c?.orgCode) {
                      setEditOrgCode(c.orgCode);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                >
                  {allowedCampaigns.map(c => (
                    <option key={c.id} value={c.id}>
                      {formatCampaignOptionLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Chhungkaw Hotu Hming *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700">
                    Full Phone Number (Digit 10)
                  </label>
                  <span className="text-[9.5px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    Auto-fills Last 4
                  </span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={editFullPhone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setEditFullPhone(digits);
                    if (digits.length >= 4) {
                      setEditPhone4(digits.slice(-4));
                    }
                  }}
                  placeholder="e.g. 9862123456"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Pawl Code (Prefix)
                  </label>
                  <input
                    type="text"
                    value={editOrgCode}
                    onChange={(e) => setEditOrgCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 uppercase focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Phone Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={editPhone4}
                    onChange={(e) => setEditPhone4(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div>
                {activeEditCampaign?.definedSections && activeEditCampaign.definedSections.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10.5px] font-bold text-slate-700">
                        {activeEditCampaign.sectionLabel || 'Section / Bial'}
                      </label>
                      {editSection && (
                        <button
                          type="button"
                          onClick={() => setEditSection('')}
                          className="text-[10px] text-rose-600 font-extrabold hover:underline cursor-pointer"
                        >
                          Paih / Clear Section
                        </button>
                      )}
                    </div>
                    <select
                      value={editSection}
                      onChange={(e) => setEditSection(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                    >
                      <option value="">-- A awm lo / Paih / None --</option>
                      {activeEditCampaign.definedSections.map((sec, idx) => (
                        <option key={idx} value={sec}>
                          {sec}
                        </option>
                      ))}
                      {editSection && !activeEditCampaign.definedSections.includes(editSection) && (
                        <option value={editSection}>{editSection} (Existing)</option>
                      )}
                    </select>
                  </>
                ) : editSection ? (
                  <div className="flex items-center justify-between p-2 bg-slate-100 rounded-xl border border-slate-200">
                    <span className="text-[11px] font-medium text-slate-700">Section Awmsa: <b className="text-slate-900">{editSection}</b></span>
                    <button
                      type="button"
                      onClick={() => setEditSection('')}
                      className="text-[10.5px] text-rose-600 font-extrabold hover:underline cursor-pointer"
                    >
                      Paih / Clear Section
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Photo Upload in Edit Modal */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mimal Thlalak / Profile Photo</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-slate-300 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                    {editAvatarUrl ? (
                      <img src={editAvatarUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoSelect(e, true)}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      disabled={isCompressing}
                      className="px-2.5 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{editAvatarUrl ? 'Thlak Rawh' : 'Thlalak Dah Rawh'}</span>
                    </button>
                    {editAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setEditAvatarUrl('')}
                        className="px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Paih Rawh
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Dependents in Edit Modal */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-900 uppercase">Dependents / Sub-IDs</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{editDependents.length} enrolled</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editDepName}
                    onChange={(e) => setEditDepName(e.target.value)}
                    placeholder="Chhungte Hming..."
                    className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  />
                  <select
                    value={editDepRel}
                    onChange={(e) => setEditDepRel(e.target.value)}
                    className="p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="Nupui">Nupui</option>
                    <option value="Pasal">Pasal</option>
                    <option value="Fa">Fa</option>
                    <option value="Nu">Nu</option>
                    <option value="Pa">Pa</option>
                    <option value="Nau">Nau</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddEditDependent}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {editDependents.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {editDependents.map((dep) => (
                      <div key={dep.subId} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                            {dep.subId}
                          </span>
                          <span className="font-bold text-slate-900">{dep.name}</span>
                          <span className="text-[10px] text-slate-500">({dep.relation})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEditDependent(dep.subId)}
                          className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const mToDel = editingMember;
                    setEditingMember(null);
                    handlePromptDeleteMember(mToDel);
                  }}
                  className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition cursor-pointer text-xs flex items-center gap-1.5 border border-rose-200 shadow-2xs"
                  title="Delete this member completely"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Member Paih</span>
                </button>
                <div className="flex gap-2 flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingMember(null)}
                    className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 max-w-[200px] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" /> Vawng / Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MEMBER MODAL */}
      {deletingMemberTarget && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn text-slate-800">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative my-auto space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-0.5 flex-1">
                <h3 className="text-base font-black text-slate-900">Member Paih (Delete) I Chiang Em?</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Duplicate / Mistake record paih bo na
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeletingMemberTarget(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Member ID:</span>
                <span className="font-mono font-black text-rose-900 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-300">
                  {deletingMemberTarget.member.id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Hming:</span>
                <span className="font-black text-slate-900">{deletingMemberTarget.member.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-mono font-bold text-slate-700">
                  {deletingMemberTarget.member.fullPhone || `****${deletingMemberTarget.member.phoneLast4}`}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-rose-200/80">
                <span className="text-slate-600 font-medium">Chhung lama records awm zat:</span>
                <span className="font-bold text-rose-950">
                  {deletingMemberTarget.txCount} txns (₹{deletingMemberTarget.totalAmount.toLocaleString('en-IN')})
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleExecuteDeleteMember(true)}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Member Leh A Chhunga Records ({deletingMemberTarget.txCount} txns) Paih Veк Rawh</span>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteDeleteMember(false)}
                className="w-full py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Member Chauh Paih (Ledger Record Dah Tha Rawh)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeletingMemberTarget(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-800 font-bold text-xs transition cursor-pointer"
              >
                Kansel / Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TRANSACTION MODAL */}
      {editingTx && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn text-slate-800">
          <div className="bg-white border border-indigo-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative my-auto shrink-0 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Thawhkhawm Record Siamthatna</h3>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {editingTx.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTx} className="space-y-4 text-xs">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Puitu / Member Hming <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editTxDonorName}
                  onChange={(e) => setEditTxDonorName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Pek Zat (Amount ₹) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      value={editTxAmount}
                      onChange={(e) => setEditTxAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={editTxPaymentMethod}
                    onChange={(e) => setEditTxPaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="cash">💵 Cash Counter</option>
                    <option value="online">⚡ Direct UPI / Online</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Fund Head / Category</label>
                  <select
                    value={editTxCategory}
                    onChange={(e) => setEditTxCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {campaignCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    {!campaignCategories.includes(editTxCategory) && editTxCategory && (
                      <option value={editTxCategory}>{editTxCategory}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Thla (Month)</label>
                  <select
                    value={editTxMonth}
                    onChange={(e) => setEditTxMonth(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {monthsList.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Kum (Year)</label>
                  <select
                    value={editTxYear}
                    onChange={(e) => setEditTxYear(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {['2024', '2025', '2026', '2027', '2028', '2029', '2030'].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Remark / Note</label>
                <input
                  type="text"
                  value={editTxRemark}
                  onChange={(e) => setEditTxRemark(e.target.value)}
                  placeholder="e.g. Inkhawm thawh / UTR ref"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleRequestDeleteTx(editingTx)}
                  className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl transition cursor-pointer text-xs flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Paih Bo Rawh (Delete)</span>
                </button>

                <div className="flex-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Siamthatna</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE TRANSACTION MODAL */}
      {deletingTx && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-fadeIn text-slate-800">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative my-auto text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-base font-black text-slate-900">Transaction Paih I Chiang Em?</h3>
              <p className="text-xs text-slate-500 mt-1">
                He thawhkhawm record (₹{deletingTx.amount?.toLocaleString('en-IN')} - {deletingTx.donorName}) hi database atangin paih hlen a ni dawn e.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-left text-xs font-medium space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">ID:</span>
                <span className="font-mono text-slate-800">{deletingTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pual / Hming:</span>
                <span className="font-bold text-slate-800">{deletingTx.donorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pek Zat:</span>
                <span className="font-black text-slate-900">₹{deletingTx.amount?.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTx}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Paih Bo Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DUPLICATE MEMBER MODAL */}
      {duplicateModalTarget && (
        <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-amber-300 shadow-2xl space-y-4 animate-scaleUp text-slate-800">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Member Duplicate A Awm Sa!</h3>
                <p className="text-xs text-amber-800 font-semibold mt-0.5">
                  {duplicateModalTarget.reason}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-2 text-xs">
              <div className="font-black text-slate-700 uppercase tracking-wider text-[10px]">
                Member Awm Sa (Existing Record):
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">ID & Hming:</span>
                <span className="font-bold text-slate-900">
                  <span className="font-mono text-indigo-700 font-black">{duplicateModalTarget.existingMember.id}</span> - {duplicateModalTarget.existingMember.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Phone:</span>
                <span className="font-mono font-bold text-slate-800">
                  {duplicateModalTarget.existingMember.fullPhone || `****${duplicateModalTarget.existingMember.phoneLast4}`}
                </span>
              </div>
              {duplicateModalTarget.existingMember.section && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Section / Bial:</span>
                  <span className="font-bold text-slate-800">{duplicateModalTarget.existingMember.section}</span>
                </div>
              )}
              {duplicateModalTarget.existingMember.dependents && duplicateModalTarget.existingMember.dependents.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Dependents:</span>
                  <span className="font-bold text-slate-800">{duplicateModalTarget.existingMember.dependents.length} members</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const existing = duplicateModalTarget.existingMember;
                  setDuplicateModalTarget(null);
                  handleOpenEdit(existing);
                }}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Awmsa Siamtha Rawh (Open in Edit)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  executeSaveMember(duplicateModalTarget.newDraft);
                }}
                className="w-full py-2.5 px-4 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300"
              >
                <span>Record Thar Hian Update / Overwrite Rawh</span>
              </button>

              <button
                type="button"
                onClick={() => setDuplicateModalTarget(null)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Kansel / Phone Dang Hmang Rawh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
