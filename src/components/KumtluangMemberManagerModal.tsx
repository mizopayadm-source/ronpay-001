import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  DollarSign
} from 'lucide-react';
import { MemberRecord, MemberDependent, Campaign, Transaction, CreatorProfile } from '../types';
import { getMembers, addOrUpdateMember, deleteMember, saveTransaction, isCampaignCreator } from '../utils/storage';
import { 
  exportMasterLedgerPrint, 
  exportMemberCategoryMatrixPrint, 
  exportMemberPassbookVerticalPrint,
  printTransactionsPDF,
  exportFormattedExcel,
  exportKumtluangMatrixToCSV
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
  onDataUpdated,
  onOpenCreateQR
}) => {
  const [activeTab, setActiveTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>(initialTab || 'members_list');
  const [members, setMembers] = useState<MemberRecord[]>([]);

  // Calculate scoped campaigns strictly owned/created by this creator (or all if admin)
  const allowedCampaigns = useMemo(() => {
    if (creatorProfile.isAdmin) {
      return campaigns;
    }
    return campaigns.filter(c => isCampaignCreator(c, creatorProfile));
  }, [campaigns, creatorProfile]);

  const allowedCampaignIds = useMemo(() => new Set(allowedCampaigns.map(c => c.id)), [allowedCampaigns]);
  const allowedOrgCodes = useMemo(() => new Set(allowedCampaigns.map(c => (c.orgCode || '').toUpperCase()).filter(Boolean)), [allowedCampaigns]);

  // Helper to filter any members array to only this creator's scope
  const filterMembersForScope = (list: MemberRecord[]) => {
    if (creatorProfile.isAdmin) return list;
    return list.filter(m => {
      if (m.campaignId && allowedCampaignIds.has(m.campaignId)) return true;
      if (m.orgCode && allowedOrgCodes.has(m.orgCode.toUpperCase())) return true;
      return false;
    });
  };

  // Active Global QR / Bawm Filter ('all' or campaign.id)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');

  // Quick Entry State
  const [quickPhone4, setQuickPhone4] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [selectedPayerType, setSelectedPayerType] = useState<string>('primary'); // 'primary' or subId
  const [quickEntryCampaignId, setQuickEntryCampaignId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Pathian Ram Zauna');
  const [selectedMonth, setSelectedMonth] = useState<string>('August');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [entryAmount, setEntryAmount] = useState<string>('500');
  const [entryRemark, setEntryRemark] = useState<string>('');
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);

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
  const [printOrgScope, setPrintOrgScope] = useState<string>('all');
  const [printStyle, setPrintStyle] = useState<'style1_master' | 'style2_matrix' | 'style3_passbook' | 'style4_audit'>('style1_master');
  const [printMemberId, setPrintMemberId] = useState<string>('');
  const [printYear, setPrintYear] = useState<string>('2026');
  const [includeSignatures, setIncludeSignatures] = useState<boolean>(true);
  const [includeMonthlyChart, setIncludeMonthlyChart] = useState<boolean>(true);

  // Search in directory
  const [dirSearch, setDirSearch] = useState<string>('');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const defaultCategories = ['Pathian Ram Zauna', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];

  // Initialize and synchronize campaign selection & member roll
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'members_list');
      const initialCamp = allowedCampaigns.find(c => c.category === 'kumtluang') || allowedCampaigns[0];
      const defaultId = initialCamp?.id || 'all';
      
      // Keep selectedCampaignId if already set, else default to first campaign or 'all'
      const activeId = selectedCampaignId && (selectedCampaignId === 'all' || allowedCampaignIds.has(selectedCampaignId)) 
        ? selectedCampaignId 
        : defaultId;
      setSelectedCampaignId(activeId);
      setQuickEntryCampaignId(initialCamp?.id || allowedCampaigns[0]?.id || '');
      setRegTargetCampaignId(initialCamp?.id || allowedCampaigns[0]?.id || '');
      setPrintOrgScope(activeId);

      const mList = filterMembersForScope(getMembers(activeId));
      setMembers(mList);

      if (initialCamp?.orgCode) {
        setNewOrgCode(initialCamp.orgCode);
      }
    }
  }, [isOpen, allowedCampaigns, initialTab]);

  // When selectedCampaignId changes, reload scoped members
  useEffect(() => {
    if (isOpen && selectedCampaignId) {
      const mList = filterMembersForScope(getMembers(selectedCampaignId));
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
        setPrintOrgScope('all');
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
  }, [selectedCampaignId, isOpen, allowedCampaigns]);

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
    : allowedCampaigns.find(c => c.id === quickEntryCampaignId)) || allowedCampaigns[0];

  const campaignCategories = (activeScopedCampaign?.subCategories && activeScopedCampaign.subCategories.length > 0)
    ? activeScopedCampaign.subCategories
    : defaultCategories;

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
    const txRemark = `${selectedMonth} ${selectedYear} [${selectedCategory}] ${entryRemark ? `- ${entryRemark}` : ''} (ID: ${payerId})`;

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
      txHash: `CASH-${payerId}-${Date.now().toString().slice(-6)}`,
      status: 'completed',
      paymentMethod: 'cash',
      referenceNo: `CASH-${payerId}-${Date.now().toString().slice(-6)}`,
      remark: txRemark,
      isSynced: true,
      createdAt: new Date().toISOString(),
      subCategory: selectedCategory,
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

  // Check duplicate when typing in Registration
  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
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
      alert(language === 'english' ? 'Please enter 4 digits phone suffix' : 'Phone number tawp digit 4 chhu lut rawh');
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

    const newM: MemberRecord = {
      id: generatedId,
      campaignId: targetCamp?.id || 'cmp-kumtluang-1',
      name: newHming.trim(),
      orgCode: org,
      phoneLast4: p4,
      fullPhone: newFullPhone.trim() || undefined,
      section: newSection.trim() || undefined,
      avatarUrl: newAvatarUrl || undefined,
      isFamilyHead: true,
      dependents: formattedDependents,
      createdAt: new Date().toISOString()
    };

    addOrUpdateMember(newM);
    
    // Explicitly reload members scoped to the current dropdown filter
    const updated = getMembers(selectedCampaignId);
    setMembers(updated);

    setRegSuccess(`Member thar [${generatedId}] ${newHming} ${formattedDependents.length > 0 ? `leh dependent ${formattedDependents.length}` : ''} chu vawn fel a ni ta!`);
    setSelectedMember(newM);
    setSelectedPayerType('primary');
    setQuickPhone4(newM.phoneLast4);
    if (targetCamp?.id) {
      setQuickEntryCampaignId(targetCamp.id);
    }
    
    // Reset form
    setNewHming('');
    setNewPhone4('');
    setNewFullPhone('');
    setNewSection('');
    setNewAvatarUrl('');
    setNewDependents([]);
    setDuplicateWarning(null);
    onDataUpdated();
    
    setTimeout(() => {
      setRegSuccess(null);
      setActiveTab('members_list');
    }, 1800);
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
      section: editSection.trim() || undefined,
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

  // Delete Member
  const handleDeleteMember = (memberId: string, memberName: string) => {
    if (window.confirm(`Member "${memberName}" (${memberId}) hi paih (delete) i chiang em?`)) {
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
      counts[c.id] = allMembersList.filter(m => m.campaignId === c.id || (c.orgCode && m.orgCode === c.orgCode)).length;
    });
    return counts;
  }, [allowedCampaigns, allMembersList]);

  // Filtered members for Member Roll Table
  const filteredTableMembers = useMemo(() => {
    return members.filter(m => {
      if (!dirSearch.trim()) return true;
      const q = dirSearch.toLowerCase().trim();
      const matchName = m.name.toLowerCase().includes(q);
      const matchId = m.id.toLowerCase().includes(q);
      const matchPhone = m.phoneLast4.includes(q) || (m.fullPhone && m.fullPhone.includes(q));
      const matchSec = m.section && m.section.toLowerCase().includes(q);
      const matchDep = m.dependents && m.dependents.some(d => d.name.toLowerCase().includes(q) || d.subId.toLowerCase().includes(q));
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
    return transactions.filter(t => t.campaignId === printOrgScope || (printTargetCampaign?.title && t.campaignTitle === printTargetCampaign.title));
  }, [transactions, printOrgScope, printTargetCampaign, allowedCampaignIds, creatorProfile]);

  const printTargetMembers = useMemo(() => {
    return filterMembersForScope(getMembers(printOrgScope));
  }, [printOrgScope, members, allowedCampaigns]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-4 sm:my-6 flex flex-col max-h-[94vh]">
        
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
                className="w-full pl-3.5 pr-8 py-2.5 bg-white border-2 border-indigo-400 hover:border-indigo-600 rounded-xl text-xs font-black text-indigo-950 shadow-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer appearance-none truncate"
              >
                <option value="all">
                  🌐 All Lists (Bawm Zawng Zawng) — Consolidated Master Roll ({allMembersList.length} Members)
                </option>
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white">
          {allowedCampaigns.length === 0 ? (
            <div className="max-w-md mx-auto py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-50 border border-indigo-200 rounded-3xl flex items-center justify-center mx-auto text-indigo-600 shadow-xs">
                <Building2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900">Bawm Siam a la awm lo</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  I account ({creatorProfile.name || creatorProfile.phone}) hian Kumtluang / Organization Bawm siam i la nei lo a ni. Creator tin hian mahni mimal siam theuh chauh an enkawl thei a ni.
                </p>
              </div>
              {onOpenCreateQR && (
                <button
                  type="button"
                  onClick={onOpenCreateQR}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs shadow-md transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Bawm Thar Siam Rawh</span>
                </button>
              )}
            </div>
          ) : (
            <>
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
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              {duplicateWarning && (
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-2 text-xs font-bold text-amber-900 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{duplicateWarning}</span>
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
                    Chhungkaw Hotu Hming (Family Head Full Name) <span className="text-red-500">*</span>
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
                      placeholder="e.g. 1460"
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Full Phone (Optional)</label>
                    <input
                      type="tel"
                      value={newFullPhone}
                      onChange={(e) => setNewFullPhone(e.target.value)}
                      placeholder="e.g. 9436141460"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Section / Bial / Veng
                    </label>
                    <select
                      value={newSection}
                      onChange={(e) => setNewSection(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="">-- Thlang Rawh (Bial / Section) --</option>
                      {(activeScopedCampaign?.definedSections && activeScopedCampaign.definedSections.length > 0
                        ? activeScopedCampaign.definedSections
                        : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                      ).map((sec, idx) => (
                        <option key={idx} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </div>
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

                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Chhungkaw Record Vawng Rawh (Save & Link to Roll)</span>
                </button>
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
                    onChange={(e) => setPrintOrgScope(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-indigo-300 rounded-xl text-xs font-black text-indigo-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="all">🌐 All Campaigns (Consolidated Report — {printTargetTransactions.length} Txns / {allMembersList.length} Members)</option>
                    {allowedCampaigns.map(camp => (
                      <option key={camp.id} value={camp.id}>
                        🏛️ {camp.orgName || camp.title} [{camp.orgCode || 'QR'}]
                      </option>
                    ))}
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
                        <option key={m.id} value={m.id}>{m.name} ({m.id}) {m.section ? `• ${m.section}` : ''}</option>
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
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="all">🌐 All Lists ({allMembersList.length})</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>
                          🏛️ {c.orgCode || 'QR'} - {c.orgName || c.title} ({campaignCounts[c.id] || 0})
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
                        <th className="p-3">Section / Bial</th>
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

          </>
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
                    onChange={(e) => setEditPhone4(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Full Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editFullPhone}
                    onChange={(e) => setEditFullPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Section / Bial
                  </label>
                  <select
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                  >
                    <option value="">-- Thlang Rawh --</option>
                    {(activeScopedCampaign?.definedSections && activeScopedCampaign.definedSections.length > 0
                      ? activeScopedCampaign.definedSections
                      : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                    ).map((sec, idx) => (
                      <option key={idx} value={sec}>
                        {sec}
                      </option>
                    ))}
                    {editSection && !activeScopedCampaign?.definedSections?.includes(editSection) && (
                      <option value={editSection}>{editSection} (Existing)</option>
                    )}
                  </select>
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
    </div>
  );
};
