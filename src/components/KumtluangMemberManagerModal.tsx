import React, { useState, useEffect } from 'react';
import { 
  X, 
  UserPlus, 
  Search, 
  Check, 
  Printer, 
  CreditCard, 
  Calendar, 
  ShieldCheck, 
  Users, 
  ArrowRight,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { MemberRecord, Campaign, Transaction, CreatorProfile } from '../types';
import { getMembers, saveMembers, addOrUpdateMember, saveTransaction } from '../utils/storage';
import { 
  exportMasterLedgerPrint, 
  exportMemberCategoryMatrixPrint, 
  exportMemberPassbookVerticalPrint 
} from '../utils/export';

interface KumtluangMemberManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'mizo' | 'english';
  creatorProfile: CreatorProfile;
  campaigns: Campaign[];
  transactions: Transaction[];
  onDataUpdated: () => void;
}

export const KumtluangMemberManagerModal: React.FC<KumtluangMemberManagerModalProps> = ({
  isOpen,
  onClose,
  language,
  creatorProfile,
  campaigns,
  transactions,
  onDataUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>('quick_entry');
  const [members, setMembers] = useState<MemberRecord[]>([]);

  // Quick Entry State
  const [quickPhone4, setQuickPhone4] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
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
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Print Filter State
  const [printMemberId, setPrintMemberId] = useState<string>('');
  const [printYear, setPrintYear] = useState<string>('2026');

  // Search in directory
  const [dirSearch, setDirSearch] = useState<string>('');

  const monthsList = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const defaultCategories = ['Pathian Ram Zauna', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];

  useEffect(() => {
    if (isOpen) {
      const mList = getMembers();
      setMembers(mList);
      if (campaigns.length > 0) {
        const kumCampaign = campaigns.find(c => c.category === 'kumtluang') || campaigns[0];
        setSelectedCampaignId(kumCampaign.id);
      }
    }
  }, [isOpen, campaigns]);

  if (!isOpen) return null;

  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];
  const campaignCategories = (currentCampaign?.subCategories && currentCampaign.subCategories.length > 0)
    ? currentCampaign.subCategories
    : defaultCategories;

  // Auto-search members by last 4 digits
  const searchResults = quickPhone4.length >= 2 
    ? members.filter(m => m.phoneLast4.includes(quickPhone4) || m.name.toLowerCase().includes(quickPhone4.toLowerCase()) || m.id.toLowerCase().includes(quickPhone4.toLowerCase()))
    : [];

  const handleSelectQuickMember = (m: MemberRecord) => {
    setSelectedMember(m);
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

    const txRemark = `${selectedMonth} ${selectedYear} [${selectedCategory}] ${entryRemark ? `- ${entryRemark}` : ''} (ID: ${selectedMember.id})`;

    const newTx: Transaction = {
      id: `TX-MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      campaignId: selectedCampaignId || currentCampaign?.id || 'manual',
      campaignTitle: currentCampaign?.title || 'Kumtluang Bawm',
      donorName: selectedMember.name,
      donorPhone: selectedMember.fullPhone || `****${selectedMember.phoneLast4}`,
      donorVeng: selectedMember.section || '',
      amount: amt,
      timestamp: new Date().toISOString(),
      status: 'completed',
      paymentMethod: 'cash',
      referenceNo: `CASH-${selectedMember.id}-${Date.now().toString().slice(-6)}`,
      remark: txRemark,
      isSynced: true,
      createdAt: new Date().toISOString(),
      subCategory: selectedCategory,
      periodMonth: selectedMonth,
      periodYear: selectedYear,
      platformFeeBearer: 'org_paid'
    };

    saveTransaction(newTx);
    setEntrySuccess(`₹${amt} (${selectedCategory} - ${selectedMonth}) chu ${selectedMember.name} (${selectedMember.id}) pualin record fel a ni ta!`);
    onDataUpdated();
    setTimeout(() => {
      setEntrySuccess(null);
      setEntryRemark('');
    }, 4000);
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

    const generatedId = `${newOrgCode.toUpperCase()}-${newPhone4.slice(-4)}`;
    const newM: MemberRecord = {
      id: generatedId,
      name: newHming.trim(),
      orgCode: newOrgCode.toUpperCase(),
      phoneLast4: newPhone4.slice(-4),
      fullPhone: newFullPhone.trim() || undefined,
      section: newSection.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    addOrUpdateMember(newM);
    setMembers(getMembers());
    setRegSuccess(`Member thar [${generatedId}] ${newHming} chu vawn fel a ni ta!`);
    setSelectedMember(newM);
    setQuickPhone4(newM.phoneLast4);
    setNewHming('');
    setNewPhone4('');
    setNewFullPhone('');
    setNewSection('');
    onDataUpdated();
    setTimeout(() => {
      setRegSuccess(null);
      setActiveTab('quick_entry');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-6">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-200">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-wide flex items-center gap-2">
                {language === 'english' ? 'Kumtluang Bawm • Member Roll & Entry' : 'Kumtluang Bawm • Member Roll & Entry'}
                <span className="text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                  12-Month Matrix
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                {creatorProfile.orgName || 'Church / NGO Organization'} • Treasurer Management Portal
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('quick_entry')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'quick_entry'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>{language === 'english' ? 'Treasurer Quick Entry (Digit 4)' : 'Treasurer Quick Entry (Digit 4)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('register_member')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'register_member'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{language === 'english' ? '+ Add New Member' : '+ Member Thar Chhinchhiah'}</span>
          </button>

          <button
            onClick={() => setActiveTab('print_reports')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'print_reports'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{language === 'english' ? 'Print Formats (1, 2, 3)' : 'Print Formats (Format 1, 2, 3)'}</span>
          </button>

          <button
            onClick={() => setActiveTab('members_list')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'members_list'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-sm'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{language === 'english' ? `Members Roll (${members.length})` : `Member Roll (${members.length})`}</span>
          </button>
        </div>

        {/* Tab 1: Treasurer Quick Entry */}
        {activeTab === 'quick_entry' && (
          <div className="p-6 space-y-6">
            {entrySuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{entrySuccess}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Left Column: Fast 4-Digit Search */}
              <div className="md:col-span-5 space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Phone No. Last 4 Digits / Hming <span className="text-blue-600">*</span>
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
                      placeholder="e.g. 1460, 8622, Rammuanpia..."
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Phone number tawp digit 4 chhut luhin Member an lo lang nghal ang.
                  </p>
                </div>

                {/* Auto-suggest list */}
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {searchResults.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectQuickMember(m)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                        selectedMember?.id === m.id
                          ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-blue-50'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black flex items-center gap-1.5">
                          <span>{m.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${selectedMember?.id === m.id ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-700'}`}>
                            {m.id}
                          </span>
                        </div>
                        <div className={`text-[10px] ${selectedMember?.id === m.id ? 'text-blue-100' : 'text-slate-500'}`}>
                          Phone: ****{m.phoneLast4} • {m.section || 'General'}
                        </div>
                      </div>
                      {selectedMember?.id === m.id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}

                  {quickPhone4 && searchResults.length === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <p className="text-xs text-amber-800 font-semibold">He Phone number / hming hi a la awm lo</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewPhone4(quickPhone4.slice(-4));
                          setActiveTab('register_member');
                        }}
                        className="mt-2 text-xs font-bold text-blue-700 hover:underline inline-flex items-center gap-1"
                      >
                        + Member thar atan register rawh <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Payment Form */}
              <div className="md:col-span-7 space-y-4">
                <form onSubmit={handleSaveQuickPayment} className="space-y-4">
                  {/* Selected Member Header Card */}
                  <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    selectedMember 
                      ? 'bg-blue-50/80 border-blue-200 text-blue-950' 
                      : 'bg-slate-50 border-slate-200 text-slate-500'
                  }`}>
                    <div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Selected Member</div>
                      <div className="text-sm font-black text-slate-900">
                        {selectedMember ? selectedMember.name : 'Khawngaihin dinglam atangin member thlang rawh'}
                      </div>
                    </div>
                    {selectedMember && (
                      <span className="font-mono text-xs font-bold px-2.5 py-1 bg-blue-600 text-white rounded-lg shadow-sm">
                        ID: {selectedMember.id}
                      </span>
                    )}
                  </div>

                  {/* Campaign / Bawm Dropdown */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Kumtluang Bawm</label>
                    <select
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category & Month in Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Sub-Category / Fund Head</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Thawhkhawm Chhinchhiah Rawh (Save & Add Payment)</span>
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Register New Member */}
        {activeTab === 'register_member' && (
          <div className="p-6 max-w-xl mx-auto space-y-4">
            {regSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{regSuccess}</span>
              </div>
            )}

            <form onSubmit={handleRegisterMember} className="space-y-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  Member Thar Chhinchhiahna
                </h4>
                <p className="text-xs text-slate-500">
                  Kohhran / Pawl code leh phone number tawp aṭangin Unique ID a lo insiam nghal ang.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hming Pum (Full Name) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newHming}
                  onChange={(e) => setNewHming(e.target.value)}
                  placeholder="e.g. Rammuanpia"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
                    onChange={(e) => setNewPhone4(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 1460"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              {/* Preview of generated ID */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
                <span className="text-blue-800 font-semibold">Auto-Generated Unique ID:</span>
                <span className="font-mono font-black text-blue-900 bg-white px-2.5 py-1 rounded border border-blue-300">
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">Section / Bial</label>
                  <input
                    type="text"
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    placeholder="e.g. Section A / Bial 1"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Member Save & Register Rawh</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 3: Print Formats 1, 2, 3 */}
        {activeTab === 'print_reports' && (
          <div className="p-6 space-y-6">
            <div className="text-center max-w-lg mx-auto">
              <h4 className="text-sm font-black text-slate-900 uppercase">
                Official Report & Statement Printouts
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                Image Format 1, 2, leh 3 te A4 Printout (PDF / Printer) atan thlang rawh le.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Format 1 */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                    #1
                  </div>
                  <h5 className="font-bold text-xs text-slate-900">Format 1: Kohhran / Pawl Master Ledger</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Member zawng zawng thla 12 (Jan - Dec) thawh dan, Mimal Total leh <strong>Grand Total (G Total)</strong> summary sheet kimchang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => exportMasterLedgerPrint(members, transactions, currentCampaign?.title || 'Kumtluang Bawm', creatorProfile.orgName || 'Church Organization')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Format 1 (Landscape)</span>
                </button>
              </div>

              {/* Format 2 */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 hover:border-indigo-500 bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    #2
                  </div>
                  <h5 className="font-bold text-xs text-slate-900">Format 2: Mimal Record (Horizontal Matrix)</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Member pakhata Fund hrang hrang (Pathian Ram Zauna, Ramthim, Mission) thla 12 chhunga an thawh zat Horizontal Matrix.
                  </p>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Select Member:</label>
                    <select
                      value={printMemberId}
                      onChange={(e) => setPrintMemberId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    >
                      <option value="">-- Member Thlang Rawh --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!printMemberId}
                  onClick={() => {
                    const m = members.find(x => x.id === printMemberId);
                    if (m) exportMemberCategoryMatrixPrint(m, campaignCategories, transactions, creatorProfile.orgName || 'Church Organization');
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Format 2 (Matrix)</span>
                </button>
              </div>

              {/* Format 3 */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-white hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    #3
                  </div>
                  <h5 className="font-bold text-xs text-slate-900">Format 3: Mimal Passbook (Vertical Card)</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Member passbook slip atan: Thla 12 (Jan - Dec) zawn theuha Categories sum luh zat Vertical Card printout.
                  </p>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Select Member:</label>
                    <select
                      value={printMemberId}
                      onChange={(e) => setPrintMemberId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                    >
                      <option value="">-- Member Thlang Rawh --</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!printMemberId}
                  onClick={() => {
                    const m = members.find(x => x.id === printMemberId);
                    if (m) exportMemberPassbookVerticalPrint(m, campaignCategories, transactions, creatorProfile.orgName || 'Church Organization');
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Format 3 (Passbook)</span>
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Tab 4: Members Roll List */}
        {activeTab === 'members_list' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative w-72">
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
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Member Thar</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Member ID</th>
                    <th className="p-3">Hming Pum</th>
                    <th className="p-3">Phone (Last 4)</th>
                    <th className="p-3">Section / Bial</th>
                    <th className="p-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members
                    .filter(m => !dirSearch || m.name.toLowerCase().includes(dirSearch.toLowerCase()) || m.id.toLowerCase().includes(dirSearch.toLowerCase()) || m.phoneLast4.includes(dirSearch))
                    .map(m => (
                      <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-mono font-bold text-blue-700">{m.id}</td>
                        <td className="p-3 font-bold text-slate-900">{m.name}</td>
                        <td className="p-3 text-slate-600 font-mono">****{m.phoneLast4}</td>
                        <td className="p-3 text-slate-600">{m.section || '-'}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectQuickMember(m);
                              setActiveTab('quick_entry');
                            }}
                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg font-bold text-[11px] transition-all"
                          >
                            + Add Payment
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
