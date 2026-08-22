import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { MemberRecord, MemberDependent, Campaign, Transaction, CreatorProfile } from '../types';
import { getMembers, addOrUpdateMember, deleteMember, saveTransaction } from '../utils/storage';
import { 
  exportMasterLedgerPrint, 
  exportMemberCategoryMatrixPrint, 
  exportMemberPassbookVerticalPrint 
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
}

export const KumtluangMemberManagerModal: React.FC<KumtluangMemberManagerModalProps> = ({
  isOpen,
  onClose,
  language,
  creatorProfile,
  campaigns,
  transactions,
  initialTab,
  onDataUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>('quick_entry');
  const [members, setMembers] = useState<MemberRecord[]>([]);

  // Quick Entry State
  const [quickPhone4, setQuickPhone4] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [selectedPayerType, setSelectedPayerType] = useState<string>('primary'); // 'primary' or subId
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Pathian Ram Zauna');
  const [selectedMonth, setSelectedMonth] = useState<string>('August');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [entryAmount, setEntryAmount] = useState<string>('500');
  const [entryRemark, setEntryRemark] = useState<string>('');
  const [entrySuccess, setEntrySuccess] = useState<string | null>(null);

  // New Member Registration State
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

  // Print Styles Selector State
  const [printStyle, setPrintStyle] = useState<'style1_master' | 'style2_matrix' | 'style3_passbook'>('style1_master');
  const [printMemberId, setPrintMemberId] = useState<string>('');

  // Search in directory
  const [dirSearch, setDirSearch] = useState<string>('');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const defaultCategories = ['Pathian Ram Zauna', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];

  useEffect(() => {
    if (isOpen) {
      if (initialTab) {
        setActiveTab(initialTab);
      }
      const initialCamp = campaigns.find(c => c.category === 'kumtluang') || campaigns[0];
      const campId = selectedCampaignId || initialCamp?.id || '';
      setSelectedCampaignId(campId);
      const mList = getMembers(campId);
      setMembers(mList);
      if (initialCamp?.orgCode) {
        setNewOrgCode(initialCamp.orgCode);
      }
    }
  }, [isOpen, campaigns, initialTab]);

  // When selectedCampaignId changes, reload scoped members and set orgCode
  useEffect(() => {
    if (selectedCampaignId) {
      const camp = campaigns.find(c => c.id === selectedCampaignId);
      setMembers(getMembers(selectedCampaignId));
      if (camp?.orgCode) {
        setNewOrgCode(camp.orgCode);
      }
      setSelectedMember(null);
    }
  }, [selectedCampaignId, campaigns]);

  if (!isOpen) return null;

  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];
  const campaignCategories = (currentCampaign?.subCategories && currentCampaign.subCategories.length > 0)
    ? currentCampaign.subCategories
    : defaultCategories;

  const resolvedOrgTitle = currentCampaign?.orgName || currentCampaign?.title || creatorProfile.orgName || creatorProfile.name || 'Organization / Church';
  const resolvedLogoUrl = currentCampaign?.imageUrl || creatorProfile.logoUrl;
  const resolvedLocation = currentCampaign?.location || creatorProfile.address;

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

    const txRemark = `${selectedMonth} ${selectedYear} [${selectedCategory}] ${entryRemark ? `- ${entryRemark}` : ''} (ID: ${payerId})`;

    const newTx: Transaction = {
      id: `TX-MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      campaignId: selectedCampaignId || currentCampaign?.id || 'manual',
      campaignTitle: currentCampaign?.title || 'Kumtluang Bawm',
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
      const exists = members.find(m => m.orgCode === newOrgCode.toUpperCase() && m.phoneLast4 === p4);
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

    const org = newOrgCode.trim().toUpperCase() || 'EBE';
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
      campaignId: selectedCampaignId || currentCampaign?.id,
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
    const updated = getMembers(selectedCampaignId);
    setMembers(updated);
    setRegSuccess(`Member thar [${generatedId}] ${newHming} ${formattedDependents.length > 0 ? `leh dependent ${formattedDependents.length}` : ''} chu vawn fel a ni ta!`);
    setSelectedMember(newM);
    setSelectedPayerType('primary');
    setQuickPhone4(newM.phoneLast4);
    
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
      setActiveTab('quick_entry');
    }, 2000);
  };

  // Open Edit Member Modal
  const handleOpenEdit = (m: MemberRecord) => {
    setEditingMember(m);
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
    const newDep: MemberDependent = {
      subId: `${editingMember.id}-${String(nextIdx).padStart(2, '0')}`,
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

    // If ID changed, delete old one and add new
    if (newId !== editingMember.id) {
      deleteMember(editingMember.id, editingMember.campaignId || selectedCampaignId);
    }

    const updatedM: MemberRecord = {
      id: newId,
      campaignId: editingMember.campaignId || selectedCampaignId || currentCampaign?.id,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shadow-xs overflow-hidden">
              {resolvedLogoUrl ? (
                <img src={resolvedLogoUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Users className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-black text-base tracking-wide flex items-center gap-2">
                <span>{currentCampaign?.title || 'Kumtluang Bawm'} • Member Roll & Treasurer Portal</span>
                <span className="text-[9.5px] uppercase font-mono font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full">
                  12-Month Matrix
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                {resolvedOrgTitle} {resolvedLocation ? `• ${resolvedLocation}` : ''} • Family Head & Dependent Sub-IDs
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('quick_entry')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'quick_entry'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Treasurer Quick Entry (Digit 4)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register_member')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'register_member'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Add Member / Family</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('print_reports')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'print_reports'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Statement Print (Styles 1, 2, 3)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('members_list')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer shrink-0 ${
              activeTab === 'members_list'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Member Roll & Edit ({members.length})</span>
          </button>
        </div>

        {/* TAB 1: QUICK ENTRY */}
        {activeTab === 'quick_entry' && (
          <div className="p-6 space-y-6">
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
                    Phone Last 4 Digits / Hming / Sub-ID <span className="text-blue-600">*</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={quickPhone4}
                      onChange={(e) => {
                        setQuickPhone4(e.target.value);
                        if (!e.target.value) setSelectedMember(null);
                      }}
                      placeholder="e.g. 1460, 8622, Rammuanpuia..."
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Digit 4 emaw Hming chhutin Member an lo lang nghal ang.
                  </p>
                </div>

                {/* Auto-suggest list */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {searchResults.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectQuickMember(m)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                        selectedMember?.id === m.id
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs ${
                          selectedMember?.id === m.id ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{m.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs font-black flex items-center gap-1.5 flex-wrap">
                            <span>{m.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${selectedMember?.id === m.id ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-700'}`}>
                              {m.id}
                            </span>
                            {m.dependents && m.dependents.length > 0 && (
                              <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${selectedMember?.id === m.id ? 'bg-blue-700 text-white' : 'bg-amber-100 text-amber-800'}`}>
                                +{m.dependents.length} Chhungte
                              </span>
                            )}
                          </div>
                          <div className={`text-[10.5px] mt-0.5 ${selectedMember?.id === m.id ? 'text-blue-100' : 'text-slate-500'}`}>
                            Phone: ****{m.phoneLast4} • {m.section || 'General'}
                          </div>
                        </div>
                      </div>
                      {selectedMember?.id === m.id && <Check className="w-4 h-4 text-white shrink-0" />}
                    </button>
                  ))}

                  {quickPhone4 && searchResults.length === 0 && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                      <p className="text-xs text-amber-800 font-bold">He Phone / Hming hi Roll-ah a la awm lo</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewPhone4(quickPhone4.slice(-4));
                          setActiveTab('register_member');
                        }}
                        className="text-xs font-black text-blue-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
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
                      ? 'bg-blue-50/90 border-blue-200 text-blue-950' 
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedMember && (
                          <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white border border-blue-200 shadow-xs shrink-0 flex items-center justify-center font-black text-blue-900 text-base">
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
                        <span className="font-mono text-xs font-black px-2.5 py-1 bg-blue-600 text-white rounded-xl shadow-xs">
                          {selectedMember.id}
                        </span>
                      )}
                    </div>

                    {/* Dual-User Selector (Family Head vs Dependents) */}
                    {selectedMember && selectedMember.dependents && selectedMember.dependents.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-200/60 space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-blue-900 block">
                          Tunge Thawh Dawn? (Select Payer Member):
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPayerType('primary')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                              selectedPayerType === 'primary'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-300 hover:bg-blue-50'
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
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-blue-50'
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
                    <label className="text-xs font-bold text-slate-700 block mb-1">Kumtluang Bawm</label>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category & Month */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Fund Head / Sub-Category</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                          className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedMember}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
          <div className="p-6 max-w-xl mx-auto space-y-4">
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

            <form onSubmit={handleRegisterMember} className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Chhungkaw Hotu & Dependents Registration
                </h4>
                <p className="text-xs text-slate-500">
                  Chhungkaw Hotu pui ber hming leh phone hmangin Unique ID a insiam ang a, phone nei lo chhungte tana Sub-ID siam theih a ni.
                </p>
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
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Pawl Code (3 Letters) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newOrgCode}
                    onChange={(e) => setNewOrgCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EBE / BCM / YMA"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
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
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Preview of generated ID */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-blue-900 font-bold">Auto-Generated Primary ID:</span>
                <span className="font-mono font-black text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-300">
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
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {currentCampaign?.sectionLabel || 'Section / Bial / Veng'}
                  </label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">-- Thlang Rawh ({currentCampaign?.sectionLabel || 'Bial / Section'}) --</option>
                    {(currentCampaign?.definedSections && currentCampaign.definedSections.length > 0
                      ? currentCampaign.definedSections
                      : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                    ).map((sec, idx) => (
                      <option key={idx} value={sec}>
                        {sec}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Member Profile Photo Upload (Optional) */}
              <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-blue-600" />
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
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                    className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>

                {newDependents.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {newDependents.map((dep, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded">
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
                <span>Chhungkaw Record Vawng Rawh (Save & Register)</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: STATEMENT PRINT WITH "PRINT STYLE" SELECTION */}
        {activeTab === 'print_reports' && (
          <div className="p-6 space-y-6">
            <div className="text-center max-w-lg mx-auto space-y-1">
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Statement Print na Hmun (Print Styles 1, 2, 3)
              </h4>
              <p className="text-xs text-slate-500">
                Print Style thlang la, Master Sheet emaw Mimal Passbook / Matrix Printout A4 format-ah a lo chhuak ang.
              </p>
            </div>

            {/* Print Style Selection Bar */}
            <div className="max-w-2xl mx-auto bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-4">
              <div>
                <label className="text-xs font-black text-slate-800 block mb-1.5">
                  🖨️ Print Style Thlanna (Select Report Format):
                </label>
                <select
                  value={printStyle}
                  onChange={(e) => setPrintStyle(e.target.value as any)}
                  className="w-full p-3 bg-white border-2 border-blue-400 rounded-2xl text-xs font-black text-blue-950 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="style1_master">Format 1: Kohhran / Pawl Master Ledger (Member zawng zawng Thla 12 Grid)</option>
                  <option value="style2_matrix">Format 2: Mimal Record (Horizontal Category Matrix - Thla 12)</option>
                  <option value="style3_passbook">Format 3: Mimal Passbook (Vertical Passbook Card - Thla 12)</option>
                </select>
              </div>

              {/* If Mimal format, show Member selector */}
              {(printStyle === 'style2_matrix' || printStyle === 'style3_passbook') && (
                <div className="animate-fadeIn">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Member Thlang Rawh (Select Member for Personal Statement):
                  </label>
                  <select
                    value={printMemberId}
                    onChange={(e) => setPrintMemberId(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="">-- Member Thlang Rawh --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id}) {m.section ? `• ${m.section}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Print Button */}
              <button
                type="button"
                onClick={() => {
                  if (printStyle === 'style1_master') {
                    exportMasterLedgerPrint(
                      members, 
                      transactions, 
                      currentCampaign?.title || 'Kumtluang Bawm', 
                      resolvedOrgTitle,
                      resolvedLogoUrl,
                      resolvedLocation
                    );
                  } else if (printStyle === 'style2_matrix') {
                    if (!printMemberId) {
                      alert('Khawngaihin member thlang hmasa rawh le.');
                      return;
                    }
                    const m = members.find(x => x.id === printMemberId);
                    if (m) {
                      exportMemberCategoryMatrixPrint(
                        m, 
                        campaignCategories, 
                        transactions, 
                        resolvedOrgTitle,
                        resolvedLogoUrl,
                        resolvedLocation
                      );
                    }
                  } else if (printStyle === 'style3_passbook') {
                    if (!printMemberId) {
                      alert('Khawngaihin member thlang hmasa rawh le.');
                      return;
                    }
                    const m = members.find(x => x.id === printMemberId);
                    if (m) {
                      exportMemberPassbookVerticalPrint(
                        m, 
                        campaignCategories, 
                        transactions, 
                        resolvedOrgTitle,
                        resolvedLogoUrl,
                        resolvedLocation
                      );
                    }
                  }
                }}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {printStyle === 'style1_master' && 'Print Format 1: Master Ledger (Landscape)'}
                  {printStyle === 'style2_matrix' && 'Print Format 2: Category Matrix'}
                  {printStyle === 'style3_passbook' && 'Print Format 3: Mimal Passbook Slip'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: MEMBER ROLL & EDIT / DELETE */}
        {activeTab === 'members_list' && (
          <div className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={dirSearch}
                  onChange={(e) => setDirSearch(e.target.value)}
                  placeholder="Hming, ID, Section zawnna..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('register_member')}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Member Thar Chhinchhiah</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Member ID</th>
                    <th className="p-3">Chhungkaw Hotu & Dependents</th>
                    <th className="p-3">Phone (Last 4)</th>
                    <th className="p-3">Section / Bial</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members
                    .filter(m => !dirSearch || m.name.toLowerCase().includes(dirSearch.toLowerCase()) || m.id.toLowerCase().includes(dirSearch.toLowerCase()) || m.phoneLast4.includes(dirSearch))
                    .map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-700">{m.id}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                              {m.avatarUrl ? (
                                <img src={m.avatarUrl} alt={m.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{m.name.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{m.name}</div>
                              {m.dependents && m.dependents.length > 0 && (
                                <div className="text-[10px] text-slate-500 mt-0.5 space-x-1">
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
                        <td className="p-3 text-slate-600 font-mono">****{m.phoneLast4}</td>
                        <td className="p-3 text-slate-600">{m.section || '-'}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleSelectQuickMember(m);
                                setActiveTab('quick_entry');
                              }}
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[10.5px] transition cursor-pointer"
                              title="Add Quick Payment"
                            >
                              + Pay
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(m)}
                              className="p-1 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                              title="Edit Member Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMember(m.id, m.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete Member"
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
          </div>
        )}

      </div>

      {/* EDIT MEMBER MODAL (For correcting mistakes) */}
      {editingMember && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 border border-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shadow-xs">
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
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Chhungkaw Hotu Hming *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              {/* Photo Upload in Edit Modal */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
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
                    Pawl Code (e.g. BCM, EBE)
                  </label>
                  <input
                    type="text"
                    value={editOrgCode}
                    onChange={(e) => setEditOrgCode(e.target.value.toUpperCase())}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 uppercase focus:outline-none focus:bg-white focus:border-blue-600"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    {currentCampaign?.sectionLabel || 'Section / Bial'}
                  </label>
                  <select
                    value={editSection}
                    onChange={(e) => setEditSection(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                  >
                    <option value="">-- Thlang Rawh --</option>
                    {(currentCampaign?.definedSections && currentCampaign.definedSections.length > 0
                      ? currentCampaign.definedSections
                      : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                    ).map((sec, idx) => (
                      <option key={idx} value={sec}>
                        {sec}
                      </option>
                    ))}
                    {editSection && !currentCampaign?.definedSections?.includes(editSection) && (
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
                    className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                  >
                    + Add
                  </button>
                </div>

                {editDependents.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {editDependents.map((dep) => (
                      <div key={dep.subId} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
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
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
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
