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
  Lock,
  ArrowRightLeft,
  UserMinus,
  RefreshCw,
  History,
  CalendarDays,
  Plus
} from 'lucide-react';
import { MemberRecord, MemberDependent, Campaign, Transaction, CreatorProfile } from '../types';
import { getMembers, saveMembers, addOrUpdateMember, deleteMember, saveTransaction, isCampaignCreator, saveCampaign } from '../utils/storage';
import { fetchMembersFromFirestore } from '../services/firestoreSync';
import { getUserRole } from '../utils/rbac';
import { 
  exportMasterLedgerPrint, 
  exportGroupMasterLedgerPrint,
  exportGeneralMasterLedgerPrint,
  exportMemberCategoryMatrixPrint, 
  exportGroupCategoryMatrixPrint,
  exportGeneralCategoryMatrixPrint,
  exportMemberPassbookVerticalPrint,
  exportGroupPassbookPrint,
  exportGeneralPassbookPrint,
  printTransactionsPDF,
  exportFormattedExcel,
  exportKumtluangMatrixToCSV
} from '../utils/export';
import { compressImageFile } from '../utils/imageCompressor';
import { ALL_MONTH_NAMES_FULL, getCurrentMonthName, getCurrentYearString, getYearOptions } from '../utils/monthHelper';
import { KumtluangExcelImportModal } from './KumtluangExcelImportModal';
import { CampaignTransferModal } from './CampaignTransferModal';
import { downloadSampleExcelTemplate } from '../utils/excelMemberImporter';
import {
  isMemberActiveInYear,
  getMemberActiveYears,
  getMemberYearStatusInfo,
  rolloverMembersToNewYear,
  updateMemberYearStatus,
  getAvailableRollYears
} from '../utils/memberYearRoll';

// Helper to check if a campaign was strictly created by this creator (strict ownership, no cross-creator leakage)
const isStrictCampaignOwner = (camp: Campaign, profile?: CreatorProfile | null): boolean => {
  if (!profile || !camp) return false;
  const userPhone = (profile.phone || '').trim().replace(/\D/g, '').slice(-10);
  const campCreatedByDigits = (camp.createdBy || '').trim().replace(/\D/g, '').slice(-10);
  const campCreatorPhone = ((camp as any).creatorPhone || (camp as any).contactPhone || '').trim().replace(/\D/g, '').slice(-10);

  if (userPhone && userPhone.length >= 8) {
    if (campCreatedByDigits && campCreatedByDigits === userPhone) return true;
    if (campCreatorPhone && campCreatorPhone === userPhone) return true;
    if (camp.createdBy && camp.createdBy === (profile.phone || '').trim()) return true;
  }

  const userName = (profile.name || '').trim().toLowerCase();
  const cleanUserName = userName.replace(/\s*\([^)]*\)/g, '').trim();
  const genericNames = ['user', 'guest', 'ronpay user', 'ronpay', 'donor', 'citizen', 'valued donor', 'anonymous', ''];
  if (cleanUserName && cleanUserName.length >= 3 && !genericNames.includes(cleanUserName)) {
    const campCreatedBy = (camp.createdBy || '').trim().toLowerCase();
    const campCreatorName = ((camp as any).creatorName || (camp as any).contactPerson || '').trim().toLowerCase();
    if (campCreatedBy && (campCreatedBy === userName || campCreatedBy === cleanUserName)) return true;
    if (campCreatorName && (campCreatorName === userName || campCreatorName === cleanUserName)) return true;
  }

  if (profile.orgName && (camp.orgName || camp.title)) {
    const pOrg = profile.orgName.trim().toLowerCase();
    const cOrg = (camp.orgName || camp.title).trim().toLowerCase();
    const genericOrgs = ['ronpay community', 'standard user', 'guest', 'ronpay', 'community', 'creator', 'user'];
    if (!genericOrgs.includes(pOrg) && pOrg.length >= 4 && (pOrg === cOrg || cOrg.includes(pOrg) || pOrg.includes(cOrg))) {
      return true;
    }
  }

  if ((userPhone === '9862300000' || userPhone === '9862311223') && 
      (campCreatedByDigits === '9862311223' || campCreatedByDigits === '9862300000')) {
    return true;
  }

  return false;
};

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

  const userRole = getUserRole(creatorProfile);
  const isPrivilegedUser = Boolean(
    creatorProfile?.isAdmin === true || 
    userRole === 'SUPER_ADMIN' || 
    userRole === 'ADMIN' || 
    userRole === 'MODERATOR'
  );

  // Helper to count members for a campaign directly
  const countCampaignMembers = useCallback((campId: string, orgCode?: string) => {
    const rawAll = getMembers('all');
    const code = (orgCode || '').toUpperCase();
    return rawAll.filter(m => {
      if (!m) return false;
      if (m.campaignId === campId) return true;
      if (code && m.orgCode && m.orgCode.toUpperCase() === code) return true;
      if (code && m.id && m.id.split('-')[0].toUpperCase() === code) return true;
      return false;
    }).length;
  }, []);

  // Calculate scoped campaigns strictly owned/created by this creator (or all if admin/moderator)
  const allowedCampaigns = useMemo(() => {
    // 1. Strictly filter to 'kumtluang' category only (Exclude ralna, khawlsak, rikrum)
    const kumtluangCampaigns = campaigns.filter(c => {
      if (c.category !== 'kumtluang') return false;
      // Filter out duplicate mock YMA campaign if present
      if (c.id === 'cmp-kumtluang-ymavt' && campaigns.some(x => x.id === 'cmp-1787829303143')) return false;
      return true;
    });

    if (isPrivilegedUser) {
      // For Super Admin, Admin, and Moderator: show all valid Kumtluang campaigns.
      // Filter out empty mock/phuahchawp Bawm with 0 members that have no transactions
      return kumtluangCampaigns.filter(c => {
        if (!c.id || !c.title) return false;
        const count = countCampaignMembers(c.id, c.orgCode);
        if (count > 0) return true;
        const hasTx = transactions.some(t => t.campaignId === c.id);
        if (hasTx) return true;
        if (isStrictCampaignOwner(c, creatorProfile)) return true;
        return false;
      });
    }

    // For regular Creator: STRICT ISOLATION!
    // A Creator must ONLY see the Bawm they created themselves.
    // They must NEVER see Bawms created by other creators.
    return kumtluangCampaigns.filter(c => isStrictCampaignOwner(c, creatorProfile));
  }, [campaigns, creatorProfile, isPrivilegedUser, transactions, countCampaignMembers]);

  const allowedCampaignIds = useMemo(() => new Set(allowedCampaigns.map(c => c.id)), [allowedCampaigns]);
  const allowedOrgCodes = useMemo(() => new Set(allowedCampaigns.map(c => (c.orgCode || '').toUpperCase()).filter(Boolean)), [allowedCampaigns]);

  // Helper to filter any members array to only this creator's scope
  const filterMembersForScope = useCallback((list: MemberRecord[]) => {
    if (isPrivilegedUser) return list;
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
  }, [isPrivilegedUser, allowedCampaigns.length, allowedCampaignIds, allowedOrgCodes]);

  // Safe getter for scoped members based on campaign ID
  const getScopedMembersForView = useCallback((campId: string) => {
    if (allowedCampaigns.length === 0 && !isPrivilegedUser) {
      return [];
    }
    if (campId === 'all') {
      const allM = getMembers('all');
      return filterMembersForScope(allM);
    }
    if (!isPrivilegedUser && !allowedCampaignIds.has(campId)) {
      return [];
    }
    const campMembers = getMembers(campId);
    return filterMembersForScope(campMembers);
  }, [allowedCampaigns.length, isPrivilegedUser, filterMembersForScope, allowedCampaignIds]);

  // Active Global QR / Bawm Filter ('all' or campaign.id)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  // Quick Entry State
  const [quickPhone4, setQuickPhone4] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [selectedPayerType, setSelectedPayerType] = useState<string>('primary'); // 'primary' or subId
  const [quickEntryCampaignId, setQuickEntryCampaignId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isAddingNewHead, setIsAddingNewHead] = useState<boolean>(false);
  const [newHeadInput, setNewHeadInput] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthName);
  const [selectedYear, setSelectedYear] = useState<string>(getCurrentYearString);
  const [entryAmount, setEntryAmount] = useState<string>('500');
  const [entryRemark, setEntryRemark] = useState<string>('');
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);

  // Excel Import Modal State
  const [isExcelImportOpen, setIsExcelImportOpen] = useState<boolean>(false);
  const [excelImportInitialMode, setExcelImportInitialMode] = useState<'file' | 'paste'>('file');

  // New Member Registration State
  const [regTargetCampaignId, setRegTargetCampaignId] = useState<string>('');
  const [newHming, setNewHming] = useState<string>('');
  const [newFatherName, setNewFatherName] = useState<string>('');
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
  const [regRollYear, setRegRollYear] = useState<string>(() => getCurrentYearString());

  // SECY / Creator Campaign Handover State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferSuccessInfo, setTransferSuccessInfo] = useState<{ title: string; newOfficer: string; phone: string } | null>(null);

  // Year-wise Member Roll (Kum bi Roll) State
  const [selectedRollYear, setSelectedRollYear] = useState<string>(() => getCurrentYearString());
  const [rollStatusFilter, setRollStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  const [isRolloverModalOpen, setIsRolloverModalOpen] = useState<boolean>(false);
  const [rolloverSourceYear, setRolloverSourceYear] = useState<string>(() => String(Number(getCurrentYearString()) - 1));
  const [rolloverTargetYear, setRolloverTargetYear] = useState<string>(() => getCurrentYearString());
  const [rolloverSuccessMsg, setRolloverSuccessMsg] = useState<string | null>(null);

  // Year Deactivation / Removal Dialog State
  const [deactivateTargetMember, setDeactivateTargetMember] = useState<MemberRecord | null>(null);
  const [deactivateReason, setDeactivateReason] = useState<'transferred_out' | 'deceased' | 'inactive'>('transferred_out');
  const [deactivateNote, setDeactivateNote] = useState<string>('');

  // Editing Member State
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null);
  const [editCampaignId, setEditCampaignId] = useState<string>('');
  const [editName, setEditName] = useState<string>('');
  const [editFatherName, setEditFatherName] = useState<string>('');
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
  const [printStyle, setPrintStyle] = useState<'style1_master' | 'style1_group_master' | 'style1_general_master' | 'style2_matrix' | 'style3_passbook' | 'style4_audit'>('style1_master');
  const [printScopeType, setPrintScopeType] = useState<'member' | 'group' | 'general'>('member');
  const [printMemberId, setPrintMemberId] = useState<string>('');
  const [printGroupId, setPrintGroupId] = useState<string>('');
  const [printGeneralId, setPrintGeneralId] = useState<string>('');
  const [printYear, setPrintYear] = useState<string>('2026');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includeMonthlyChart, setIncludeMonthlyChart] = useState<boolean>(true);
  const [masterLedgerSortOrder, setMasterLedgerSortOrder] = useState<'name_asc' | 'id_asc' | 'section' | 'amount_desc' | 'name_desc'>('name_asc');

  // Search in directory
  const [dirSearch, setDirSearch] = useState<string>('');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const defaultCategories = ['BMP Fund'];

  // Initialize and synchronize campaign selection & member roll
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'members_list');
      setSelectedMonth(getCurrentMonthName());
      setSelectedYear(getCurrentYearString());
      
      let activeId = '';
      if (allowedCampaigns.length > 0) {
        if (initialCampaignId && allowedCampaignIds.has(initialCampaignId)) {
          activeId = initialCampaignId;
        } else if (selectedCampaignId && (selectedCampaignId === 'all' ? (isPrivilegedUser || allowedCampaigns.length > 1) : allowedCampaignIds.has(selectedCampaignId))) {
          activeId = selectedCampaignId;
        } else {
          const initialCamp = allowedCampaigns.find(c => c.category === 'kumtluang') || allowedCampaigns[0];
          activeId = initialCamp?.id || allowedCampaigns[0]?.id || '';
        }
      } else if (isPrivilegedUser) {
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
  }, [isOpen, allowedCampaigns, initialTab, initialCampaignId, isPrivilegedUser, getScopedMembersForView, allowedCampaignIds]);

  // Fetch fresh members on demand when Kumtluang modal opens (eliminates 24/7 background listener reads)
  useEffect(() => {
    if (isOpen) {
      fetchMembersFromFirestore().catch(() => {});
    }
  }, [isOpen]);

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
      if (!selectedCampaignId || (allowedCampaigns.length === 0 && !isPrivilegedUser)) {
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
  }, [selectedCampaignId, isOpen, allowedCampaigns, getScopedMembersForView, isPrivilegedUser]);

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

  const campaignCategories = useMemo(() => {
    const subs = Array.isArray(activeScopedCampaign?.subCategories) && activeScopedCampaign.subCategories.length > 0
      ? activeScopedCampaign.subCategories
      : defaultCategories;
    return subs;
  }, [activeScopedCampaign, defaultCategories]);

  const handleAddNewHead = () => {
    const trimmed = newHeadInput.trim();
    if (!trimmed) return;
    if (activeScopedCampaign) {
      const currentSubs = Array.isArray(activeScopedCampaign.subCategories) ? activeScopedCampaign.subCategories : [];
      if (!currentSubs.includes(trimmed)) {
        const updatedSubs = [...currentSubs, trimmed];
        const updatedCamp = { ...activeScopedCampaign, subCategories: updatedSubs };
        saveCampaign(updatedCamp);
      }
    }
    setSelectedCategory(trimmed);
    setNewHeadInput('');
    setIsAddingNewHead(false);
  };

  // Auto-sync selected category with campaign's available categories
  useEffect(() => {
    if (campaignCategories.length > 0) {
      if (!selectedCategory || !campaignCategories.includes(selectedCategory)) {
        setSelectedCategory(campaignCategories[0]);
      }
    }
  }, [campaignCategories, selectedCategory]);

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
    const cleanCampTitle = (targetCampaign?.title || 'Kumtluang Bawm').replace(/,+$/, '').trim();
    const txRemark = `${selectedMonth} ${selectedYear} [${selectedCategory}] ${entryRemark ? `- ${entryRemark}` : ''} (ID: ${payerId})`;

    const newTx: Transaction = {
      id: `TX-MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      campaignId: targetCampaign?.id || 'cmp-1788107291420',
      campaignTitle: cleanCampTitle,
      category: 'kumtluang',
      donorName: payerName,
      donorType: 'member',
      donorPhone: selectedMember.fullPhone || `****${selectedMember.phoneLast4}`,
      donorVeng: selectedMember.section || '',
      isAnonymous: false,
      amount: amt,
      platformFee: 0,
      totalAmount: amt,
      timestamp: new Date().toISOString(),
      txHash: `CASH-${payerId}-${Date.now().toString().slice(-6)}`,
      status: 'completed',
      paymentMethod: 'cash',
      referenceNo: `CASH-${payerId}-${Date.now().toString().slice(-6)}`,
      remark: txRemark,
      isSynced: true,
      createdAt: new Date().toISOString(),
      subCategory: selectedCategory,
      subCategoryBreakdown: { [selectedCategory]: amt },
      periodMonth: selectedMonth,
      periodYear: selectedYear,
      platformFeeBearer: 'org_paid'
    };

    saveTransaction(newTx);
    setEntrySuccess(`₹${amt.toLocaleString('en-IN')} (${selectedCategory} - ${selectedMonth}) chu ${payerName} (${payerId}) pualin record fel a ni ta!`);
    onDataUpdated();
    setTimeout(() => {
      setEntrySuccess(null);
      setEntryRemark('');
    }, 4000);
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

  // Handle Full Phone Input in Registration (Max 10 digits, auto-fills last 4 digits)
  const handleFullPhoneChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setNewFullPhone(cleaned);
    if (cleaned.length >= 4) {
      const p4 = cleaned.slice(-4);
      setNewPhone4(p4);
      handlePhoneChange(p4);
    }
  };

  // Check duplicate when typing in Registration
  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
    setNewPhone4(cleaned);
    if (cleaned.length >= 4) {
      const p4 = cleaned.slice(-4);
      const allList = getMembers('all');
      const exists = allList.find(m => m.orgCode === newOrgCode.toUpperCase() && m.phoneLast4 === p4);
      if (exists) {
        setDuplicateWarning(`Hriattirna: ${newOrgCode}-${p4} (${exists.name}) hi a awm sa tawh a, duplicate awm lohnan enchiang rawh.`);
      } else {
        setDuplicateWarning(null);
      }
    } else {
      setDuplicateWarning(null);
    }
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

    // Convert draft dependents into MemberDependent objects with subIds
    const formattedDependents: MemberDependent[] = newDependents.map((dep, idx) => ({
      subId: `${generatedId}-${String(idx + 1).padStart(2, '0')}`,
      name: dep.name,
      relation: dep.relation
    }));

    const rollYearToEnroll = regRollYear || selectedRollYear || getCurrentYearString();
    const newM: MemberRecord = {
      id: generatedId,
      campaignId: targetCamp?.id || 'cmp-kumtluang-1',
      name: newHming.trim(),
      fatherName: newFatherName.trim() || undefined,
      orgCode: org,
      phoneLast4: p4,
      fullPhone: newFullPhone.trim() || undefined,
      section: newSection.trim() || undefined,
      avatarUrl: newAvatarUrl || undefined,
      isFamilyHead: true,
      dependents: formattedDependents,
      enrollmentYear: rollYearToEnroll,
      activeYears: [rollYearToEnroll],
      yearStatus: {
        [rollYearToEnroll]: {
          status: 'active',
          reason: 'Initial registration / In-chhiar thar',
          section: newSection.trim() || undefined,
          updatedAt: new Date().toISOString()
        }
      },
      createdAt: new Date().toISOString()
    };

    addOrUpdateMember(newM);
    
    // Explicitly reload members scoped to the current dropdown filter
    const updated = getMembers(selectedCampaignId);
    setMembers(updated);

    setRegSuccess(`Member [${generatedId}] ${newHming} ${formattedDependents.length > 0 ? `leh dependent ${formattedDependents.length}` : ''} chu vawn fel a ni ta!`);
    setSelectedMember(newM);
    setSelectedPayerType('primary');
    setQuickPhone4(newM.phoneLast4);
    if (targetCamp?.id) {
      setQuickEntryCampaignId(targetCamp.id);
    }
    
    // Reset form so user can immediately register the next member
    setNewHming('');
    setNewFatherName('');
    setNewPhone4('');
    setNewFullPhone('');
    setNewSection('');
    setNewAvatarUrl('');
    setNewDependents([]);
    setDuplicateWarning(null);
    onDataUpdated();
    
    // Do not automatically switch tabs away so creator can add multiple members continuously
    setTimeout(() => {
      setRegSuccess(null);
    }, 6000);
  };

  // Open Edit Member Modal
  const handleOpenEdit = (m: MemberRecord) => {
    setEditingMember(m);
    setEditCampaignId(m.campaignId || campaigns[0]?.id || '');
    setEditName(m.name);
    setEditFatherName(m.fatherName || '');
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
      ...editingMember,
      id: newId,
      campaignId: editCampaignId || editingMember.campaignId || activeScopedCampaign?.id,
      name: editName.trim() || editingMember.name,
      fatherName: editFatherName.trim() || undefined,
      orgCode: org,
      phoneLast4: p4,
      fullPhone: editFullPhone.trim() || undefined,
      section: editSection.trim() || undefined,
      avatarUrl: editAvatarUrl || undefined,
      isFamilyHead: true,
      dependents: updatedDeps,
      createdAt: editingMember.createdAt,
      enrollmentYear: editingMember.enrollmentYear || selectedRollYear,
      activeYears: editingMember.activeYears && editingMember.activeYears.length > 0 ? editingMember.activeYears : [selectedRollYear],
      yearStatus: editingMember.yearStatus
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

  // Rollover members from previous year to new year (Annual Roll Rollover)
  const handleExecuteRollover = () => {
    if (rolloverSourceYear === rolloverTargetYear) {
      alert('Kum hmasa (Source) leh Kum thar (Target) a inang thei lo.');
      return;
    }

    const allCurrent = getMembers();
    const { updatedMembers, rolledOverCount } = rolloverMembersToNewYear(
      allCurrent,
      rolloverSourceYear,
      rolloverTargetYear,
      selectedCampaignId === 'all' ? undefined : selectedCampaignId
    );

    saveMembers(updatedMembers);
    const refreshed = getScopedMembersForView(selectedCampaignId);
    setMembers(refreshed);
    setSelectedRollYear(rolloverTargetYear);
    setRollStatusFilter('active');
    setRolloverSuccessMsg(`✅ Member ${rolledOverCount}-te chu Kum ${rolloverTargetYear} Roll-ah hlawhtling takin chhawm luh an ni ta!`);
    onDataUpdated();
    setTimeout(() => {
      setIsRolloverModalOpen(false);
      setRolloverSuccessMsg(null);
    }, 2000);
  };

  // Deactivate member for a specific year (Pem chhuak / Boral / Inactive - keeps past years safe!)
  const handleDeactivateMemberForYear = () => {
    if (!deactivateTargetMember) return;
    const reasonText = deactivateNote.trim() || 
      (deactivateReason === 'transferred_out' ? 'Pem chhuak' : deactivateReason === 'deceased' ? 'Boral' : 'Chawl lailawk');
    const updated = updateMemberYearStatus(
      deactivateTargetMember,
      selectedRollYear,
      deactivateReason,
      reasonText
    );
    addOrUpdateMember(updated);
    const refreshed = getScopedMembersForView(selectedCampaignId);
    setMembers(refreshed);
    setDeactivateTargetMember(null);
    setDeactivateNote('');
    onDataUpdated();
  };

  // Re-activate member in roll for specific year
  const handleReactivateMemberForYear = (m: MemberRecord) => {
    const updated = updateMemberYearStatus(
      m,
      selectedRollYear,
      'active',
      `Kum ${selectedRollYear} Roll-ah in-chhiar leh`
    );
    addOrUpdateMember(updated);
    const refreshed = getScopedMembersForView(selectedCampaignId);
    setMembers(refreshed);
    onDataUpdated();
  };

  // Delete Member
  const handleDeleteMember = (memberId: string, memberName: string) => {
    if (window.confirm(`Member "${memberName}" (${memberId}) hi hlumhlut takin paih (delete permanently) i chiang em?`)) {
      deleteMember(memberId, selectedCampaignId);
      const updated = getMembers(selectedCampaignId);
      setMembers(updated);
      if (selectedMember?.id === memberId) {
        setSelectedMember(null);
      }
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
      counts[c.id] = getScopedMembersForView(c.id).length;
    });
    return counts;
  }, [allowedCampaigns, getScopedMembersForView, members, isOpen]);

  // Filtered members for Member Roll Table with Year-wise and Status filtering
  const filteredTableMembers = useMemo(() => {
    return members.filter(m => {
      if (!m) return false;

      // Year & Active Status filtering
      if (selectedRollYear !== 'all') {
        const isActiveThisYear = isMemberActiveInYear(m, selectedRollYear);
        if (rollStatusFilter === 'active' && !isActiveThisYear) return false;
        if (rollStatusFilter === 'inactive' && isActiveThisYear) return false;
      }

      if (!dirSearch.trim()) return true;
      const q = dirSearch.toLowerCase().trim();
      const matchName = m.name ? m.name.toLowerCase().includes(q) : false;
      const matchId = m.id ? m.id.toLowerCase().includes(q) : false;
      const matchPhone = (m.phoneLast4 && m.phoneLast4.includes(q)) || (m.fullPhone && m.fullPhone.includes(q)) || false;
      const matchSec = m.section ? m.section.toLowerCase().includes(q) : false;
      const matchDep = m.dependents ? m.dependents.some(d => (d.name && d.name.toLowerCase().includes(q)) || (d.subId && d.subId.toLowerCase().includes(q))) : false;
      return matchName || matchId || matchPhone || matchSec || matchDep;
    });
  }, [members, dirSearch, selectedRollYear, rollStatusFilter]);

  const rollYearActiveCount = useMemo(() => {
    if (selectedRollYear === 'all') return members.length;
    return members.filter(m => isMemberActiveInYear(m, selectedRollYear)).length;
  }, [members, selectedRollYear]);

  const rollYearInactiveCount = useMemo(() => {
    if (selectedRollYear === 'all') return 0;
    return members.filter(m => !isMemberActiveInYear(m, selectedRollYear)).length;
  }, [members, selectedRollYear]);

  const availableRollYearsList = useMemo(() => {
    return getAvailableRollYears(members);
  }, [members]);

  // Target campaign for Print Tab
  const printTargetCampaign = printOrgScope !== 'all' 
    ? allowedCampaigns.find(c => c.id === printOrgScope) 
    : undefined;

  const printTargetTransactions = useMemo(() => {
    if (printOrgScope === 'all') {
      if (isPrivilegedUser) return transactions;
      return transactions.filter(t => allowedCampaignIds.has(t.campaignId));
    }
    return transactions.filter(t => 
      t.campaignId === printOrgScope || 
      (printTargetCampaign?.title && t.campaignTitle === printTargetCampaign.title) ||
      (printTargetCampaign?.orgCode && (t.memberId?.startsWith(`${printTargetCampaign.orgCode}-`) || t.txHash?.includes(printTargetCampaign.orgCode)))
    );
  }, [transactions, printOrgScope, printTargetCampaign, allowedCampaignIds, isPrivilegedUser]);

  const printTargetMembers = useMemo(() => {
    if (printOrgScope === 'all') {
      return filterMembersForScope(getMembers('all'));
    }
    return getMembers(printOrgScope);
  }, [printOrgScope, allowedCampaigns, filterMembersForScope]);

  // Available Groups for Group Ledger / Matrix / Passbook
  const availableGroups = useMemo(() => {
    const map = new Map<string, { name: string; section?: string; total: number }>();
    printTargetTransactions.forEach(t => {
      const isGroup = t.donorType === 'group' || (t.groupName && t.groupName.trim() !== '');
      if (isGroup) {
        const name = (t.groupName || t.donorName || '').trim();
        if (name) {
          const prev = map.get(name) || { name, section: t.donorVeng, total: 0 };
          prev.total += (t.amount || 0);
          if (t.donorVeng && !prev.section) prev.section = t.donorVeng;
          map.set(name, prev);
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [printTargetTransactions]);

  // Available General Collections for General Ledger / Matrix / Passbook
  const availableGenerals = useMemo(() => {
    const map = new Map<string, { title: string; section?: string; total: number }>();
    printTargetTransactions.forEach(t => {
      const isGen = t.donorType === 'general';
      if (isGen) {
        const title = ((t as any).generalCollectionTitle || t.donorName || 'General Thawhlawm').trim();
        const prev = map.get(title) || { title, section: t.donorVeng, total: 0 };
        prev.total += (t.amount || 0);
        if (t.donorVeng && !prev.section) prev.section = t.donorVeng;
        map.set(title, prev);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
  }, [printTargetTransactions]);

  if (!isOpen) return null;

  // Enforce QR Creator exclusive access check (Admin/SuperAdmin/Moderator or approved creator)
  const isAuthorizedCreator = creatorProfile.isApproved || isPrivilegedUser;

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
              Kir Leh Rawh (Close)
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
                  {isPrivilegedUser ? 'Admin Master Roll' : (creatorProfile.designation || 'Creator Verified')}
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
          
          <div className="flex items-center gap-2 max-w-lg w-full">
            <div className="relative flex-1">
              <select
                id="active-bawm-dropdown"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                disabled={allowedCampaigns.length === 0}
                className="w-full pl-3.5 pr-8 py-2.5 bg-white border-2 border-indigo-400 hover:border-indigo-600 rounded-xl text-xs font-black text-indigo-950 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer appearance-none truncate disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isPrivilegedUser && (
                  <option value="all">
                    🌐 All Lists (Bawm Zawng Zawng) — Consolidated Master Roll ({allMembersList.length} Members)
                  </option>
                )}
                {!isPrivilegedUser && allowedCampaigns.length > 1 && (
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
                    🏛️ {camp.orgName || camp.title} [{camp.orgCode || 'QR'}] — {campaignCounts[camp.id] || 0} Members
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-indigo-700">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>

            {/* SECY / Creator Handover Button */}
            {activeScopedCampaign && (
              <button
                type="button"
                id="btn-kumtluang-transfer"
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-black text-xs rounded-xl shadow-xs transition cursor-pointer active:scale-95 shrink-0"
                title="Creator / SECY nihna mi thar hnenah hlan chhawng rawh (Annual Office Bearer Handover)"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">SECY Handover</span>
                <span className="sm:hidden">Handover</span>
              </button>
            )}
          </div>
        </div>

        {/* Official Transfer Success Alert */}
        {transferSuccessInfo && (
          <div className="bg-emerald-600 text-white p-2.5 px-4 sm:px-6 flex items-center justify-between text-xs font-bold animate-fadeIn shrink-0 shadow-inner">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
              <span>
                ✅ <strong>{transferSuccessInfo.title}</strong> enkawlna chu <strong>{transferSuccessInfo.newOfficer}</strong> (Phone: {transferSuccessInfo.phone}) hnenah hlawhtling taka hlan a ni ta!
              </span>
            </div>
            <button
              onClick={() => setTransferSuccessInfo(null)}
              className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-200 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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

          <div className="ml-auto flex items-center py-1.5 shrink-0 pl-2 gap-1.5">
            <button
              type="button"
              id="btn-open-quick-paste"
              onClick={() => {
                setExcelImportInitialMode('paste');
                setIsExcelImportOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition cursor-pointer active:scale-95 shrink-0"
              title="Paste member list directly from WhatsApp or Notes"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-200" />
              <span>Quick Paste</span>
            </button>

            <button
              type="button"
              id="btn-open-excel-import"
              onClick={() => {
                setExcelImportInitialMode('file');
                setIsExcelImportOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition cursor-pointer active:scale-95 shrink-0"
              title="Upload Excel or CSV sheet to import members in bulk"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
              <span>Import Excel / CSV</span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE MAIN CONTENT BODY */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 bg-white">
          {allowedCampaigns.length === 0 && (
            <div className="mb-4 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
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
                                Phone: ****{m.phoneLast4} • {m.section || 'General'}
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
                          <option key={c.id} value={c.id}>{c.title} [{c.orgCode || 'QR'}]</option>
                        ))}
                      </select>
                    </div>

                    {/* Category, Month & Year */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-bold text-slate-700 block">Fund Head / Category</label>
                          <button
                            type="button"
                            onClick={() => setIsAddingNewHead(!isAddingNewHead)}
                            className="text-[9.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                            title="Add a new Fund Head for this Bawm"
                          >
                            <Plus className="w-3 h-3" /> + Head Thar
                          </button>
                        </div>
                        {isAddingNewHead && (
                          <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-indigo-50 border border-indigo-200 rounded-xl">
                            <input
                              type="text"
                              value={newHeadInput}
                              onChange={(e) => setNewHeadInput(e.target.value)}
                              placeholder="e.g. Ramthar / Building Fund..."
                              className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={handleAddNewHead}
                              className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => { setIsAddingNewHead(false); setNewHeadInput(''); }}
                              className="text-slate-400 hover:text-slate-600 p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
                          {ALL_MONTH_NAMES_FULL.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Kum (Year)</label>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          {getYearOptions(1, 3).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Amount & Remark */}
                    <div className="grid grid-cols-2 gap-3">
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

                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Remark (Optional)</label>
                        <input
                          type="text"
                          value={entryRemark}
                          onChange={(e) => setEntryRemark(e.target.value)}
                          placeholder="e.g. Inkhawm thawh / Cash"
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!selectedMember}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      <Check className="w-4 h-4" />
                      <span>Thawhkhawm Chhinchhiah Rawh (Save Cash Payment)</span>
                    </button>
                  </form>
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
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-2 text-xs font-bold text-amber-900 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              {/* Quick Excel / WhatsApp Import Banner */}
              <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5 shadow-2xs">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-black text-emerald-950 block text-xs">Excel Sheet emaw WhatsApp Text aṭangin Member List import i duh em?</span>
                    <span className="text-[11px] text-emerald-800">Excel upload bakah WhatsApp text copy &amp; paste mai theihna 'Quick Paste Box' fel fai takin a awm bawk e.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const targetCamp = allowedCampaigns.find(c => c.id === regTargetCampaignId) || activeScopedCampaign || allowedCampaigns[0];
                      downloadSampleExcelTemplate(targetCamp?.orgCode || 'BET');
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition cursor-pointer shadow-2xs"
                  >
                    Template (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExcelImportInitialMode('paste');
                      setIsExcelImportOpen(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                    title="Paste directly from WhatsApp / Notes"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-200" />
                    <span>📋 Quick Paste</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExcelImportInitialMode('file');
                      setIsExcelImportOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Import Excel &rarr;</span>
                  </button>
                </div>
              </div>

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

                {/* Target Bawm & Roll Year Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Select Target QR / Bawm: <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={regTargetCampaignId}
                      onChange={(e) => setRegTargetCampaignId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    >
                      {allowedCampaigns.map(c => (
                        <option key={c.id} value={c.id}>
                          🏛️ {c.orgName || c.title} [Prefix: {c.orgCode || 'QR'}]
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      📅 Kum bi (Roll Year): <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={regRollYear}
                      onChange={(e) => setRegRollYear(e.target.value)}
                      className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl text-xs font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    >
                      {availableRollYearsList.map(yr => (
                        <option key={yr} value={yr}>
                          Kum {yr} {yr === getCurrentYearString() ? '(Current)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Chhungkaw Hotu Hming (Member Full Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newHming}
                      onChange={(e) => setNewHming(e.target.value)}
                      placeholder="e.g. Rammuanpuia Ralte"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Pa Hming (Father / Guardian Name)
                    </label>
                    <input
                      type="text"
                      value={newFatherName}
                      onChange={(e) => setNewFatherName(e.target.value)}
                      placeholder="e.g. C. Lalthanga (Optional)"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
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
                      onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
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

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {activeRegisterCampaign?.sectionLabel || 'Section / Bial / Veng'} (Thlanna)
                  </label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- Thlang Rawh ({activeRegisterCampaign?.sectionLabel || 'Bial / Section'}) --</option>
                    {(activeRegisterCampaign?.definedSections && activeRegisterCampaign.definedSections.length > 0
                      ? activeRegisterCampaign.definedSections
                      : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                    ).map((sec, idx) => (
                      <option key={idx} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>

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
                        🏛️ {camp.orgName || camp.title} [{camp.orgCode || 'QR'}]
                      </option>
                    ))}
                    {isPrivilegedUser && (
                      <option value="all">🌐 All Campaigns (Consolidated Combined Report)</option>
                    )}
                    {!isPrivilegedUser && allowedCampaigns.length > 1 && (
                      <option value="all">📂 Ka Bawm Zawng Zawng (Combined Report)</option>
                    )}
                  </select>
                </div>

                {/* 2. Format Selection (Expanded with Group and General options) */}
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
                      📋 Format 1a: Kohhran / Pawl Master Ledger (👤 Mimal - Thla 12 Grid)
                    </option>
                    <option value="style1_group_master">
                      👥 Format 1b: Group & Unit Master Ledger (👥 Pawl / Unit - Thla 12 Grid)
                    </option>
                    <option value="style1_general_master">
                      🏛️ Format 1c: General & Inkhawm Thawhlawm Ledger (🏛️ Thawhlawm - Thla 12 Grid)
                    </option>
                    <option value="style4_audit">
                      📊 Format 2: Standard Financial Audit Statement (Official Letterhead & Signatures)
                    </option>
                    <option value="style2_matrix">
                      📑 Format 3: Category Matrix (Mimal / Group / General)
                    </option>
                    <option value="style3_passbook">
                      💳 Format 4: Passbook Slip (Mimal / Group / General)
                    </option>
                  </select>
                </div>

                {/* If matrix or passbook format, show Record Scope & Target Selectors */}
                {(printStyle === 'style2_matrix' || printStyle === 'style3_passbook') && (
                  <div className="animate-fadeIn p-3.5 bg-white border border-indigo-200 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-slate-800">
                        Record Scope Thlang Rawh (Scope Selection):
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPrintScopeType('member')}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                            printScopeType === 'member'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          👤 Mimal Member
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintScopeType('group')}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                            printScopeType === 'group'
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          👥 Group / Unit
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintScopeType('general')}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                            printScopeType === 'general'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          🏛️ General Thawhlawm
                        </button>
                      </div>
                    </div>

                    {/* Member Dropdown */}
                    {printScopeType === 'member' && (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">
                          Member Thlang Rawh:
                        </label>
                        <select
                          value={printMemberId}
                          onChange={(e) => setPrintMemberId(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                        >
                          <option value="">-- Member Thlang Rawh ({printTargetMembers.length} Available) --</option>
                          {printTargetMembers.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.id}) {m.section ? `• ${m.section}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Group Dropdown */}
                    {printScopeType === 'group' && (
                      <div>
                        <label className="text-[11px] font-bold text-indigo-900 block mb-1">
                          Group / Unit Thlang Rawh ({availableGroups.length} available):
                        </label>
                        <select
                          value={printGroupId || (availableGroups.length > 0 ? availableGroups[0].name : '')}
                          onChange={(e) => setPrintGroupId(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                        >
                          {availableGroups.length === 0 && <option value="">-- Group record hmuh tur a awm rih lo --</option>}
                          {availableGroups.map(g => (
                            <option key={g.name} value={g.name}>👥 {g.name} {g.section ? `• ${g.section}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* General Dropdown */}
                    {printScopeType === 'general' && (
                      <div>
                        <label className="text-[11px] font-bold text-emerald-900 block mb-1">
                          General Thawhlawm Thlang Rawh ({availableGenerals.length} available):
                        </label>
                        <select
                          value={printGeneralId || (availableGenerals.length > 0 ? availableGenerals[0].title : '')}
                          onChange={(e) => setPrintGeneralId(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                        >
                          {availableGenerals.length === 0 && <option value="">-- General Thawhlawm record a awm rih lo --</option>}
                          {availableGenerals.map(g => (
                            <option key={g.title} value={g.title}>🏛️ {g.title} {g.section ? `• ${g.section}` : ''}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Master Ledger Order Options */}
                {printStyle === 'style1_master' && (
                  <div className="animate-fadeIn p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-black text-indigo-950 shrink-0 flex items-center gap-1.5">
                      <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">A-Z</span>
                      <span>Mimal Master Ledger Order:</span>
                    </span>
                    <select
                      value={masterLedgerSortOrder}
                      onChange={(e) => setMasterLedgerSortOrder(e.target.value as any)}
                      className="flex-1 bg-white border-2 border-indigo-300 hover:border-indigo-500 rounded-xl p-2 text-xs font-black text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-2xs"
                    >
                      <option value="name_asc">🔤 Hming A-Z (Alphabetical) — Default</option>
                      <option value="name_desc">🔤 Hming Z-A (Reverse Alphabetical)</option>
                      <option value="id_asc">🔢 Member ID Danin (BMPSHL-001...)</option>
                      <option value="section">🏘️ Section / Bial Danin</option>
                      <option value="amount_desc">💰 Sum Thawh Tam Danin (Highest to Lowest)</option>
                    </select>
                    <span className="text-[9.5px] font-bold text-blue-800 bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg shrink-0">
                      👤 Mimal Chiah
                    </span>
                  </div>
                )}

                {/* Group Ledger Order Options */}
                {printStyle === 'style1_group_master' && (
                  <div className="animate-fadeIn p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-black text-indigo-950 shrink-0 flex items-center gap-1.5">
                      <span className="bg-indigo-700 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">👥</span>
                      <span>Group Ledger Order:</span>
                    </span>
                    <select
                      value={masterLedgerSortOrder}
                      onChange={(e) => setMasterLedgerSortOrder(e.target.value as any)}
                      className="flex-1 bg-white border-2 border-indigo-300 hover:border-indigo-500 rounded-xl p-2 text-xs font-black text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer shadow-2xs"
                    >
                      <option value="name_asc">🔤 Group Hming A-Z</option>
                      <option value="name_desc">🔤 Group Hming Z-A</option>
                      <option value="amount_desc">💰 Thawh Tam Danin</option>
                    </select>
                    <span className="text-[9.5px] font-bold text-indigo-800 bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg shrink-0">
                      👥 {availableGroups.length} Groups
                    </span>
                  </div>
                )}

                {/* General Ledger Order Options */}
                {printStyle === 'style1_general_master' && (
                  <div className="animate-fadeIn p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs font-black text-emerald-950 shrink-0 flex items-center gap-1.5">
                      <span className="bg-emerald-700 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">🏛️</span>
                      <span>General Ledger Order:</span>
                    </span>
                    <select
                      value={masterLedgerSortOrder}
                      onChange={(e) => setMasterLedgerSortOrder(e.target.value as any)}
                      className="flex-1 bg-white border-2 border-emerald-300 hover:border-emerald-500 rounded-xl p-2 text-xs font-black text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-300 cursor-pointer shadow-2xs"
                    >
                      <option value="name_asc">🔤 Thawhlawm Hming A-Z</option>
                      <option value="name_desc">🔤 Thawhlawm Hming Z-A</option>
                      <option value="amount_desc">💰 Thawh Tam Danin</option>
                    </select>
                    <span className="text-[9.5px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-1 rounded-lg shrink-0">
                      🏛️ {availableGenerals.length} Collections
                    </span>
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
                      // Strict Isolation: Member Ledger only includes individual member transactions
                      const memberOnlyTxns = printTargetTransactions.filter(t => 
                        t.donorType !== 'group' && t.donorType !== 'general' && (!t.groupName || t.groupName.trim() === '')
                      );
                      exportMasterLedgerPrint(
                        printTargetMembers, 
                        memberOnlyTxns, 
                        activeCamp?.title || 'Consolidated Kumtluang Master Roll', 
                        orgDisplay,
                        logoDisplay,
                        locationDisplay,
                        masterLedgerSortOrder
                      );
                    } else if (printStyle === 'style1_group_master') {
                      if (availableGroups.length === 0) {
                        alert('Group / Unit record hmuh tur a awm rih lo.');
                        return;
                      }
                      exportGroupMasterLedgerPrint(
                        availableGroups,
                        printTargetTransactions,
                        activeCamp?.title || 'Group & Unit Master Ledger',
                        orgDisplay,
                        logoDisplay,
                        locationDisplay,
                        masterLedgerSortOrder
                      );
                    } else if (printStyle === 'style1_general_master') {
                      if (availableGenerals.length === 0) {
                        alert('General / Inkhawm Thawhlawm record a awm rih lo.');
                        return;
                      }
                      exportGeneralMasterLedgerPrint(
                        availableGenerals,
                        printTargetTransactions,
                        activeCamp?.title || 'General Thawhlawm Ledger',
                        orgDisplay,
                        logoDisplay,
                        locationDisplay,
                        masterLedgerSortOrder
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
                      if (printScopeType === 'group') {
                        const targetGroup = availableGroups.find(g => g.name === printGroupId) || availableGroups[0];
                        if (!targetGroup) {
                          alert('Khawngaihin Group / Unit thlang hmasa rawh le.');
                          return;
                        }
                        exportGroupCategoryMatrixPrint(
                          targetGroup.name,
                          campaignCategories,
                          printTargetTransactions,
                          orgDisplay,
                          logoDisplay,
                          locationDisplay,
                          targetGroup.section
                        );
                      } else if (printScopeType === 'general') {
                        const targetGeneral = availableGenerals.find(g => g.title === printGeneralId) || availableGenerals[0];
                        if (!targetGeneral) {
                          alert('Khawngaihin General Thawhlawm thlang hmasa rawh le.');
                          return;
                        }
                        exportGeneralCategoryMatrixPrint(
                          targetGeneral.title,
                          campaignCategories,
                          printTargetTransactions,
                          orgDisplay,
                          logoDisplay,
                          locationDisplay
                        );
                      } else {
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
                      }
                    } else if (printStyle === 'style3_passbook') {
                      if (printScopeType === 'group') {
                        const targetGroup = availableGroups.find(g => g.name === printGroupId) || availableGroups[0];
                        if (!targetGroup) {
                          alert('Khawngaihin Group / Unit thlang hmasa rawh le.');
                          return;
                        }
                        exportGroupPassbookPrint(
                          targetGroup.name,
                          campaignCategories,
                          printTargetTransactions,
                          orgDisplay,
                          logoDisplay,
                          locationDisplay,
                          targetGroup.section
                        );
                      } else if (printScopeType === 'general') {
                        const targetGeneral = availableGenerals.find(g => g.title === printGeneralId) || availableGenerals[0];
                        if (!targetGeneral) {
                          alert('Khawngaihin General Thawhlawm thlang hmasa rawh le.');
                          return;
                        }
                        exportGeneralPassbookPrint(
                          targetGeneral.title,
                          campaignCategories,
                          printTargetTransactions,
                          orgDisplay,
                          logoDisplay,
                          locationDisplay
                        );
                      } else {
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
                    }
                  }}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 cursor-pointer active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    {printStyle === 'style1_master' && 'Print Format 1a: Mimal Master Ledger (Landscape Grid)'}
                    {printStyle === 'style1_group_master' && 'Print Format 1b: Group & Unit Master Ledger (Landscape Grid)'}
                    {printStyle === 'style1_general_master' && 'Print Format 1c: General Thawhlawm Ledger (Landscape Grid)'}
                    {printStyle === 'style4_audit' && 'Print Format 2: Official Financial Audit Statement (PDF)'}
                    {printStyle === 'style2_matrix' && `Print Format 3: ${printScopeType === 'group' ? 'Group Matrix' : printScopeType === 'general' ? 'General Matrix' : 'Mimal Category Matrix'}`}
                    {printStyle === 'style3_passbook' && `Print Format 4: ${printScopeType === 'group' ? 'Group Passbook' : printScopeType === 'general' ? 'General Passbook' : 'Mimal Passbook Card Slip'}`}
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
                      {isPrivilegedUser && (
                        <option value="all">🌐 All Lists ({allMembersList.length})</option>
                      )}
                      {!isPrivilegedUser && allowedCampaigns.length > 1 && (
                        <option value="all">📂 Ka Bawm Zawng Zawng ({allMembersList.length})</option>
                      )}
                      {allowedCampaigns.length === 0 && (
                        <option value="">⚠️ Bawm a awm lo</option>
                      )}
                      {allowedCampaigns.map(c => (
                        <option key={c.id} value={c.id}>
                          🏛️ {c.orgCode || 'QR'} - {c.orgName || c.title} ({campaignCounts[c.id] || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Year-wise Member Roll (Kum bi) Control Bar */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3 sm:p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm border border-indigo-800/60">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-wider text-indigo-300 block">
                          Kum bi (Roll Year):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedRollYear}
                            onChange={(e) => setSelectedRollYear(e.target.value)}
                            className="bg-indigo-900/90 border border-indigo-400 text-white font-black text-xs px-2.5 py-1 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-xs"
                          >
                            {availableRollYearsList.map(yr => (
                              <option key={yr} value={yr} className="bg-slate-900 text-white">
                                Kum {yr} {yr === getCurrentYearString() ? '(Live Roll)' : ''}
                              </option>
                            ))}
                            <option value="all" className="bg-slate-900 text-white">
                              🌐 Kum zawng zawng (All Years)
                            </option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Status Tabs: Active vs Inactive */}
                    {selectedRollYear !== 'all' && (
                      <div className="flex items-center bg-indigo-900/80 p-0.5 sm:p-1 rounded-xl border border-indigo-800 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() => setRollStatusFilter('active')}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            rollStatusFilter === 'active'
                              ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                              : 'text-indigo-200 hover:text-white'
                          }`}
                        >
                          Active ({rollYearActiveCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRollStatusFilter('inactive')}
                          className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                            rollStatusFilter === 'inactive'
                              ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                              : 'text-indigo-200 hover:text-white'
                          }`}
                        >
                          Pem / Inactive ({rollYearInactiveCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setRollStatusFilter('all')}
                          className={`px-2 py-1 rounded-lg transition cursor-pointer ${
                            rollStatusFilter === 'all'
                              ? 'bg-white text-indigo-950 font-black shadow-xs'
                              : 'text-indigo-200 hover:text-white'
                          }`}
                        >
                          All ({members.length})
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Rollover / Annual Copy Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id="btn-open-year-rollover"
                      onClick={() => {
                        setRolloverTargetYear(selectedRollYear === 'all' ? getCurrentYearString() : selectedRollYear);
                        setRolloverSourceYear(String(Number(selectedRollYear === 'all' ? getCurrentYearString() : selectedRollYear) - 1));
                        setIsRolloverModalOpen(true);
                      }}
                      className="w-full md:w-auto px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      title="Kum hmasa a mi kum tharah chhawm rawh (Rollover / Copy forward)"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Kum Thar Roll Siamna (Rollover)</span>
                    </button>
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
                      placeholder="Hming, ID, Phone, Section zawnna..."
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

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                    <span className="text-[11px] font-bold text-indigo-900 bg-indigo-100 px-3 py-1.5 rounded-xl border border-indigo-200">
                      {filteredTableMembers.length} {filteredTableMembers.length === 1 ? 'Member' : 'Members'} Listed
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setExcelImportInitialMode('paste');
                        setIsExcelImportOpen(true);
                      }}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
                      title="Paste member list directly from WhatsApp / Notes"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-200" />
                      <span>📋 Quick Paste</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setExcelImportInitialMode('file');
                        setIsExcelImportOpen(true);
                      }}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
                      title="Import members from Excel / CSV"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                      <span>📥 Import Excel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('register_member')}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
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
                  const yearInfo = getMemberYearStatusInfo(m, selectedRollYear);
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
                            {m.fatherName && (
                              <div className="text-[11px] text-slate-500 font-medium">Pa: {m.fatherName}</div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[10px]">
                                {m.id}
                              </span>
                              {selectedRollYear !== 'all' && (
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-bold border ${yearInfo.badgeClass}`}>
                                  {yearInfo.label}
                                </span>
                              )}
                              {m.section && (
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

                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 flex-wrap">
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
                        {selectedRollYear !== 'all' && (
                          yearInfo.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => setDeactivateTargetMember(m)}
                              className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1"
                              title={`Kum ${selectedRollYear} Roll atanga Hlih / Pem`}
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Hlih</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReactivateMemberForYear(m)}
                              className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1"
                              title={`Kum ${selectedRollYear} Roll-ah in-chhiar leh rawh`}
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>In-chhiar leh</span>
                            </button>
                          )
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteMember(m.id, m.name)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Hlumhlut takin paih"
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
                        <th className="p-3">Section / Bial</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredTableMembers.map(m => {
                        const memberCamp = campaigns.find(c => c.id === m.campaignId);
                        const yearInfo = getMemberYearStatusInfo(m, selectedRollYear);
                        return (
                          <tr key={m.id} className="hover:bg-indigo-50/40 transition-colors">
                            <td className="p-3">
                              <div className="flex flex-col gap-1 items-start">
                                <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-200/80">
                                  {m.id}
                                </span>
                                {selectedRollYear !== 'all' && (
                                  <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold border ${yearInfo.badgeClass}`}>
                                    {yearInfo.label}
                                  </span>
                                )}
                              </div>
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
                                  {m.fatherName && (
                                    <div className="text-[10px] text-slate-500 font-medium">Pa: {m.fatherName}</div>
                                  )}
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

                            <td className="p-3 text-slate-600 font-medium">
                              {m.section ? (
                                <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md text-[10.5px]">
                                  {m.section}
                                </span>
                              ) : '-'}
                            </td>

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
                                {selectedRollYear !== 'all' && (
                                  yearInfo.status === 'active' ? (
                                    <button
                                      type="button"
                                      onClick={() => setDeactivateTargetMember(m)}
                                      className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                      title={`Kum ${selectedRollYear} Roll atanga Hlih / Pem`}
                                    >
                                      <UserMinus className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleReactivateMemberForYear(m)}
                                      className="px-2 py-0.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                      title={`Kum ${selectedRollYear} Roll-ah in-chhiar leh rawh`}
                                    >
                                      <UserCheck className="w-3 h-3" />
                                      <span>In-chhiar leh</span>
                                    </button>
                                  )
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m.id, m.name)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Delete Member Permanently"
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
                      {c.orgName || c.title} [{c.orgCode || 'QR'}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Chhungkaw Hotu Hming (Member Name) *
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
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Pa Hming (Father / Guardian Name)
                </label>
                <input
                  type="text"
                  value={editFatherName}
                  onChange={(e) => setEditFatherName(e.target.value)}
                  placeholder="e.g. C. Lalthanga (Optional)"
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
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  {activeEditCampaign?.sectionLabel || 'Section / Bial'}
                </label>
                <select
                  value={editSection}
                  onChange={(e) => setEditSection(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                >
                  <option value="">-- Thlang Rawh ({activeEditCampaign?.sectionLabel || 'Bial / Section'}) --</option>
                  {(activeEditCampaign?.definedSections && activeEditCampaign.definedSections.length > 0
                    ? activeEditCampaign.definedSections
                    : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                  ).map((sec, idx) => (
                    <option key={idx} value={sec}>
                      {sec}
                    </option>
                  ))}
                  {editSection && !activeEditCampaign?.definedSections?.includes(editSection) && (
                    <option value={editSection}>{editSection} (Existing)</option>
                  )}
                </select>
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

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Vawng / Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Annual Roll Rollover Modal (Kum Thar Roll Siamna) */}
      {isRolloverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    Kum Thar Member Roll Siamna
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Kum hmasa roll a mi kum thar roll-ah chhawmna (Annual Roll Rollover)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRolloverModalOpen(false);
                  setRolloverSuccessMsg(null);
                }}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {rolloverSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{rolloverSuccessMsg}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-500">Target Bawm:</span>
                <span className="font-black text-slate-800 truncate">
                  {selectedCampaignId === 'all' ? '🌐 All Lists (Consolidated)' : (activeScopedCampaign?.orgName || activeScopedCampaign?.title || 'Selected Bawm')}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Kohhran / Pawl-ah kum tin in-chhiar thar a awm thin a. Kum hmasa a member active zawng zawngte hi kum tharah hian chhawm luh vek an ni ang a, chumi hnuah kum thar atang hian an chanchin i <strong>edit / add / remove</strong> thei ang.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  1. Kum Hmasa (Source Year):
                </label>
                <select
                  value={rolloverSourceYear}
                  onChange={(e) => setRolloverSourceYear(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {availableRollYearsList.map(yr => (
                    <option key={yr} value={yr}>Kum {yr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  2. Kum Thar Tur (Target Year):
                </label>
                <select
                  value={rolloverTargetYear}
                  onChange={(e) => setRolloverTargetYear(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-indigo-500 rounded-xl text-xs font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  {availableRollYearsList.map(yr => (
                    <option key={yr} value={yr}>Kum {yr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 text-xs space-y-1.5">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-[11px]">
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                Historical Record Him Tlatna:
              </span>
              <p className="text-[10.5px] text-indigo-800 leading-snug">
                Kum {rolloverSourceYear}-a member-te sum thawh tawh leh Passbook records zawng zawng a bo lo vang. Kum {rolloverTargetYear} atan roll thar a in-hawng chauh dawn a ni.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsRolloverModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRollover}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Kum {rolloverTargetYear} Roll-ah Chhawm Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate Member for Year Modal (Pem / Boral / Inactive) */}
      {deactivateTargetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 border border-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <UserMinus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    Member Roll atanga Hlihna
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Kum {selectedRollYear} Roll atanga lakchhuahna
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeactivateTargetMember(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Member:</span>
                <span className="font-bold text-slate-900">{deactivateTargetMember.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Member ID:</span>
                <span className="font-mono font-bold text-indigo-700">{deactivateTargetMember.id}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Roll Year:</span>
                <span className="font-bold text-amber-700">Kum {selectedRollYear}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Hlih / Paih duh chhan thlang rawh: <span className="text-red-500">*</span>
                </label>
                <select
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value as any)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="transferred_out">Pem Chhuak (Veng / Kohhran dangah an in-sawn)</option>
                  <option value="deceased">Boral (Mitthi / Chhiatna)</option>
                  <option value="inactive">Chawl Lailawk (Kum {selectedRollYear} roll-ah telh loh)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Chhinchhiahna / Remark (Optional):
                </label>
                <input
                  type="text"
                  value={deactivateNote}
                  onChange={(e) => setDeactivateNote(e.target.value)}
                  placeholder="e.g. Mission Veng-ah an pem chhuak ta e"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Past Records Retained:
                </span>
                <p>
                  He member hi Kum {selectedRollYear} Roll atang chauhvin hlih a ni ang a. Kum hmasa a a thawh tawh leh Passbook records te chu a him reng ang.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeactivateTargetMember(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivateMemberForYear}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white transition flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Kum {selectedRollYear} Roll atangin Hlih Rawh</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Transfer Modal (SECY / Creator Handover) */}
      <CampaignTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        campaign={activeScopedCampaign}
        currentCreator={creatorProfile || null}
        onTransferred={(updatedCampaign) => {
          setIsTransferModalOpen(false);
          setTransferSuccessInfo({
            title: updatedCampaign.title,
            newOfficer: updatedCampaign.creatorName || updatedCampaign.contactPerson || 'New Officer',
            phone: updatedCampaign.contactPhone || updatedCampaign.createdBy || ''
          });
          onDataUpdated();
        }}
      />

      {/* Excel / CSV Bulk Importer Modal */}
      <KumtluangExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        campaigns={allowedCampaigns}
        selectedCampaignId={selectedCampaignId || activeScopedCampaign?.id}
        initialMode={excelImportInitialMode}
        onImportComplete={(savedMembers) => {
          // Refresh member records list immediately
          const updated = getMembers(selectedCampaignId);
          setMembers(updated);
        }}
      />
    </div>
  );
};
