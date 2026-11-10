import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Users, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Search, 
  Phone, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Banknote, 
  Calendar, 
  Printer, 
  ChevronRight, 
  ChevronDown,
  Key, 
  FileText, 
  Lock, 
  TrendingUp, 
  Download, 
  Check, 
  RefreshCw,
  Eye,
  Building2,
  SlidersHorizontal,
  UserCheck,
  Link2,
  BookOpen,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { Campaign, Transaction, CreatorProfile, AuthorizedOfficer, AuthorizedOfficerRole, MemberRecord, AuditorAccessGrant } from '../types';
import { 
  saveCampaign, 
  isCampaignCreator, 
  isActualCampaignOwner, 
  isSuperAdminOrAdminProfile, 
  recordAuditLog, 
  getStoredTransactions, 
  safeApiFetch,
  getMembers,
  saveMembers,
  getStoredCreatorsList,
  saveStoredCreatorsList,
  getStoredCreatorProfile,
  saveStoredCreatorProfile,
  getStoredAuditorGrants,
  saveStoredAuditorGrants,
  saveAuditorGrant,
  revokeAuditorGrant,
  permanentlyDeleteAuditorGrant,
  formatRemainingAuditTimeMizo,
  syncAuditorGrantsAcrossCloud
} from '../utils/storage';
import { formatDateTimeDDMMYYYY, formatDateDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';
import { AuditorPortalModal } from './AuditorPortalModal';

interface AuthorizedPersonsModalProps {
  isOpen: boolean;
  campaign: Campaign | null;
  creatorProfile?: CreatorProfile | null;
  transactions?: Transaction[];
  members?: MemberRecord[];
  onClose: () => void;
  onCampaignUpdated?: (updatedCampaign: Campaign) => void;
}

const AVAILABLE_ROLES: Array<{ role: AuthorizedOfficerRole; label: string; desc: string; color: string }> = [
  { role: 'Treasurer', label: 'Treasurer', desc: 'Pawisa vawngtu & Cash Clearance thuneitu sang ber', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { role: 'Accountant', label: 'Accountant', desc: 'Ledger enfiahtu, audit & cash clearance', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { role: 'Cashier', label: 'Cashier', desc: 'Counter / Cash receipt pawmtu leh collect-tu', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { role: 'Collector', label: 'Collector', desc: 'In tina thawhlawm/pawisa khawntu & thehluttu', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { role: 'Officer', label: 'Campaign Officer', desc: 'General duty & committee member authorized officer', color: 'bg-slate-100 text-slate-800 border-slate-300' },
];

export const AuthorizedPersonsModal: React.FC<AuthorizedPersonsModalProps> = ({
  isOpen,
  campaign,
  creatorProfile,
  transactions = [],
  members = [],
  onClose,
  onCampaignUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'management' | 'auditors' | 'analytics'>('management');
  const [isAddFormOpen, setIsAddFormOpen] = useState<boolean>(false);
  const [editingOfficerIndex, setEditingOfficerIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auditor Temporary Grants state
  const [auditorGrants, setAuditorGrants] = useState<AuditorAccessGrant[]>([]);
  const [isAddAuditorOpen, setIsAddAuditorOpen] = useState<boolean>(false);
  const [auditAppointmentMode, setAuditAppointmentMode] = useState<'single' | 'dual'>(() => {
    const activeCount = (campaign?.auditorGrants || []).filter(g => g.status === 'active').length;
    return campaign?.requireDualAuditorConsensus || activeCount >= 2 ? 'dual' : 'single';
  });
  const [auditorNameInput, setAuditorNameInput] = useState<string>('');
  const [auditorPhoneInput, setAuditorPhoneInput] = useState<string>('');
  const [auditorPinInput, setAuditorPinInput] = useState<string>('1234');
  // Optional 2nd Auditor (Co-Auditor) inputs when Dual Mode is chosen
  const [coAuditorNameInput, setCoAuditorNameInput] = useState<string>('');
  const [coAuditorPhoneInput, setCoAuditorPhoneInput] = useState<string>('');
  const [coAuditorPinInput, setCoAuditorPinInput] = useState<string>('1234');
  const [auditorDurationHours, setAuditorDurationHours] = useState<number>(48);
  const [auditorNotesInput, setAuditorNotesInput] = useState<string>('');
  const [auditorMemberSearch, setAuditorMemberSearch] = useState<string>('');
  const [isAuditorMemberDropdownOpen, setIsAuditorMemberDropdownOpen] = useState<boolean>(false);
  const [selectedAuditorMember, setSelectedAuditorMember] = useState<MemberRecord | null>(null);
  const [copiedGrantId, setCopiedGrantId] = useState<string | null>(null);
  const [isAuditorPortalOpen, setIsAuditorPortalOpen] = useState<boolean>(false);
  const [auditorTick, setAuditorTick] = useState<number>(0);

  // Appointed Audit Period (Hun Bi Tiam) states for Auditor
  const nowForFy = useMemo(() => new Date(), []);
  const fyCurrStart = nowForFy.getMonth() >= 3 ? nowForFy.getFullYear() : nowForFy.getFullYear() - 1;
  const defaultFyLabel = `FY ${fyCurrStart - 1}-${fyCurrStart}`;
  const defaultFromDate = `${fyCurrStart - 1}-04-01`;
  const defaultToDate = `${fyCurrStart}-03-31`;

  const [auditorPeriodPreset, setAuditorPeriodPreset] = useState<string>('fy_prev');
  const [auditorPeriodLabel, setAuditorPeriodLabel] = useState<string>(defaultFyLabel);
  const [auditorFromDate, setAuditorFromDate] = useState<string>(defaultFromDate);
  const [auditorToDate, setAuditorToDate] = useState<string>(defaultToDate);

  const handleSelectAuditPeriodPreset = (preset: string) => {
    setAuditorPeriodPreset(preset);
    if (preset === 'fy_prev') {
      const lbl = `FY ${fyCurrStart - 1}-${fyCurrStart}`;
      setAuditorPeriodLabel(lbl);
      setAuditorFromDate(`${fyCurrStart - 1}-04-01`);
      setAuditorToDate(`${fyCurrStart}-03-31`);
    } else if (preset === 'fy_curr') {
      const lbl = `FY ${fyCurrStart}-${fyCurrStart + 1}`;
      setAuditorPeriodLabel(lbl);
      setAuditorFromDate(`${fyCurrStart}-04-01`);
      setAuditorToDate(`${fyCurrStart + 1}-03-31`);
    } else if (preset === 'cy_prev') {
      const y = nowForFy.getFullYear() - 1;
      setAuditorPeriodLabel(`Kum ${y}`);
      setAuditorFromDate(`${y}-01-01`);
      setAuditorToDate(`${y}-12-31`);
    } else if (preset === 'cy_curr') {
      const y = nowForFy.getFullYear();
      setAuditorPeriodLabel(`Kum ${y}`);
      setAuditorFromDate(`${y}-01-01`);
      setAuditorToDate(`${y}-12-31`);
    } else if (preset === 'all') {
      setAuditorPeriodLabel('Hun Chhung Zawng (All Records)');
      setAuditorFromDate('');
      setAuditorToDate('');
    } else if (preset === 'custom') {
      setAuditorPeriodLabel('Custom Date Range');
    }
  };

  useEffect(() => {
    if (campaign?.id) {
      setAuditorGrants(getStoredAuditorGrants(campaign.id));
    }
  }, [campaign?.id, auditorTick]);

  // Fetch latest auditor grants from Server AND Supabase when modal opens or tab changes
  const [isSyncingAuditors, setIsSyncingAuditors] = useState<boolean>(false);
  const handleSyncAuditorsFromCloud = useCallback(async () => {
    if (!campaign?.id) return;
    setIsSyncingAuditors(true);
    try {
      await syncAuditorGrantsAcrossCloud();
      setAuditorGrants(getStoredAuditorGrants(campaign.id));
      setAuditorTick(t => t + 1);
    } finally {
      setIsSyncingAuditors(false);
    }
  }, [campaign?.id]);

  const [confirmDeleteGrant, setConfirmDeleteGrant] = useState<AuditorAccessGrant | null>(null);

  useEffect(() => {
    if (!isOpen || !campaign?.id) return;
    handleSyncAuditorsFromCloud();
  }, [isOpen, campaign?.id, activeTab, handleSyncAuditorsFromCloud]);

  useEffect(() => {
    const handleGrantsUpdated = () => setAuditorTick(t => t + 1);
    window.addEventListener('ronpay_auditor_grants_updated', handleGrantsUpdated);
    return () => window.removeEventListener('ronpay_auditor_grants_updated', handleGrantsUpdated);
  }, []);

  // Form fields for assigning/editing Authorized Officer
  const [formName, setFormName] = useState<string>('');
  const [formPhone, setFormPhone] = useState<string>('');
  const [formRole, setFormRole] = useState<AuthorizedOfficerRole>('Cashier');
  const [formPin, setFormPin] = useState<string>('');
  const [formCanClearCash, setFormCanClearCash] = useState<boolean>(true);
  const [formCanRecordExpenses, setFormCanRecordExpenses] = useState<boolean>(false);
  const [formCanManageMembers, setFormCanManageMembers] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState<string>('');

  // Member Roll selection & database binding states
  const [membersTick, setMembersTick] = useState<number>(0);
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState<boolean>(false);
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [formMemberId, setFormMemberId] = useState<string>('');
  const [formRollNo, setFormRollNo] = useState<string>('');
  const [formSection, setFormSection] = useState<string>('');
  const [formFatherName, setFormFatherName] = useState<string>('');

  // Synchronize campaign members tick on event
  useEffect(() => {
    const handleMembersUpdated = () => {
      setMembersTick(t => t + 1);
    };

    window.addEventListener('ronpay-members-updated', handleMembersUpdated);
    window.addEventListener('ronpay_members_updated', handleMembersUpdated);
    return () => {
      window.removeEventListener('ronpay-members-updated', handleMembersUpdated);
      window.removeEventListener('ronpay_members_updated', handleMembersUpdated);
    };
  }, []);

  // Compute available members list filtered strictly for this specific Bawm/Campaign
  const availableMembers = useMemo(() => {
    if (!campaign?.id) return [];
    const source = (members && members.length > 0) ? members : getMembers(campaign.id);
    const campId = String(campaign.id).toLowerCase().trim();
    const campCode = (campaign.orgCode || '').toLowerCase().trim();

    return source.filter(m => {
      if (!m) return false;
      const mCampId = String(m.campaignId || (m as any).campaign_id || '').toLowerCase().trim();
      const mOrgCode = String(m.orgCode || (m as any).org_code || '').toLowerCase().trim();

      // 1. Exact campaign ID match
      if (mCampId && mCampId === campId) return true;

      // 2. Exact orgCode match (e.g., 'EBE', 'BMP', 'YMA')
      if (campCode && mOrgCode && mOrgCode === campCode) return true;

      // 3. Roll ID prefix match (e.g., 'EBE-101' matches orgCode 'EBE')
      if (campCode && m.id && String(m.id).toLowerCase().startsWith(campCode + '-')) return true;

      // 4. Fallback: if campId is short orgCode (e.g. 'ebe') and member roll ID starts with 'ebe-'
      if (m.id && String(m.id).toLowerCase().startsWith(campId + '-')) return true;

      return false;
    });
  }, [campaign?.id, campaign?.orgCode, members, membersTick]);

  // Filtered members for dropdown selector
  const filteredMembers = useMemo(() => {
    if (!availableMembers || availableMembers.length === 0) return [];
    const q = memberSearchQuery.trim().toLowerCase();
    if (!q) return availableMembers.slice(0, 30);
    return availableMembers.filter(m => {
      const name = (m.name || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      const phone = (m.fullPhone || m.phone || m.phoneLast4 || '').toLowerCase();
      const sec = (m.section || '').toLowerCase();
      const father = (m.fatherName || '').toLowerCase();
      return name.includes(q) || id.includes(q) || phone.includes(q) || sec.includes(q) || father.includes(q);
    }).slice(0, 40);
  }, [availableMembers, memberSearchQuery]);

  const handleSelectMember = useCallback((mem: MemberRecord) => {
    setSelectedMember(mem);
    setFormMemberId(mem.id);
    setFormRollNo(mem.id);
    setFormName(mem.name);

    // Auto-populate phone: check fullPhone, else phone, else phoneLast4
    const phoneCandidate = (mem.fullPhone || mem.phone || '').replace(/\D/g, '').slice(-10);
    setFormPhone(phoneCandidate);
    setFormSection(mem.section || '');
    setFormFatherName(mem.fatherName || '');

    if (!formNotes) {
      const notesParts: string[] = [];
      if (mem.section) notesParts.push(`Section: ${mem.section}`);
      notesParts.push(`Roll: ${mem.id}`);
      if (mem.fatherName) notesParts.push(`P/s: ${mem.fatherName}`);
      setFormNotes(notesParts.join(' | '));
    }

    setIsMemberDropdownOpen(false);
    setMemberSearchQuery('');
  }, [formNotes]);

  const handleClearMemberSelection = useCallback(() => {
    setSelectedMember(null);
    setFormMemberId('');
    setFormRollNo('');
    setFormSection('');
    setFormFatherName('');
    setFormName('');
    setFormPhone('');
    setMemberSearchQuery('');
  }, []);

  // Analytics filter state
  const [selectedCollectorPhone, setSelectedCollectorPhone] = useState<string>('all');
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState<string>('');
  const [analyticsDateRange, setAnalyticsDateRange] = useState<'all' | 'today' | 'this_month'>('all');

  // Verify access level: Creator or Super Admin vs Authorized Officer
  const isSuperAdmin = useMemo(() => isSuperAdminOrAdminProfile(creatorProfile), [creatorProfile]);
  const isCreator = useMemo(() => {
    if (!campaign || !creatorProfile) return false;
    return isCampaignCreator(campaign, creatorProfile) || isActualCampaignOwner(campaign, creatorProfile);
  }, [campaign, creatorProfile]);

  const isFullManager = isSuperAdmin || isCreator;

  // Check if current user is an Authorized Officer on this campaign
  const userPhoneClean = (creatorProfile?.phone || '').replace(/\D/g, '').slice(-10);
  const currentOfficerMatch = useMemo(() => {
    if (!campaign || !Array.isArray(campaign.authorizedOfficers) || !userPhoneClean) return null;
    return campaign.authorizedOfficers.find(o => {
      const oDigits = (o.phone || '').replace(/\D/g, '').slice(-10);
      return Boolean(oDigits && oDigits === userPhoneClean);
    }) || null;
  }, [campaign, userPhoneClean]);

  const currentOfficerPhone = currentOfficerMatch?.phone ? currentOfficerMatch.phone.replace(/\D/g, '').slice(-10) : '';
  const isAssignedOfficerOnly = Boolean(currentOfficerMatch && !isFullManager);

  // Auto-lock individual collector view if assigned officer only
  useEffect(() => {
    if (isAssignedOfficerOnly && currentOfficerPhone) {
      setSelectedCollectorPhone(prev => prev || currentOfficerPhone);
      setActiveTab(prev => prev === 'analytics' ? prev : 'analytics');
    }
  }, [isAssignedOfficerOnly, currentOfficerPhone]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Effective campaign transactions
  const campaignTransactions = useMemo(() => {
    if (!campaign) return [];
    const all = transactions.length > 0 ? transactions : getStoredTransactions();
    return all.filter(t => t && t.campaignId === campaign.id);
  }, [campaign, transactions]);

  const confirmedCampaignTransactions = useMemo(() => {
    return campaignTransactions.filter(t => {
      if (!t) return false;
      const status = (t.status || '').toLowerCase().trim();
      return status === 'completed' || status === 'success' || status === 'verified' || status === 'paid';
    });
  }, [campaignTransactions]);

  // List of all authorized officers currently assigned to this campaign
  const officersList = useMemo<AuthorizedOfficer[]>(() => {
    if (!campaign || !Array.isArray(campaign.authorizedOfficers)) return [];
    return campaign.authorizedOfficers;
  }, [campaign]);

  // Calculate individual metrics for each officer + Creator
  const collectorAnalytics = useMemo(() => {
    const list: Array<{
      officer: AuthorizedOfficer;
      totalCashAmount: number;
      totalTxnCount: number;
      pendingCount: number;
      latestTxnDate: string | null;
      txns: Transaction[];
    }> = [];

    // Also include Campaign Creator if desired
    if (campaign && campaign.createdBy) {
      const creatorPhoneClean = (campaign.createdBy || '').replace(/\D/g, '').slice(-10);
      const creatorName = campaign.creatorName || 'Bawm Creator';
      const creatorTxns = confirmedCampaignTransactions.filter(t => {
        const tPhone = (t.collectorPhone || '').replace(/\D/g, '').slice(-10);
        const tName = (t.collectorName || t.approved_by || t.approvedBy || t.verifiedBy || '').trim().toLowerCase();
        return (creatorPhoneClean && tPhone === creatorPhoneClean) || (creatorName && tName === creatorName.toLowerCase());
      });

      const creatorCash = creatorTxns
        .filter(t => t.paymentMethod === 'cash')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      list.push({
        officer: {
          id: 'creator',
          name: creatorName,
          phone: campaign.createdBy,
          role: 'Creator / Admin',
          canClearCash: true,
          assignedAt: campaign.createdAt,
          notes: 'Primary Campaign Creator'
        },
        totalCashAmount: creatorCash,
        totalTxnCount: creatorTxns.length,
        pendingCount: campaignTransactions.filter(t => t.paymentMethod === 'cash' && (t.status || '').toLowerCase().includes('pending')).length,
        latestTxnDate: creatorTxns[0]?.timestamp || null,
        txns: creatorTxns,
      });
    }

    // Process every Authorized Officer
    for (const officer of officersList) {
      const oPhoneClean = (officer.phone || '').replace(/\D/g, '').slice(-10);
      const oNameLower = (officer.name || '').trim().toLowerCase();

      const matchedTxns = confirmedCampaignTransactions.filter(t => {
        const tPhone = (t.collectorPhone || '').replace(/\D/g, '').slice(-10);
        const tApprover = (t.approved_by || t.approvedBy || t.verifiedBy || t.collectorName || '').trim().toLowerCase();
        const matchesPhone = Boolean(oPhoneClean && tPhone && oPhoneClean === tPhone);
        const matchesName = Boolean(oNameLower && (tApprover === oNameLower || tApprover.includes(oNameLower)));
        return matchesPhone || matchesName;
      });

      const cashTxns = matchedTxns.filter(t => t.paymentMethod === 'cash');
      const totalCash = cashTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

      const latest = matchedTxns.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())[0];

      list.push({
        officer,
        totalCashAmount: totalCash,
        totalTxnCount: matchedTxns.length,
        pendingCount: 0,
        latestTxnDate: latest?.timestamp || null,
        txns: matchedTxns,
      });
    }

    return list;
  }, [officersList, campaign, confirmedCampaignTransactions, campaignTransactions]);

  // Overall Cash Stats
  const overallCashTotal = useMemo(() => {
    return confirmedCampaignTransactions
      .filter(t => t.paymentMethod === 'cash')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [confirmedCampaignTransactions]);

  // Filtered transactions for the analytics log table
  const displayedAnalyticsTxns = useMemo(() => {
    let list = confirmedCampaignTransactions.filter(t => t.paymentMethod === 'cash');

    // 1. Filter by specific collector if selected
    if (selectedCollectorPhone !== 'all') {
      list = list.filter(t => {
        const tPhone = (t.collectorPhone || '').replace(/\D/g, '').slice(-10);
        const tApprover = (t.approved_by || t.approvedBy || t.verifiedBy || t.collectorName || '').trim().toLowerCase();
        
        // Find matching officer by phone
        const officer = officersList.find(o => o.phone.replace(/\D/g, '').slice(-10) === selectedCollectorPhone);
        const oName = officer ? officer.name.toLowerCase() : '';

        return tPhone === selectedCollectorPhone || (oName && tApprover.includes(oName));
      });
    }

    // 2. Date preset filter
    if (analyticsDateRange !== 'all') {
      const today = new Date().toISOString().slice(0, 10);
      const thisMonth = today.slice(0, 7);
      list = list.filter(t => {
        const d = (t.timestamp || t.date || '').slice(0, 10);
        if (analyticsDateRange === 'today') return d === today;
        if (analyticsDateRange === 'this_month') return d.startsWith(thisMonth);
        return true;
      });
    }

    // 3. Search query filter
    const q = analyticsSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(t => {
        const name = (t.donorName || '').toLowerCase();
        const id = (t.id || '').toLowerCase();
        const phone = (t.donorPhone || '').toLowerCase();
        const veng = (t.donorVeng || '').toLowerCase();
        const remark = (t.remark || '').toLowerCase();
        const collector = (t.collectorName || t.approved_by || '').toLowerCase();
        return name.includes(q) || id.includes(q) || phone.includes(q) || veng.includes(q) || remark.includes(q) || collector.includes(q);
      });
    }

    return list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }, [confirmedCampaignTransactions, selectedCollectorPhone, analyticsDateRange, analyticsSearchQuery, officersList]);

  // Handle Save / Assign Officer
  const handleSaveOfficer = useCallback(() => {
    if (!campaign) return;

    // 1. Strict Database Binding & Validation:
    // Must map back to a valid record in the campaign's member directory
    let matchedMember: MemberRecord | undefined = selectedMember || undefined;

    if (!matchedMember && formMemberId) {
      matchedMember = availableMembers.find(m => m.id.toLowerCase().trim() === formMemberId.toLowerCase().trim());
    }
    if (!matchedMember && formName.trim()) {
      const cleanN = formName.trim().toLowerCase();
      matchedMember = availableMembers.find(m => m.name.toLowerCase().trim() === cleanN);
    }
    if (!matchedMember && formPhone.trim()) {
      const pDigits = formPhone.replace(/\D/g, '').slice(-10);
      if (pDigits.length === 10) {
        matchedMember = availableMembers.find(m => {
          const mPhone = (m.fullPhone || m.phone || '').replace(/\D/g, '').slice(-10);
          return mPhone && mPhone === pDigits;
        });
      }
    }

    if (!matchedMember) {
      showToast('⚠️ Authorized Officer atan chuan he campaign-a Member Roll-a inziak sa ngei an ni tur a ni. Khawngaihin Member Roll aṭangin thlang rawh.');
      return;
    }

    if (!formName.trim() || !formPhone.trim()) {
      showToast('⚠️ Hming leh Phone Number ziah ngei ngei tur a ni.');
      return;
    }

    const cleanPhone = formPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showToast('⚠️ Phone number dik zawk (digit 10) ziak rawh.');
      return;
    }

    const currentOfficers = Array.isArray(campaign.authorizedOfficers) ? [...campaign.authorizedOfficers] : [];
    const nowIso = new Date().toISOString();
    const assignedByName = creatorProfile?.name || 'Campaign Creator';
    const finalPhone10 = cleanPhone.slice(-10);

    // 2. If member in database had missing or partial phone number, update member record in database
    const existingMemberPhone = (matchedMember.fullPhone || matchedMember.phone || '').replace(/\D/g, '').slice(-10);
    if (!existingMemberPhone || existingMemberPhone !== finalPhone10) {
      try {
        const allStoredMembers = getMembers();
        const memIdx = allStoredMembers.findIndex(m => m.id.toLowerCase().trim() === matchedMember!.id.toLowerCase().trim());
        if (memIdx >= 0) {
          const updatedMemRecord: MemberRecord = {
            ...allStoredMembers[memIdx],
            fullPhone: finalPhone10,
            phone: finalPhone10,
            phoneLast4: finalPhone10.slice(-4),
            updatedAt: nowIso,
          };
          allStoredMembers[memIdx] = updatedMemRecord;
          saveMembers(allStoredMembers);
        }
      } catch (err) {
        console.warn('Could not auto-update member phone:', err);
      }
    }

    // 3. Construct AuthorizedOfficer with strict member linkage
    const newOfficer: AuthorizedOfficer = {
      id: editingOfficerIndex !== null ? currentOfficers[editingOfficerIndex]?.id || `officer-${Date.now()}` : `officer-${Date.now()}`,
      memberId: matchedMember.id,
      rollNo: matchedMember.id,
      section: matchedMember.section || formSection || undefined,
      fatherName: matchedMember.fatherName || formFatherName || undefined,
      name: matchedMember.name || formName.trim(),
      phone: finalPhone10,
      role: formRole,
      pin: formPin.trim() || undefined,
      canClearCash: formCanClearCash,
      canRecordExpenses: formCanRecordExpenses,
      canManageMembers: formCanManageMembers,
      assignedAt: editingOfficerIndex !== null ? currentOfficers[editingOfficerIndex]?.assignedAt || nowIso : nowIso,
      assignedBy: assignedByName,
      notes: formNotes.trim() || undefined,
    };

    let updatedList: AuthorizedOfficer[];
    if (editingOfficerIndex !== null && editingOfficerIndex >= 0) {
      updatedList = [...currentOfficers];
      updatedList[editingOfficerIndex] = newOfficer;
    } else {
      // Check duplicate phone or duplicate member
      const existsPhone = currentOfficers.some(o => o.phone.replace(/\D/g, '').slice(-10) === newOfficer.phone);
      if (existsPhone) {
        showToast(`⚠️ He phone number (${newOfficer.phone}) hi Authorized Person-ah a awm tawh sa e.`);
        return;
      }
      const existsMember = currentOfficers.some(o => o.memberId && o.memberId.toLowerCase() === newOfficer.memberId?.toLowerCase());
      if (existsMember) {
        showToast(`⚠️ Member [${newOfficer.memberId}] ${newOfficer.name} hi Authorized Officer-ah a awm tawh sa e.`);
        return;
      }
      updatedList = [...currentOfficers, newOfficer];
    }

    const updatedCampaign: Campaign = {
      ...campaign,
      authorizedOfficers: updatedList,
      updatedAt: nowIso,
    };

    // 4. Save campaign to persistent storage & cloud
    saveCampaign(updatedCampaign);
    if (onCampaignUpdated) {
      onCampaignUpdated(updatedCampaign);
    }

    // 5. Seamless linkage to User Profile (CreatorProfile)
    try {
      const allCreators = getStoredCreatorsList();
      const profileIdx = allCreators.findIndex(c => (c.phone || '').replace(/\D/g, '').slice(-10) === newOfficer.phone);
      if (profileIdx >= 0) {
        const existingP = allCreators[profileIdx];
        allCreators[profileIdx] = {
          ...existingP,
          designation: `${newOfficer.role} - ${campaign.title}`,
          updatedAt: nowIso,
        };
        saveStoredCreatorsList(allCreators);

        const activeP = getStoredCreatorProfile();
        if (activeP && activeP.phone.replace(/\D/g, '').slice(-10) === newOfficer.phone) {
          saveStoredCreatorProfile({
            ...activeP,
            designation: `${newOfficer.role} - ${campaign.title}`,
            updatedAt: nowIso,
          });
        }
      } else {
        const linkedProfile: CreatorProfile = {
          phone: newOfficer.phone,
          name: newOfficer.name,
          role: newOfficer.role.toUpperCase(),
          designation: `${newOfficer.role} (${campaign.title})`,
          orgName: campaign.orgName || campaign.title,
          status: 'approved',
          isApproved: true,
          isPhoneVerified: true,
          isVerified: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        saveStoredCreatorProfile(linkedProfile);
      }
    } catch (profileErr) {
      console.warn('Profile linkage note:', profileErr);
    }

    // 6. Record audit log
    recordAuditLog(
      'Authorized Officer Assigned',
      `Member [${newOfficer.memberId}] ${newOfficer.name} (${newOfficer.role}, Ph: ${newOfficer.phone}, Section: ${newOfficer.section || 'N/A'}) authorized by ${assignedByName}. Cash clearance: ${newOfficer.canClearCash ? 'Granted' : 'Disabled'}.`,
      'campaign',
      campaign.id,
      assignedByName
    );

    // Reset form
    setSelectedMember(null);
    setFormMemberId('');
    setFormRollNo('');
    setFormSection('');
    setFormFatherName('');
    setFormName('');
    setFormPhone('');
    setFormRole('Cashier');
    setFormPin('');
    setFormCanClearCash(true);
    setFormCanRecordExpenses(false);
    setFormCanManageMembers(true);
    setFormNotes('');
    setEditingOfficerIndex(null);
    setIsAddFormOpen(false);

    showToast(`✅ [${newOfficer.memberId}] ${newOfficer.name} chu ${newOfficer.role}-ah hlawhtling takin ruat a ni ta.`);
  }, [
    campaign,
    selectedMember,
    formMemberId,
    formName,
    formPhone,
    formRole,
    formPin,
    formCanClearCash,
    formCanRecordExpenses,
    formCanManageMembers,
    formNotes,
    formSection,
    formFatherName,
    editingOfficerIndex,
    availableMembers,
    creatorProfile,
    onCampaignUpdated,
    showToast,
  ]);

  // Handle Remove Officer
  const handleRemoveOfficer = useCallback((index: number) => {
    if (!campaign || !Array.isArray(campaign.authorizedOfficers)) return;
    const target = campaign.authorizedOfficers[index];
    if (!target) return;

    if (!window.confirm(`${target.name} (${target.role}) hi he Campaign aṭanga paih i duh takzet em?`)) {
      return;
    }

    const updatedOfficers = campaign.authorizedOfficers.filter((_, i) => i !== index);
    const updatedCampaign: Campaign = {
      ...campaign,
      authorizedOfficers: updatedOfficers,
      updatedAt: new Date().toISOString(),
    };

    saveCampaign(updatedCampaign);
    if (onCampaignUpdated) {
      onCampaignUpdated(updatedCampaign);
    }

    recordAuditLog(
      'Authorized Officer Removed',
      `${target.name} (${target.role}) removed from campaign ${campaign.title} by ${creatorProfile?.name || 'Creator'}.`,
      'campaign',
      campaign.id,
      creatorProfile?.name || 'Creator'
    );

    showToast(`🗑️ ${target.name} chu Authorized list aṭanga paih a ni ta.`);
  }, [campaign, creatorProfile, onCampaignUpdated, showToast]);

  // Handle Edit Officer button
  const handleEditOfficer = useCallback((index: number) => {
    if (!campaign || !Array.isArray(campaign.authorizedOfficers)) return;
    const officer = campaign.authorizedOfficers[index];
    if (!officer) return;

    setEditingOfficerIndex(index);
    setFormName(officer.name);
    setFormPhone(officer.phone);
    setFormRole(officer.role as AuthorizedOfficerRole || 'Cashier');
    setFormPin(officer.pin || '');
    setFormCanClearCash(officer.canClearCash !== false);
    setFormCanRecordExpenses(Boolean(officer.canRecordExpenses));
    setFormCanManageMembers(officer.canManageMembers !== false);
    setFormNotes(officer.notes || '');

    // Match back to Member Record in database
    const matched = availableMembers.find(m => 
      (officer.memberId && m.id.toLowerCase() === officer.memberId.toLowerCase()) ||
      (officer.rollNo && m.id.toLowerCase() === officer.rollNo.toLowerCase()) ||
      ((m.fullPhone || m.phone || '').replace(/\D/g, '').slice(-10) === officer.phone.replace(/\D/g, '').slice(-10)) ||
      (m.name.trim().toLowerCase() === officer.name.trim().toLowerCase())
    );

    if (matched) {
      setSelectedMember(matched);
      setFormMemberId(matched.id);
      setFormRollNo(matched.id);
      setFormSection(matched.section || officer.section || '');
      setFormFatherName(matched.fatherName || officer.fatherName || '');
    } else {
      setSelectedMember(null);
      setFormMemberId(officer.memberId || officer.rollNo || '');
      setFormRollNo(officer.rollNo || officer.memberId || '');
      setFormSection(officer.section || '');
      setFormFatherName(officer.fatherName || '');
    }

    setIsAddFormOpen(true);
  }, [campaign, availableMembers]);

  // Print Individual Collector Statement
  const handlePrintCollectorStatement = useCallback((collectorItem: typeof collectorAnalytics[0]) => {
    if (!campaign) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Collector Statement - ${collectorItem.officer.name}</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 25px; color: #0f172a; font-size: 12px; }
            .header { text-align: center; border-bottom: 2px solid #4338ca; padding-bottom: 12px; margin-bottom: 16px; }
            .title { font-size: 18px; font-weight: 900; color: #1e1b4b; }
            .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
            .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 3px 10px; border-radius: 12px; font-weight: 700; font-size: 11px; margin-top: 6px; }
            .summary-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; margin: 15px 0; display: flex; justify-content: space-around; text-align: center; }
            .stat-val { font-size: 18px; font-weight: 900; color: #047857; }
            .stat-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th { background: #f1f5f9; color: #334155; font-weight: 800; padding: 8px 6px; border: 1px solid #cbd5e1; text-align: left; }
            td { padding: 6px 6px; border: 1px solid #cbd5e1; }
            .amt { text-align: right; font-weight: 800; color: #047857; }
            .footer { margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${campaign.title}</div>
            <div class="subtitle">Official Cash Collector Statement & Audit Record</div>
            <span class="badge">${collectorItem.officer.name} (${collectorItem.officer.role}) • Ph: ${collectorItem.officer.phone}</span>
          </div>

          <div class="summary-box">
            <div>
              <div class="stat-val">₹${collectorItem.totalCashAmount.toLocaleString('en-IN')}</div>
              <div class="stat-lbl">Total Cash Collected</div>
            </div>
            <div>
              <div class="stat-val">${collectorItem.totalTxnCount}</div>
              <div class="stat-lbl">Transactions Processed</div>
            </div>
            <div>
              <div class="stat-val">₹${collectorItem.totalTxnCount > 0 ? Math.round(collectorItem.totalCashAmount / collectorItem.totalTxnCount).toLocaleString('en-IN') : 0}</div>
              <div class="stat-lbl">Avg. Collection / Txn</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 25px;">#</th>
                <th>Token ID</th>
                <th>Pek Hun (Date/Time)</th>
                <th>Petu Hming (Donor)</th>
                <th>Bial / Section</th>
                <th>Category / Head</th>
                <th style="text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${collectorItem.txns.map((t, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td style="font-family: monospace;">${t.id}</td>
                  <td>${formatDateTimeDDMMYYYY(t.timestamp || '')}</td>
                  <td><b>${t.donorName || 'Anonymous'}</b></td>
                  <td>${t.donorVeng || '-'}</td>
                  <td>${t.subCategory || 'General'}</td>
                  <td class="amt">₹${Number(t.amount).toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            <span>Generated on: ${formatDateTimeDDMMYYYY(new Date().toISOString())}</span>
            <span>Verified By: ${collectorItem.officer.name} (${collectorItem.officer.role})</span>
          </div>
        </body>
      </html>
    `;

    printHtmlSafely(html, `Collector-Statement-${collectorItem.officer.name}`);
  }, [campaign]);

  // Auditor Grant Handlers
  const filteredAuditorMembers = useMemo(() => {
    if (!availableMembers || availableMembers.length === 0) return [];
    const q = auditorMemberSearch.trim().toLowerCase();
    if (!q) return availableMembers.slice(0, 25);
    return availableMembers.filter(m => {
      const name = (m.name || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      const phone = (m.fullPhone || m.phone || m.phoneLast4 || '').toLowerCase();
      const sec = (m.section || '').toLowerCase();
      return name.includes(q) || id.includes(q) || phone.includes(q) || sec.includes(q);
    }).slice(0, 30);
  }, [availableMembers, auditorMemberSearch]);

  const handleSelectAuditorFromRoll = (mem: MemberRecord) => {
    setSelectedAuditorMember(mem);
    setAuditorNameInput(mem.name);
    const phoneCand = (mem.fullPhone || mem.phone || '').replace(/\D/g, '').slice(-10);
    if (phoneCand) setAuditorPhoneInput(phoneCand);
    if (!auditorNotesInput) {
      setAuditorNotesInput(`Member Roll: ${mem.id}${mem.section ? ` (${mem.section})` : ''} - Sum Endiktu`);
    }
    setIsAuditorMemberDropdownOpen(false);
    setAuditorMemberSearch('');
  };

  const buildAuditorInviteMessage = (grant: AuditorAccessGrant) => {
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://ronpay.app';
    const name = grant.auditorName || grant.auditor_name || 'Auditor';
    const phone = grant.auditorPhone || grant.auditor_phone || '';
    const pin = grant.pin || '1234';
    const expStr = formatDateTimeDDMMYYYY(grant.expiresAt || grant.expires_at || '');
    const periodStr = grant.auditPeriod 
      ? `${grant.auditPeriod}${grant.auditFromDate && grant.auditToDate ? ` (${formatDateDDMMYYYY(grant.auditFromDate)} – ${formatDateDDMMYYYY(grant.auditToDate)})` : ''}`
      : 'Hun Chhung Zawng (All Records)';
    return [
      `⚖️ *RONPAY - SUM ENDIKTU (AUDITOR) RUATNA*`,
      ``,
      `Chibai *${name}*,`,
      `*${campaign?.title || grant.campaignTitle}* sum dinhmun, receipt leh expenditure voucher-te online-a enfiah (Audit) turin ruat i ni e.`,
      ``,
      `🔐 *Auditor Login Details:*`,
      `• App Link: ${appOrigin}/?view=app`,
      `• Login Phone: *+91 ${phone}*`,
      `• Security MPIN: *${pin}* (SMS OTP *123456* pawh a hman theih)`,
      `• Audit Hun Bi Tiam: *${periodStr}*`,
      `• Access Tawp Hun: *${expStr}*`,
      ``,
      `📌 *Luh Dan:* RonPay App-ah khan i Phone Number (+91 ${phone}) leh Security MPIN (${pin}) hmangin Sign-In la, Home Screen-a *"Online Sum Endiktu (Auditor Portal)"* banner hmetin accounts enfiahna, Sign & Lock, leh Audit Certificate print-na i hmang thei nghal ang.`
    ].join('\n');
  };

  const handleShareAuditorWhatsApp = (grant: AuditorAccessGrant) => {
    const text = buildAuditorInviteMessage(grant);
    const cleanPhone = String(grant.auditorPhone || grant.auditor_phone || '').replace(/\D/g, '').slice(-10);
    const waUrl = `https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : ''}?text=${encodeURIComponent(text)}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`📲 WhatsApp hriattirna siam fel a ni (Clipboard-ah copy tel nghal a ni).`);
  };

  const handleCopyAuditorInvite = (grant: AuditorAccessGrant) => {
    const text = buildAuditorInviteMessage(grant);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedGrantId(grant.id);
    showToast('📋 Auditor Login Invite leh PIN chu Clipboard-ah copy a ni ta!');
    setTimeout(() => setCopiedGrantId(null), 2500);
  };

  const handleExtendAuditorGrant = (grant: AuditorAccessGrant, extraHours: number = 24) => {
    const nowMs = Date.now();
    const currentExpMs = new Date(grant.expiresAt || grant.expires_at || 0).getTime();
    const baseMs = currentExpMs > nowMs ? currentExpMs : nowMs;
    const newExpiresIso = new Date(baseMs + extraHours * 60 * 60 * 1000).toISOString();
    const updatedGrant: AuditorAccessGrant = {
      ...grant,
      status: 'active',
      expiresAt: newExpiresIso,
      expires_at: newExpiresIso,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    saveAuditorGrant(updatedGrant);
    setAuditorTick(t => t + 1);
    showToast(`⏱️ Auditor ${grant.auditorName || grant.auditor_name} access chu darkar +${extraHours}h-in pawhsei a ni e!`);
  };

  const handleCreateAuditorGrant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaign) return;

    const trimmedName = auditorNameInput.trim();
    const cleanPhone = auditorPhoneInput.replace(/\D/g, '').slice(-10);
    const cleanPin = auditorPinInput.trim() || '1234';

    if (!trimmedName) {
      showToast('⚠️ Auditor hming ziah luh a ngai e.');
      return;
    }
    if (cleanPhone.length < 10) {
      showToast('⚠️ Auditor phone number (10 digit) dik ziah luh a ngai e.');
      return;
    }
    if (cleanPin.length < 4) {
      showToast('⚠️ Audit Security PIN hi digit 4 tal a ni tur a ni.');
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + auditorDurationHours * 60 * 60 * 1000).toISOString();

    // Check if Co-Auditor (2nd Auditor) is also filled in Dual Mode
    const hasCoAuditorInput = auditAppointmentMode === 'dual' && (coAuditorNameInput.trim() !== '' || coAuditorPhoneInput.trim() !== '');
    const cleanCoName = coAuditorNameInput.trim();
    const cleanCoPhone = coAuditorPhoneInput.replace(/\D/g, '').slice(-10);
    const cleanCoPin = coAuditorPinInput.trim() || '1234';

    if (hasCoAuditorInput) {
      if (!cleanCoName) {
        showToast('⚠️ Auditor 2-na (Co-Auditor) hming ziah luh a ngai e.');
        return;
      }
      if (cleanCoPhone.length < 10) {
        showToast('⚠️ Auditor 2-na (Co-Auditor) phone number (10 digit) dik ziah luh a ngai e.');
        return;
      }
      if (cleanCoPhone === cleanPhone) {
        showToast('⚠️ Auditor 1 leh Auditor 2 phone number a inang thei lo.');
        return;
      }
    }

    // Check if an active grant already exists for Auditor 1 phone on this campaign; if so, update it
    const existingGrant = auditorGrants.find(
      g => String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10) === cleanPhone
    );

    const newGrant: AuditorAccessGrant = {
      id: existingGrant ? existingGrant.id : `GRANT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      auditorName: trimmedName,
      auditor_name: trimmedName,
      auditorPhone: cleanPhone,
      auditor_phone: cleanPhone,
      memberId: selectedAuditorMember?.id || existingGrant?.memberId,
      section: selectedAuditorMember?.section || existingGrant?.section,
      pin: cleanPin,
      campaignId: campaign.id,
      campaign_id: campaign.id,
      campaignTitle: campaign.title,
      campaign_title: campaign.title,
      grantedBy: creatorProfile?.name || 'Creator',
      granted_by: creatorProfile?.name || 'Creator',
      grantedByName: creatorProfile?.name || 'Creator',
      grantedAt: now.toISOString(),
      granted_at: now.toISOString(),
      expiresAt: expiresAt,
      expires_at: expiresAt,
      status: 'active',
      auditPeriod: auditorPeriodLabel || defaultFyLabel,
      audit_period: auditorPeriodLabel || defaultFyLabel,
      auditFromDate: auditorFromDate || '',
      audit_from_date: auditorFromDate || '',
      auditToDate: auditorToDate || '',
      audit_to_date: auditorToDate || '',
      notes: auditorNotesInput.trim() || `Financial Audit Access (${auditorDurationHours} Hours)`,
      permissions: ['AUDIT_FINANCIAL_REPORTS', 'MANAGE_AUDITOR_GRANTS']
    };

    saveAuditorGrant(newGrant);

    if (hasCoAuditorInput) {
      const existingCoGrant = auditorGrants.find(
        g => String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10) === cleanCoPhone
      );
      const coGrant: AuditorAccessGrant = {
        id: existingCoGrant ? existingCoGrant.id : `GRANT_${Date.now() + 1}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        auditorName: cleanCoName,
        auditor_name: cleanCoName,
        auditorPhone: cleanCoPhone,
        auditor_phone: cleanCoPhone,
        pin: cleanCoPin,
        campaignId: campaign.id,
        campaign_id: campaign.id,
        campaignTitle: campaign.title,
        campaign_title: campaign.title,
        grantedBy: creatorProfile?.name || 'Creator',
        granted_by: creatorProfile?.name || 'Creator',
        grantedByName: creatorProfile?.name || 'Creator',
        grantedAt: now.toISOString(),
        granted_at: now.toISOString(),
        expiresAt: expiresAt,
        expires_at: expiresAt,
        status: 'active',
        auditPeriod: auditorPeriodLabel || defaultFyLabel,
        audit_period: auditorPeriodLabel || defaultFyLabel,
        auditFromDate: auditorFromDate || '',
        audit_from_date: auditorFromDate || '',
        auditToDate: auditorToDate || '',
        audit_to_date: auditorToDate || '',
        notes: auditorNotesInput.trim() || `Co-Auditor Financial Audit Access (${auditorDurationHours} Hours)`,
        permissions: ['AUDIT_FINANCIAL_REPORTS', 'MANAGE_AUDITOR_GRANTS']
      };
      saveAuditorGrant(coGrant);
    }

    const updatedGrants = getStoredAuditorGrants(campaign.id);
    const isNowDual = auditAppointmentMode === 'dual' || updatedGrants.filter(g => g.status === 'active').length >= 2;
    const updatedCamp: Campaign = {
      ...campaign,
      auditorGrants: updatedGrants,
      requireDualAuditorConsensus: isNowDual,
      metadata: {
        ...(campaign.metadata || {}),
        auditorGrants: updatedGrants,
        requireDualAuditorConsensus: isNowDual
      }
    };
    saveCampaign(updatedCamp);
    setAuditorGrants(updatedGrants);
    if (onCampaignUpdated) {
      onCampaignUpdated(updatedCamp);
    }
    setAuditorTick(t => t + 1);
    setIsAddAuditorOpen(false);
    setSelectedAuditorMember(null);
    setAuditorNameInput('');
    setAuditorPhoneInput('');
    setAuditorPinInput('1234');
    setCoAuditorNameInput('');
    setCoAuditorPhoneInput('');
    setCoAuditorPinInput('1234');
    setAuditorNotesInput('');
    setAuditorPeriodPreset('fy_prev');
    setAuditorPeriodLabel(defaultFyLabel);
    setAuditorFromDate(defaultFromDate);
    setAuditorToDate(defaultToDate);
    if (hasCoAuditorInput) {
      showToast(`✅ Co-Auditors 2 (${trimmedName} & ${cleanCoName}, Period: ${auditorPeriodLabel}) ruat fel a ni e!`);
    } else {
      showToast(`✅ Auditor ${trimmedName} (+91 ${cleanPhone}, Period: ${auditorPeriodLabel}) ruat fel a ni e!`);
    }
  };

  const handleRevokeGrant = (grantId: string) => {
    revokeAuditorGrant(grantId, creatorProfile?.name || 'Creator');
    if (campaign) {
      const updatedGrants = getStoredAuditorGrants(campaign.id);
      setAuditorGrants(updatedGrants);
      if (onCampaignUpdated) {
        onCampaignUpdated({ ...campaign, auditorGrants: updatedGrants });
      }
    }
    setAuditorTick(t => t + 1);
    showToast('🛑 Auditor access tihtawp (revoked) a ni ta.');
  };

  const handlePermanentlyDeleteGrant = async (grant: AuditorAccessGrant) => {
    try {
      await permanentlyDeleteAuditorGrant(grant.id);
      if (campaign) {
        const updatedGrants = getStoredAuditorGrants(campaign.id);
        setAuditorGrants(updatedGrants);
        if (onCampaignUpdated) {
          onCampaignUpdated({ ...campaign, auditorGrants: updatedGrants });
        }
      }
      setAuditorTick(t => t + 1);
      setConfirmDeleteGrant(null);
      showToast(`🗑️ Auditor ${grant.auditorName || 'record'} hi database atanga paih hlen (Permanent Delete) a ni ta.`);
    } catch {
      showToast('❌ Auditor paih theih a ni lo, khawngaihin try leh rawh.');
    }
  };

  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn text-slate-800">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 shrink-0 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/90 text-amber-300 flex items-center justify-center shadow-md border border-indigo-400/40">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white truncate max-w-md">
                  {campaign.title}
                </h2>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-wide">
                  {campaign.category}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Authorized Persons Management & Collector Analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
              isFullManager 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
            }`}>
              {isFullManager ? '👑 Creator / Admin Access' : `🛡️ ${currentOfficerMatch?.role || 'Authorized Officer'}`}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 bg-slate-50 shrink-0">
          <div className="flex gap-2 flex-wrap">
            {isFullManager && (
              <button
                type="button"
                onClick={() => setActiveTab('management')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeTab === 'management'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Authorized Officers ({officersList.length})</span>
              </button>
            )}

            {isFullManager && (
              <button
                type="button"
                onClick={() => setActiveTab('auditors')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                  activeTab === 'auditors'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>Auditor Ruatna ({auditorGrants.filter(g => g.status === 'active').length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isFullManager ? 'Collector Analytics & Audit' : 'My Collection History'}</span>
            </button>
          </div>

          {activeTab === 'management' && isFullManager && !isAddFormOpen && (
            <button
              type="button"
              onClick={() => {
                setEditingOfficerIndex(null);
                setFormName('');
                setFormPhone('');
                setFormRole('Cashier');
                setFormPin('');
                setFormCanClearCash(true);
                setFormCanRecordExpenses(false);
                setFormCanManageMembers(true);
                setFormNotes('');
                setIsAddFormOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-1.5 px-3 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Assign New Officer</span>
            </button>
          )}
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 mx-4 mt-3 rounded-xl shadow-lg border border-slate-700 flex items-center justify-between animate-fadeIn">
            <span>{toastMessage}</span>
            <button type="button" onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* TAB 1: AUTHORIZED PERSONS MANAGEMENT */}
          {activeTab === 'management' && (
            <div className="space-y-4">
              
              {/* Creator Inline Add/Edit Form */}
              {isAddFormOpen && (
                <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl space-y-3.5 shadow-xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-indigo-200 pb-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-700" />
                      <h3 className="font-black text-sm text-indigo-950">
                        {editingOfficerIndex !== null ? 'Authorized Officer Siamthatna' : 'Authorized Officer Thar Ruatna'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddFormOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 1. Member Roll Linkage Selector */}
                  <div className="bg-white p-3.5 rounded-xl border border-indigo-200/90 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-indigo-950 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>1. Member Roll Aṭanga Thlanna (Official Directory Binding) *</span>
                      </label>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                        {availableMembers.length} Members in Roll
                      </span>
                    </div>

                    {selectedMember ? (
                      /* Verified Member Card */
                      <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-sm text-emerald-950">{selectedMember.name}</span>
                              <span className="text-[10px] font-mono font-bold bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-300">
                                Roll: {selectedMember.id}
                              </span>
                              {selectedMember.section && (
                                <span className="text-[10px] font-bold bg-white/80 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                                  {selectedMember.section}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-emerald-800 mt-0.5 flex-wrap">
                              {selectedMember.fatherName && (
                                <span>P/s: {selectedMember.fatherName} • </span>
                              )}
                              <span className="font-mono">
                                Phone: {selectedMember.fullPhone || selectedMember.phone || (selectedMember.phoneLast4 ? `...${selectedMember.phoneLast4}` : 'La awm lo')}
                              </span>
                              <span className="text-emerald-700 text-[10px] font-bold bg-emerald-100 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                <Link2 className="w-2.5 h-2.5" />
                                <span>Bound to Database</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleClearMemberSelection}
                          className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-300 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition shrink-0 cursor-pointer"
                        >
                          Thlang Dang Rawn (Change)
                        </button>
                      </div>
                    ) : (
                      /* Searchable Dropdown / Selector */
                      <div className="relative">
                        <div className="relative">
                          <input
                            type="text"
                            value={memberSearchQuery}
                            onChange={(e) => {
                              setMemberSearchQuery(e.target.value);
                              setIsMemberDropdownOpen(true);
                            }}
                            onFocus={() => setIsMemberDropdownOpen(true)}
                            placeholder="Search Member: Hming, Roll No (e.g. EBE-1460), Section, emaw Phone..."
                            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                          {memberSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setMemberSearchQuery('')}
                              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Dropdown Results List */}
                        {isMemberDropdownOpen && (
                          <div className="absolute z-30 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl divide-y divide-slate-100">
                            <div className="p-2 bg-slate-50 flex items-center justify-between text-[10px] font-bold text-slate-600 sticky top-0 z-10 border-b border-slate-200">
                              <span>Member Roll aṭangin Officer tur thlang rawh ({filteredMembers.length} found):</span>
                              <button
                                type="button"
                                onClick={() => setIsMemberDropdownOpen(false)}
                                className="text-slate-400 hover:text-slate-600 font-bold"
                              >
                                Close
                              </button>
                            </div>

                            {filteredMembers.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                "{memberSearchQuery}" nen inmil member an awm lo.
                              </div>
                            ) : (
                              filteredMembers.map((mem) => {
                                const isAlreadyOfficer = officersList.some(o => 
                                  (o.memberId && o.memberId.toLowerCase() === mem.id.toLowerCase()) ||
                                  (o.rollNo && o.rollNo.toLowerCase() === mem.id.toLowerCase()) ||
                                  ((mem.fullPhone || mem.phone) && o.phone === (mem.fullPhone || mem.phone)?.slice(-10))
                                );
                                const assignedRole = isAlreadyOfficer ? officersList.find(o => 
                                  (o.memberId && o.memberId.toLowerCase() === mem.id.toLowerCase()) ||
                                  (o.rollNo && o.rollNo.toLowerCase() === mem.id.toLowerCase()) ||
                                  ((mem.fullPhone || mem.phone) && o.phone === (mem.fullPhone || mem.phone)?.slice(-10))
                                )?.role : null;

                                return (
                                  <button
                                    key={mem.id}
                                    type="button"
                                    onClick={() => handleSelectMember(mem)}
                                    className="w-full text-left p-2.5 hover:bg-indigo-50/70 transition flex items-center justify-between gap-2 cursor-pointer group"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center font-bold text-[11px] shrink-0 transition">
                                        {mem.name.charAt(0)}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-bold text-xs text-slate-900 group-hover:text-indigo-900">
                                            {mem.name}
                                          </span>
                                          <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-800 px-1.5 py-0.2 rounded">
                                            {mem.id}
                                          </span>
                                          {mem.section && (
                                            <span className="text-[9.5px] text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.2 rounded">
                                              {mem.section}
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10.5px] text-slate-500 flex items-center gap-1 mt-0.5">
                                          {mem.fatherName && <span>P/s: {mem.fatherName} • </span>}
                                          <span>Ph: {mem.fullPhone || mem.phone || (mem.phoneLast4 ? `...${mem.phoneLast4}` : 'La awm lo')}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1.5">
                                      {isAlreadyOfficer ? (
                                        <span className="text-[9.5px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                          {assignedRole} ni mek
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition flex items-center gap-0.5">
                                          <span>Thlang rawh</span>
                                          <ChevronRight className="w-3 h-3" />
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Officer Details & Role Permissions */}
                  <div className="border-t border-indigo-200/60 pt-3">
                    <span className="block text-[11px] font-black uppercase text-indigo-950 mb-2">
                      2. Officer Details & Assigned Role
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                          Hming (Officer Full Name) *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="e.g. Lalhmingmawia"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {formMemberId && (
                            <span className="absolute right-2.5 top-2 text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              {formMemberId}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                          Phone Number (10 Digits Login/Binding) *
                        </label>
                        <input
                          type="tel"
                          value={formPhone}
                          onChange={(e) => setFormPhone(e.target.value)}
                          placeholder="e.g. 9862123456"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {selectedMember && (!selectedMember.fullPhone || selectedMember.fullPhone.length < 10) && (
                          <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Member record-ah phone number kim a la awm lo. 10-digit i chhut luh hian Member Roll-ah a update nghal ang.</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                          Role / Udaihna *
                        </label>
                        <select
                          value={formRole}
                          onChange={(e) => setFormRole(e.target.value as AuthorizedOfficerRole)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {AVAILABLE_ROLES.map(r => (
                            <option key={r.role} value={r.role}>
                              {r.label} — ({r.desc.slice(0, 32)}...)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                          PIN / Passcode (Optional 4 Digits)
                        </label>
                        <input
                          type="password"
                          maxLength={6}
                          value={formPin}
                          onChange={(e) => setFormPin(e.target.value)}
                          placeholder="e.g. 1234"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10.5px] font-bold text-slate-700 uppercase mb-1">
                          Notes / Department / Bial (Optional)
                        </label>
                        <input
                          type="text"
                          value={formNotes}
                          onChange={(e) => setFormNotes(e.target.value)}
                          placeholder="e.g. Section 2 Collector / Kohhran Treasurer"
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Permissions Checklist */}
                  <div className="bg-white p-3 rounded-xl border border-indigo-200/80 space-y-2">
                    <span className="block text-[10.5px] font-black text-indigo-950 uppercase tracking-wide">
                      Clearance & Access Rights:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formCanClearCash}
                          onChange={(e) => setFormCanClearCash(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                        <span className="font-bold text-emerald-950 text-[11px]">
                          Cash Clearance Rights (Approve / Reject)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formCanManageMembers}
                          onChange={(e) => setFormCanManageMembers(e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                        />
                        <span className="font-bold text-blue-950 text-[11px]">
                          Member Roll & Quick Cash Entry
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-purple-50 border border-purple-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formCanRecordExpenses}
                          onChange={(e) => setFormCanRecordExpenses(e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                        />
                        <span className="font-bold text-purple-950 text-[11px]">
                          Record Expenditures / Hmanna
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddFormOpen(false)}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveOfficer}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{editingOfficerIndex !== null ? 'Save Changes' : 'Confirm Assignment'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* List of Officers */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                    Assigned Officers & Cash Clearance Status ({officersList.length})
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Cash receipt verify tu turte
                  </span>
                </div>

                {officersList.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-2">
                    <Users className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      He campaign ah hian Authorized Officer an la awm lo.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Treasurer, Accountant, Cashier emaw Collector i ruat duh chuan a chunga 'Assign New Officer' button khi hmet rawh.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {officersList.map((officer, idx) => {
                      const roleConfig = AVAILABLE_ROLES.find(r => r.role === officer.role) || AVAILABLE_ROLES[4];
                      return (
                        <div
                          key={officer.id || idx}
                          className="bg-white border border-slate-200 hover:border-indigo-300 p-4 rounded-2xl shadow-xs transition space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-black text-sm text-slate-900 leading-tight">
                                    {officer.name}
                                  </h4>
                                  {(officer.rollNo || officer.memberId) && (
                                    <span className="inline-flex items-center gap-0.5 text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded-md" title="Linked Member Roll ID">
                                      <Link2 className="w-2.5 h-2.5" />
                                      <span>{officer.rollNo || officer.memberId}</span>
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mt-0.5 flex-wrap">
                                  <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>{officer.phone}</span>
                                  </div>
                                  {officer.section && (
                                    <span className="text-[10px] text-slate-500 font-sans bg-slate-100 px-1.5 py-0.2 rounded">
                                      {officer.section}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${roleConfig.color}`}>
                                {officer.role}
                              </span>
                            </div>

                            {officer.notes && (
                              <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                {officer.notes}
                              </p>
                            )}

                            {/* Rights Badges */}
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {officer.canClearCash !== false ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Cash Clearance Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  <span>Clearance Inactive</span>
                                </span>
                              )}

                              {officer.canManageMembers && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                  <span>Member Roll</span>
                                </span>
                              )}

                              {officer.canRecordExpenses && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                  <span>Expense Recorder</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Footer Actions */}
                          {isFullManager && (
                            <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2">
                              <span className="text-[9.5px] text-slate-400">
                                Assigned: {officer.assignedAt ? formatDateDDMMYYYY(officer.assignedAt) : 'N/A'}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleEditOfficer(idx)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                                  title="Edit officer details"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOfficer(idx)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                  title="Remove officer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AUDITOR RUATNA (TIME-BOUND AUDITOR ACCESS) */}
          {activeTab === 'auditors' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-4 rounded-2xl">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck className="w-5 h-5 text-amber-700" />
                    <h3 className="font-extrabold text-sm sm:text-base text-amber-950">
                      Sum Endiktu (Auditor) Ruatna & Temporary Access
                    </h3>
                    <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                      Cloud Synced
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/80 mt-1">
                    He Bawm sum dinhmun, receipt leh expenditure voucher endiktu tur ruat rawh. Auditor-in amah phone aṭangin a Phone Number leh Audit PIN hmangin a login thei nghal ang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddAuditorOpen(!isAddAuditorOpen)}
                  className="py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isAddAuditorOpen ? 'Form Khár Rawh' : 'Auditor Thar Ruat Rawh'}</span>
                </button>
              </div>

              {/* Optional Single vs. Co-Auditor (Mi 1 emaw Mi 2 Ruatna) Mode Selector Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-slate-700 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-400 shrink-0" />
                      <h4 className="font-black text-xs sm:text-sm text-white">
                        Audit Kalphung Thlanna: Mi 1 (Single) vs. Mi 2 (Co-Auditor Mode)
                      </h4>
                      <span className="text-[9.5px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        Optional
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Auditor 1 chauh ruat emaw, Auditor 2 (Co-Auditors) hmun hran leh hun hrana endik a Joint Audited Report chhuah turin hetah hian thlang rawh.
                    </p>
                  </div>

                  <div className="inline-flex rounded-xl bg-slate-800 p-1 border border-slate-700 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAuditAppointmentMode('single');
                        if (campaign) {
                          const updatedCamp: Campaign = {
                            ...campaign,
                            requireDualAuditorConsensus: false,
                            metadata: { ...(campaign.metadata || {}), requireDualAuditorConsensus: false }
                          };
                          saveCampaign(updatedCamp);
                          if (onCampaignUpdated) onCampaignUpdated(updatedCamp);
                        }
                        showToast('👤 Single Auditor Mode (Mi 1) thlan a ni e.');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1.5 ${
                        auditAppointmentMode === 'single'
                          ? 'bg-amber-500 text-slate-950 shadow-2xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>👤 Mi 1 (Single Auditor)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuditAppointmentMode('dual');
                        if (campaign) {
                          const updatedCamp: Campaign = {
                            ...campaign,
                            requireDualAuditorConsensus: true,
                            metadata: { ...(campaign.metadata || {}), requireDualAuditorConsensus: true }
                          };
                          saveCampaign(updatedCamp);
                          if (onCampaignUpdated) onCampaignUpdated(updatedCamp);
                        }
                        setIsAddAuditorOpen(true);
                        showToast('👥 Co-Auditor Mode (Mi 2 — Joint Consensus) thlan a ni e!');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer flex items-center gap-1.5 ${
                        auditAppointmentMode === 'dual'
                          ? 'bg-emerald-500 text-slate-950 shadow-2xs'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      <span>👥 Mi 2 (Co-Auditors)</span>
                    </button>
                  </div>
                </div>

                {auditAppointmentMode === 'dual' && (
                  <div className="bg-slate-800/90 border border-emerald-500/30 rounded-xl p-2.5 text-[11px] text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>👥 Co-Auditor Mode (Mi 2) Active:</strong> Auditor pahnih te hian hmun hran leh hun inang lo aṭang pawhin an phone/computer ve ve aṭangin an audit thei ang. An pahnih chhinchhiahna (`✓ Dik` / `⚠️ Query`) chu Server-ah a in-merge zel ang a, an pahniha an Sign veleh <strong>Joint Audited Report &amp; Certificate</strong> a chhuak ang.
                    </div>
                  </div>
                )}
              </div>

              {/* Add Auditor Form */}
              {isAddAuditorOpen && (
                <form onSubmit={handleCreateAuditorGrant} className="bg-white border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-2.5 flex-wrap gap-2">
                    <h4 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-amber-600" />
                      <span>{auditAppointmentMode === 'dual' ? 'Co-Auditors (Mi 2) Ruatna Form' : 'Auditor Thar Ruatna Form'}</span>
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAuditAppointmentMode(prev => prev === 'single' ? 'dual' : 'single')}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-full border cursor-pointer transition ${
                          auditAppointmentMode === 'dual'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {auditAppointmentMode === 'dual' ? '👥 Mi 2 Ruat Rualna (Active)' : '+ Mi 2 (Co-Auditor) Ruat Tel Duh Chuan Click Rawh'}
                      </button>
                    </div>
                  </div>

                  {/* Optional Quick-Pick from Member Roll */}
                  {availableMembers.length > 0 && (
                    <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black text-amber-950 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-amber-700" />
                          <span>Member Roll Aṭanga Thlan Chhuahna (Optional Quick Fill)</span>
                        </label>
                        {selectedAuditorMember && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAuditorMember(null);
                              setAuditorNameInput('');
                              setAuditorPhoneInput('');
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>

                      {selectedAuditorMember ? (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div>
                              <span className="font-black text-emerald-950">{selectedAuditorMember.name}</span>
                              <span className="ml-2 text-[10px] font-mono bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded">
                                {selectedAuditorMember.id}
                              </span>
                              {selectedAuditorMember.section && (
                                <span className="ml-1.5 text-[10px] text-emerald-800 font-bold">
                                  • {selectedAuditorMember.section}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                            <input
                              type="text"
                              value={auditorMemberSearch}
                              onFocus={() => setIsAuditorMemberDropdownOpen(true)}
                              onChange={e => {
                                setAuditorMemberSearch(e.target.value);
                                setIsAuditorMemberDropdownOpen(true);
                              }}
                              placeholder="Member Roll aṭanga zawnna (Hming, Roll ID, Phone)... Emaw a hnuaiah chhu lut direct rawh"
                              className="w-full text-xs pl-8 pr-8 py-2 bg-white rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            {isAuditorMemberDropdownOpen && (
                              <button
                                type="button"
                                onClick={() => setIsAuditorMemberDropdownOpen(false)}
                                className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {isAuditorMemberDropdownOpen && filteredAuditorMembers.length > 0 && (
                            <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                              {filteredAuditorMembers.map(mem => (
                                <button
                                  key={mem.id}
                                  type="button"
                                  onClick={() => handleSelectAuditorFromRoll(mem)}
                                  className="w-full text-left px-3 py-2 hover:bg-amber-50 transition flex items-center justify-between text-xs cursor-pointer"
                                >
                                  <div>
                                    <span className="font-bold text-slate-900">{mem.name}</span>
                                    <span className="ml-1.5 text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                      {mem.id}
                                    </span>
                                    {mem.section && (
                                      <span className="ml-1.5 text-[10px] text-slate-500">
                                        ({mem.section})
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {mem.fullPhone || mem.phone || (mem.phoneLast4 ? `••••${mem.phoneLast4}` : 'No phone')}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Auditor Hming (Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={auditorNameInput}
                        onChange={e => setAuditorNameInput(e.target.value)}
                        placeholder="Entirnan: C. Lalrammawia"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Auditor Phone Number (10 Digit) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={auditorPhoneInput}
                        onChange={e => setAuditorPhoneInput(e.target.value.replace(/\D/g, '').slice(-10))}
                        placeholder="9862xxxxxx"
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Audit Login PIN (4-Digit) *
                        </label>
                        <button
                          type="button"
                          onClick={() => setAuditorPinInput(String(Math.floor(1000 + Math.random() * 9000)))}
                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Random PIN
                        </button>
                      </div>
                      <div className="relative">
                        <Key className="w-3.5 h-3.5 text-amber-600 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={auditorPinInput}
                          onChange={e => setAuditorPinInput(e.target.value.replace(/\s+/g, ''))}
                          placeholder="1234"
                          className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-black tracking-widest text-amber-950"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional 2nd Auditor (Co-Auditor) Row when Dual Mode is active */}
                  {auditAppointmentMode === 'dual' && (
                    <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-emerald-700" />
                          <span>Auditor 2-na (Co-Auditor) Details — Hmun hran aṭanga endik ve tu tur (Optional)</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                          A rualin emaw a hnuah a hrang pawhin a ruat theih
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Auditor 2 Hming (Co-Auditor Name)
                          </label>
                          <input
                            type="text"
                            value={coAuditorNameInput}
                            onChange={e => setCoAuditorNameInput(e.target.value)}
                            placeholder="Entirnan: R. Lallawmawma"
                            className="w-full text-xs p-2.5 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Auditor 2 Phone Number (10 Digit)
                          </label>
                          <input
                            type="tel"
                            maxLength={10}
                            value={coAuditorPhoneInput}
                            onChange={e => setCoAuditorPhoneInput(e.target.value.replace(/\D/g, '').slice(-10))}
                            placeholder="9436xxxxxx"
                            className="w-full text-xs p-2.5 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700">
                              Auditor 2 Login PIN (4-Digit)
                            </label>
                            <button
                              type="button"
                              onClick={() => setCoAuditorPinInput(String(Math.floor(1000 + Math.random() * 9000)))}
                              className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                            >
                              Random PIN
                            </button>
                          </div>
                          <div className="relative">
                            <Key className="w-3.5 h-3.5 text-emerald-600 absolute left-3 top-2.5" />
                            <input
                              type="text"
                              maxLength={6}
                              value={coAuditorPinInput}
                              onChange={e => setCoAuditorPinInput(e.target.value.replace(/\s+/g, ''))}
                              placeholder="1234"
                              className="w-full text-xs pl-8 pr-3 py-2.5 rounded-xl bg-white border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-black tracking-widest text-emerald-950"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Access Hun Tiam (Time-Bound Duration)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { hours: 24, label: 'Ni 1 (24 Hours)' },
                        { hours: 48, label: 'Ni 2 (48 Hours)' },
                        { hours: 168, label: 'Kar 1 (7 Days)' },
                        { hours: 720, label: 'Thla 1 (30 Days)' }
                      ].map(d => (
                        <button
                          key={d.hours}
                          type="button"
                          onClick={() => setAuditorDurationHours(d.hours)}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            auditorDurationHours === d.hours
                              ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Appointed Audit Period (Hun Bi Tiam) */}
                  <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-3.5 space-y-3 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-amber-700" />
                        <span>Audit Tur Hun Bi (Appointed Audit Period) *</span>
                      </label>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300 inline-block w-fit">
                        Auditor-in he hun chhung chiah hi a audit thei ang
                      </span>
                    </div>

                    {/* Presets */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'fy_prev', label: `FY ${fyCurrStart - 1}-${fyCurrStart} (Kum Hmasa)` },
                        { id: 'fy_curr', label: `FY ${fyCurrStart}-${fyCurrStart + 1} (Kumin FY)` },
                        { id: 'cy_prev', label: `Kum ${nowForFy.getFullYear() - 1}` },
                        { id: 'cy_curr', label: `Kum ${nowForFy.getFullYear()}` },
                        { id: 'custom', label: 'Custom Date Range' },
                        { id: 'all', label: 'Hun Chhung Zawng (All)' },
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectAuditPeriodPreset(p.id)}
                          className={`py-1.5 px-2.5 rounded-xl border text-[11px] font-extrabold transition cursor-pointer text-left truncate ${
                            auditorPeriodPreset === p.id
                              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                              : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-50'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    {/* Period Label and Date Range Pickers */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                          Period Label / Title *
                        </label>
                        <input
                          type="text"
                          required
                          value={auditorPeriodLabel}
                          onChange={e => {
                            setAuditorPeriodLabel(e.target.value);
                            setAuditorPeriodPreset('custom');
                          }}
                          placeholder="e.g. FY 2024-2025"
                          className="w-full text-xs p-2.5 rounded-xl bg-white border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                          From Date (Aṭanga)
                        </label>
                        <input
                          type="date"
                          value={auditorFromDate}
                          onChange={e => {
                            setAuditorFromDate(e.target.value);
                            setAuditorPeriodPreset('custom');
                          }}
                          className="w-full text-xs p-2.5 rounded-xl bg-white border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">
                          To Date (Thlengin)
                        </label>
                        <input
                          type="date"
                          value={auditorToDate}
                          onChange={e => {
                            setAuditorToDate(e.target.value);
                            setAuditorPeriodPreset('custom');
                          }}
                          className="w-full text-xs p-2.5 rounded-xl bg-white border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Audit Purpose / Notes (A tulna)
                    </label>
                    <input
                      type="text"
                      value={auditorNotesInput}
                      onChange={e => setAuditorNotesInput(e.target.value)}
                      placeholder="Entirnan: Kumtluang / Annual Financial Audit endik turin..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAddAuditorOpen(false)}
                      className="py-2 px-3.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                    >
                      Thulh Leh Rawh
                    </button>
                    <button
                      type="submit"
                      className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Ruat La Access Pe Rawh</span>
                    </button>
                  </div>
                </form>
              )}

              {/* How Auditor Login Works Info Box */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 text-xs text-indigo-950 flex items-start gap-3">
                <Key className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black text-indigo-950 block">Auditor Login & Endik Dan Kalhmang:</span>
                  <p className="text-[11px] text-indigo-900/90 leading-relaxed">
                    1. Auditor i ruat zawhah a card-a <strong>"WhatsApp Invite"</strong> emaw <strong>"Copy Login Info"</strong> hmetin Auditor hnenah thawn rawh.<br />
                    2. Auditor chuan RonPay App-ah a <strong>Phone Number</strong> leh <strong>Audit PIN</strong> (emaw SMS OTP <code>123456</code>) hmangin a Sign-In ang.<br />
                    3. A login rualin Home Screen-ah <strong>"⚖️ Online Sum Endiktu (Auditor Portal)"</strong> a lo inhawng nghal ang a; Inflow, Senso, Checklist, Sign & Lock, leh Audit Certificate Print a ti thei nghal ang.
                  </p>
                </div>
              </div>

              {/* Auditor Grants List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span>Auditor Ruat Tawh Te ({auditorGrants.length})</span>
                    <button
                      type="button"
                      onClick={handleSyncAuditorsFromCloud}
                      disabled={isSyncingAuditors}
                      className="text-[10.5px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 font-bold cursor-pointer"
                      title="Browser dang atanga Auditor ruat thar sync na"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingAuditors ? 'animate-spin text-indigo-600' : ''}`} />
                      <span>{isSyncingAuditors ? 'Syncing...' : 'Sync Cloud'}</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAuditorPortalOpen(true)}
                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Auditor Portal En Chhin Rawh</span>
                  </button>
                </div>

                {auditorGrants.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-1">
                    <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">He Bawm tan hian Auditor ruat an la awm lo.</p>
                    <p className="text-[11px] text-slate-400">
                      Chunglam a "Auditor Thar Ruat Rawh" button hmang hian temporary access pein auditor i ruat thei e.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {auditorGrants.map(grant => {
                      const expIso = grant.expiresAt || grant.expires_at || '';
                      const isExpired = new Date(expIso).getTime() <= Date.now();
                      const isActive = grant.status === 'active' && !isExpired;
                      const remainingMs = Math.max(0, new Date(expIso).getTime() - Date.now());
                      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                      const displayName = grant.auditorName || grant.auditor_name || 'Auditor';
                      const displayPhone = grant.auditorPhone || grant.auditor_phone || '';
                      const displayPin = grant.pin || '1234';

                      return (
                        <div 
                          key={grant.id} 
                          className={`p-4 rounded-2xl border transition space-y-2.5 flex flex-col justify-between ${
                            isActive 
                              ? 'bg-amber-50/50 border-amber-300 shadow-2xs' 
                              : 'bg-slate-50 border-slate-200 opacity-85'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                                  <UserCheck className="w-4 h-4 text-amber-700 shrink-0" />
                                  <span>{displayName}</span>
                                  {grant.memberId && (
                                    <span className="text-[9.5px] font-mono bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded border border-amber-200">
                                      {grant.memberId}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] font-mono text-slate-600 flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-slate-400" />
                                    <span>+91 {displayPhone}</span>
                                  </span>
                                  <span className="bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-950 font-black text-[10px]">
                                    PIN: {displayPin}
                                  </span>
                                </div>
                              </div>
                              <div>
                                {isActive ? (
                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>ACTIVE ({formatRemainingAuditTimeMizo(expIso)})</span>
                                  </span>
                                ) : grant.status === 'revoked' ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                                    REVOKED
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300">
                                    EXPIRED
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Appointed Period Display */}
                            <div className="bg-white/90 p-2 rounded-xl border border-amber-200 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between font-bold text-slate-800">
                                <span className="flex items-center gap-1 text-indigo-900">
                                  <Calendar className="w-3 h-3 text-indigo-600" />
                                  <span>Audit Hun Bi:</span>
                                </span>
                                <span className="text-amber-950 font-black">{grant.auditPeriod || 'Hun Chhung Zawng'}</span>
                              </div>
                              {(grant.auditFromDate || grant.auditToDate) && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {grant.auditFromDate ? formatDateDDMMYYYY(grant.auditFromDate) : 'Start'} – {grant.auditToDate ? formatDateDDMMYYYY(grant.auditToDate) : 'Present'}
                                </div>
                              )}
                            </div>

                            {grant.notes && (
                              <p className="text-[11px] text-slate-600 bg-white/80 p-2 rounded-xl border border-slate-200/70">
                                {grant.notes}
                              </p>
                            )}

                            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200/60">
                              <span>Ruattu: {grant.grantedBy || grant.granted_by}</span>
                              <span>Tawp hun: {formatDateDDMMYYYY(expIso)}</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-amber-200/60">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleShareAuditorWhatsApp(grant)}
                                className="py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10.5px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                                title="Send Login Credentials via WhatsApp"
                              >
                                <span>📲 WhatsApp Invite</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyAuditorInvite(grant)}
                                className="py-1.5 px-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Copy Login Info"
                              >
                                {copiedGrantId === grant.id ? (
                                  <span className="text-emerald-700 font-black">✓ Copied</span>
                                ) : (
                                  <span>📋 Copy Info</span>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => handleExtendAuditorGrant(grant, 24)}
                                className="py-1.5 px-2 rounded-lg border border-amber-300 bg-amber-100/70 hover:bg-amber-200 text-amber-950 text-[10.5px] font-bold transition cursor-pointer"
                                title="Extend access by 24 Hours"
                              >
                                +24h Pawhsei
                              </button>
                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeGrant(grant.id)}
                                  className="py-1.5 px-2 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                  title="Access Tihtawp Rih (Revoke)"
                                >
                                  <Clock className="w-3 h-3 text-amber-700" />
                                  <span>Tawp tir</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteGrant(grant)}
                                className="py-1.5 px-2 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Auditor he Bawm atanga Paih Hlen (Permanent Delete)"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>Paih Hlen</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsAuditorPortalOpen(true)}
                                className="py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                <span>Portal</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: COLLECTOR ANALYTICS & AUDIT VIEW */}
          {activeTab === 'analytics' && (
            <div className="space-y-4">
              
              {/* Aggregate KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50/80 border border-emerald-200 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Cash Collected</span>
                    <Banknote className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-950">
                    ₹{overallCashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9.5px] text-emerald-700 font-medium">
                    Verified & committed to official ledger
                  </span>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-indigo-800">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Total Cash Receipts</span>
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-xl font-black text-indigo-950">
                    {confirmedCampaignTransactions.filter(t => t.paymentMethod === 'cash').length}
                  </div>
                  <span className="text-[9.5px] text-indigo-700 font-medium">
                    Counter deposits & collector records
                  </span>
                </div>

                <div className="bg-purple-50/80 border border-purple-200 p-3.5 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-purple-800">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider">Authorized Collectors</span>
                    <Users className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-xl font-black text-purple-950">
                    {officersList.length} Persons
                  </div>
                  <span className="text-[9.5px] text-purple-700 font-medium">
                    Active clearance & collection officers
                  </span>
                </div>
              </div>

              {/* 
                CREATOR VS AUTHORIZED PERSON AUDIT BREAKDOWN VIEW 
                - Creator/Admin sees all officers breakdown
                - Authorized Person only sees their own stats
              */}
              {isFullManager ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Authorized Persons Collection Breakdown
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        Individual collection totals & audit statistics
                      </p>
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200">
                      Creator Audit Mode
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {collectorAnalytics.map((item, idx) => {
                      const pct = overallCashTotal > 0 
                        ? Math.round((item.totalCashAmount / overallCashTotal) * 100) 
                        : 0;
                      const isSelected = selectedCollectorPhone === item.officer.phone.replace(/\D/g, '').slice(-10);

                      return (
                        <div
                          key={item.officer.id || idx}
                          onClick={() => {
                            const p = item.officer.phone.replace(/\D/g, '').slice(-10);
                            setSelectedCollectorPhone(isSelected ? 'all' : p);
                          }}
                          className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                            isSelected 
                              ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs' 
                              : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-black text-xs text-slate-900">
                                  {item.officer.name}
                                </h4>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-800">
                                  {item.officer.role}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Ph: {item.officer.phone}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-emerald-700">
                                ₹{item.totalCashAmount.toLocaleString('en-IN')}
                              </span>
                              <div className="text-[9px] font-bold text-slate-500">
                                {pct}% of total cash
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1 border-t border-slate-200/80">
                            <div className="bg-white p-1.5 rounded-xl border border-slate-200/80">
                              <span className="block text-xs font-black text-slate-800">{item.totalTxnCount}</span>
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Receipts</span>
                            </div>
                            <div className="bg-white p-1.5 rounded-xl border border-slate-200/80">
                              <span className="block text-xs font-black text-slate-800">
                                ₹{item.totalTxnCount > 0 ? Math.round(item.totalCashAmount / item.totalTxnCount).toLocaleString('en-IN') : 0}
                              </span>
                              <span className="text-[9px] text-slate-500 font-bold uppercase">Avg / Receipt</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                            <span className="truncate">
                              Latest: {item.latestTxnDate ? formatDateTimeDDMMYYYY(item.latestTxnDate) : 'No transactions'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintCollectorStatement(item);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 p-1"
                              title="Print detailed statement"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print Slip</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* RESTRICTED AUDIT VIEW FOR INDIVIDUAL AUTHORIZED OFFICER */
                <div className="bg-indigo-50/70 border border-indigo-200 p-4 rounded-2xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                        My Collection Performance & Clearance History
                      </h3>
                      <p className="text-[11px] text-indigo-800">
                        Officer: <strong className="font-bold">{currentOfficerMatch?.name}</strong> ({currentOfficerMatch?.role})
                      </p>
                    </div>
                    <span className="text-[10px] font-bold bg-indigo-200/90 text-indigo-900 px-2 py-0.5 rounded-md border border-indigo-300">
                      Officer Mode
                    </span>
                  </div>

                  <p className="text-[11px] text-indigo-900 bg-white/80 p-2.5 rounded-xl border border-indigo-200 leading-relaxed font-medium">
                    🔒 I thil khawn/approve tawh te chauh he hmunah hian i en thei a. Authorized Person dangte record leh campaign aggregate pumpui chu Campaign Creator / Admin te chauhvin an en thei e.
                  </p>
                </div>
              )}

              {/* FILTERABLE TRANSACTION HISTORY LOGS */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Cash Receipts Log & Verification Audit ({displayedAnalyticsTxns.length})
                    </h3>
                    <p className="text-[10.5px] text-slate-500">
                      {selectedCollectorPhone === 'all' 
                        ? 'Showing all collectors cash transactions' 
                        : `Filtered by: ${officersList.find(o => o.phone.replace(/\D/g, '').slice(-10) === selectedCollectorPhone)?.name || 'Selected Officer'}`}
                    </p>
                  </div>

                  {/* Filter controls */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isFullManager && (
                      <select
                        value={selectedCollectorPhone}
                        onChange={(e) => setSelectedCollectorPhone(e.target.value)}
                        className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All Collectors ({officersList.length})</option>
                        {officersList.map(o => (
                          <option key={o.phone} value={o.phone.replace(/\D/g, '').slice(-10)}>
                            {o.name} ({o.role})
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setAnalyticsDateRange('all')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          analyticsDateRange === 'all' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsDateRange('today')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          analyticsDateRange === 'today' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsDateRange('this_month')}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                          analyticsDateRange === 'this_month' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                        }`}
                      >
                        Month
                      </button>
                    </div>
                  </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={analyticsSearchQuery}
                    onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                    placeholder="Search by Donor Name, Token ID, Bial, or Approver..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Receipts Table */}
                {displayedAnalyticsTxns.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs">
                    Transaction record a awm lo.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Token & Date</th>
                          <th className="py-2.5 px-3">Petu Hming (Donor)</th>
                          <th className="py-2.5 px-3">Bial / Head</th>
                          <th className="py-2.5 px-3 text-right">Cash Amount</th>
                          <th className="py-2.5 px-3">Verified / Cleared By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                        {displayedAnalyticsTxns.slice(0, 50).map((tx) => (
                          <tr key={tx.id} className="hover:bg-slate-50/80 transition">
                            <td className="py-2.5 px-3">
                              <span className="font-mono text-[11px] font-bold text-slate-900 block truncate max-w-[130px]">
                                {tx.id}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {formatDateTimeDDMMYYYY(tx.timestamp || tx.createdAt || '')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-slate-900 block">
                                {tx.donorName || 'Anonymous'}
                              </span>
                              {tx.donorPhone && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {tx.donorPhone}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="block text-slate-700">
                                {tx.donorVeng || '-'}
                              </span>
                              {tx.subCategory && (
                                <span className="text-[10px] text-indigo-600 font-bold">
                                  {tx.subCategory}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-black text-emerald-700 text-xs">
                                ₹{Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                              <span className="block text-[9px] font-bold text-emerald-600">
                                Verified
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-indigo-900 text-[11px] block">
                                {tx.approved_by || tx.approvedBy || tx.verifiedBy || tx.collectorName || 'Authorized Officer'}
                              </span>
                              {tx.verifiedAt && (
                                <span className="text-[9.5px] text-slate-400">
                                  {formatDateDDMMYYYY(tx.verifiedAt)}
                                </span>
                              )}
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

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            RonPay Authorized Roles & Collector System • Dynamic Multi-layer Clearance
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition cursor-pointer"
          >
            Khár Rawh (Close)
          </button>
        </div>

        {/* Auditor Portal Modal for Creator/Auditor inspection */}
        <AuditorPortalModal
          isOpen={isAuditorPortalOpen}
          campaign={campaign}
          creatorProfile={creatorProfile}
          onClose={() => setIsAuditorPortalOpen(false)}
          onRecordsUpdated={() => {
            setAuditorTick(t => t + 1);
            if (onCampaignUpdated && campaign) onCampaignUpdated(campaign);
          }}
        />

        {/* Auditor Permanent Delete Confirmation Modal */}
        {confirmDeleteGrant && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 border border-rose-200 shadow-2xl space-y-4 text-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1.5">
                <h4 className="text-sm font-black text-slate-900">Auditor Ruatna Paih Hlen I Chiang Em?</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-rose-700 font-bold">{confirmDeleteGrant.auditorName || 'Auditor'}</strong> (+91 {confirmDeleteGrant.auditorPhone}) ruatna record hi <strong>database leh browser zawng zawng atangin paih hlen (Permanent Delete)</strong> a ni ang a, Auditor hian he Bawm audit na hi a lut thei tawh lovang.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteGrant(null)}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Sut leh rawh
                </button>
                <button
                  type="button"
                  onClick={() => handlePermanentlyDeleteGrant(confirmDeleteGrant)}
                  className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Paih Hlen Rawh</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
