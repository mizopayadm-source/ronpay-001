import React, { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { FIREBASE_CONFIG, formatToE164Phone } from '../lib/firebaseAuth';
import { Campaign, CreatorProfile } from '../types';
import {
  isCampaignCreator,
  isCampaignManagerOrOfficer,
  derivePrefixFromText,
  getStoredTransactions,
  getStoredExpenses,
  getMembers,
  isTransactionForCampaign
} from '../utils/storage';
import {
  Building2,
  ChevronRight,
  ShieldCheck,
  User,
  Loader2,
  X,
  Lock,
  TrendingUp,
  Target,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Download,
  Users,
  FileSpreadsheet,
  CreditCard
} from 'lucide-react';

export interface WorkspaceOrganization {
  id: string;
  orgName: string;
  orgCode: string;
  location?: string;
  category?: string;
  assigned_admins?: string[];
  campaign?: Campaign;
}

export interface WorkspaceRouterModalProps {
  isOpen: boolean;
  onClose: () => void;
  userPhone: string;
  creatorProfile: CreatorProfile;
  campaigns: Campaign[];
  onSelectOrganization: (
    org: WorkspaceOrganization,
    initialTab?: 'members_list' | 'quick_entry' | 'register_member' | 'print_reports' | 'expenses'
  ) => void;
  onSelectNormalMode: () => void;
}

interface UnifiedLedgerRow {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  sectionOrHead: string;
  mode: string;
  type: 'received' | 'paid';
  amount: number;
}

export const WorkspaceRouterModal: React.FC<WorkspaceRouterModalProps> = ({
  isOpen,
  onClose,
  userPhone,
  creatorProfile,
  campaigns,
  onSelectOrganization,
  onSelectNormalMode,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [matchedOrgs, setMatchedOrgs] = useState<WorkspaceOrganization[]>([]);
  const [routingCase, setRoutingCase] = useState<'LOADING' | 'CASE_A' | 'CASE_B' | 'CASE_C'>('LOADING');
  const [selectedOrg, setSelectedOrg] = useState<WorkspaceOrganization | null>(null);

  // Dashboard interactive filter states
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'received' | 'paid'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartRange, setChartRange] = useState<'6m' | '12m'>('6m');

  const formattedE164 = formatToE164Phone(userPhone || creatorProfile?.phone || '');
  const clean10Digits = (userPhone || creatorProfile?.phone || '').replace(/\D/g, '').slice(-10);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const buildLocalWorkspaceMap = (): Map<string, WorkspaceOrganization> => {
      const foundMap = new Map<string, WorkspaceOrganization>();
      const seenCodes = new Set<string>();

      const activeCampaigns = (campaigns || []).filter(c => {
        if (!c || !c.id || !c.title) return false;
        if (c.status === 'expired' || c.status === 'rejected' || c.status === 'inactive') return false;
        const hasAssignedAdmins = Array.isArray((c as any).assigned_admins) && (c as any).assigned_admins.length > 0;
        return c.category === 'kumtluang' || hasAssignedAdmins;
      });

      for (const camp of activeCampaigns) {
        const isCreator = isCampaignCreator(camp, creatorProfile);
        const isOfficer = isCampaignManagerOrOfficer(camp, creatorProfile);
        const assignedAdmins: string[] = Array.isArray((camp as any).assigned_admins)
          ? (camp as any).assigned_admins
          : [];
        const inAssignedArray = assignedAdmins.some(
          p => p.replace(/\D/g, '').slice(-10) === clean10Digits && clean10Digits.length === 10
        );

        if (isCreator || isOfficer || inAssignedArray) {
          const codeKey = (camp.orgCode || derivePrefixFromText(camp.orgName || camp.title)).toUpperCase().trim();
          if (!foundMap.has(camp.id) && !seenCodes.has(codeKey)) {
            seenCodes.add(codeKey);
            foundMap.set(camp.id, {
              id: camp.id,
              orgName: camp.orgName || camp.title,
              orgCode: codeKey,
              location: camp.location || 'Mizoram',
              category: camp.category,
              assigned_admins: assignedAdmins,
              campaign: camp,
            });
          }
        }
      }
      return foundMap;
    };

    const applyRoutingDecision = (results: WorkspaceOrganization[]) => {
      if (!isMounted) return;
      setMatchedOrgs(results);
      setIsLoading(false);

      if (results.length === 0) {
        setRoutingCase('CASE_A');
        return;
      }
      if (results.length === 1) {
        setSelectedOrg(results[0]);
        setRoutingCase('CASE_B');
        sessionStorage.setItem('ronpay_isolated_org_id', results[0].id);
        return;
      }
      // Check if an isolated org was already chosen in this session
      const savedOrgId = sessionStorage.getItem('ronpay_isolated_org_id');
      const preselected = savedOrgId ? results.find(r => r.id === savedOrgId) : null;
      if (preselected && results.length === 1) {
        setSelectedOrg(preselected);
        setRoutingCase('CASE_B');
        return;
      }
      setRoutingCase('CASE_C');
    };

    // 1. Instantaneous synchronous resolution from RONPAY campaigns & admin assignments (0ms delay)
    const initialMap = buildLocalWorkspaceMap();
    const initialResults = Array.from(initialMap.values());
    applyRoutingDecision(initialResults);

    // 2. Non-blocking background check against Firebase Firestore `organizations` collection (with 400ms fast timeout)
    const syncFirestoreOrgs = async () => {
      try {
        const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApp();
        const db = getFirestore(app);
        const orgsRef = collection(db, 'organizations');
        const phonesToQuery = Array.from(new Set([formattedE164, clean10Digits].filter(Boolean)));

        const fetchFirestorePromise = (async () => {
          let added = false;
          for (const phoneVal of phonesToQuery) {
            const q = query(orgsRef, where('assigned_admins', 'array-contains', phoneVal));
            const snap = await getDocs(q);
            snap.forEach((docSnap) => {
              const data = docSnap.data();
              if (!initialMap.has(docSnap.id)) {
                added = true;
                initialMap.set(docSnap.id, {
                  id: docSnap.id,
                  orgName: data.orgName || data.name || data.title || 'Organization',
                  orgCode: data.orgCode || data.code || derivePrefixFromText(data.orgName || data.name || 'ORG'),
                  location: data.location || 'Mizoram',
                  category: data.category || 'kumtluang',
                  assigned_admins: Array.isArray(data.assigned_admins) ? data.assigned_admins : [],
                });
              }
            });
          }
          return added;
        })();

        const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 400));
        const hasNewFirestoreOrgs = await Promise.race([fetchFirestorePromise, timeoutPromise]);

        if (hasNewFirestoreOrgs && isMounted) {
          applyRoutingDecision(Array.from(initialMap.values()));
        }
      } catch {
        // Ignore offline/unconfigured Firestore errors silently
      }
    };

    syncFirestoreOrgs();

    return () => {
      isMounted = false;
    };
  }, [isOpen, formattedE164, clean10Digits, campaigns, creatorProfile]);

  // Compute live financial statistics, chart series, and unified ledger for selectedOrg
  const orgAnalytics = useMemo(() => {
    if (!selectedOrg) return null;

    const targetCamp =
      selectedOrg.campaign ||
      campaigns.find(c => c.id === selectedOrg.id) ||
      ({
        id: selectedOrg.id,
        title: selectedOrg.orgName,
        orgName: selectedOrg.orgName,
        orgCode: selectedOrg.orgCode,
        category: 'kumtluang',
      } as Campaign);

    const allTxs = getStoredTransactions();
    const orgTxs = allTxs.filter(
      t =>
        t &&
        t.status !== 'failed' &&
        (t.campaignId === selectedOrg.id || isTransactionForCampaign(t, targetCamp))
    );

    const allExpenses = getStoredExpenses();
    const orgExpenses = allExpenses.filter(
      e =>
        e &&
        String(e.campaignId || '').toLowerCase().trim() === String(selectedOrg.id).toLowerCase().trim() &&
        e.status !== 'rejected'
    );

    const orgMembers = getMembers(selectedOrg.id);
    const openingBalance = Number(targetCamp.openingBalance || 0);
    const txCollections = orgTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const totalCollections = openingBalance + txCollections;
    const totalPaidExpenses = orgExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const netBalance = totalCollections - totalPaidExpenses;

    // Target calculation (dynamic goal based on campaign target or active members)
    const configuredTarget = Number((targetCamp as any).targetAmount || 0);
    const activeTarget =
      configuredTarget > 0
        ? configuredTarget
        : Math.max(50000, orgMembers.length * 2500, Math.ceil((totalCollections * 1.25) / 10000) * 10000);
    const progressPercent = Math.min(100, Math.round((totalCollections / Math.max(1, activeTarget)) * 100));

    // Donut Chart Breakdown (by Section / Bial or Sub-Category)
    const breakdownMap = new Map<string, number>();
    if (orgTxs.length > 0) {
      for (const tx of orgTxs) {
        const label =
          tx.donorVeng ||
          (tx as any).section ||
          tx.groupName ||
          (tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown)[0]) ||
          'General Fund';
        breakdownMap.set(label, (breakdownMap.get(label) || 0) + (Number(tx.amount) || 0));
      }
    } else if (targetCamp.definedSections && targetCamp.definedSections.length > 0) {
      targetCamp.definedSections.slice(0, 4).forEach((sec, idx) => {
        breakdownMap.set(sec, (4 - idx) * 2500);
      });
    } else {
      breakdownMap.set('Member Thawhlawm', 65);
      breakdownMap.set('Inkhawm / General', 25);
      breakdownMap.set('Special Target', 10);
    }

    const donutColors = ['#4f46e5', '#0d9488', '#f59e0b', '#e11d48', '#6366f1'];
    const rawBreakdown = Array.from(breakdownMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const breakdownTotal = Math.max(1, rawBreakdown.reduce((acc, [, v]) => acc + v, 0));
    const donutSlices = rawBreakdown.map(([label, value], i) => ({
      label,
      value,
      percent: Math.round((value / breakdownTotal) * 100),
      color: donutColors[i % donutColors.length],
    }));

    // Monthly Revenue Bar/Line Data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyReceived = new Array(12).fill(0);
    const monthlyPaid = new Array(12).fill(0);

    for (const tx of orgTxs) {
      const d = new Date(tx.timestamp || tx.createdAt || Date.now());
      if (!isNaN(d.getTime())) {
        monthlyReceived[d.getMonth()] += Number(tx.amount) || 0;
      }
    }
    for (const ex of orgExpenses) {
      const d = new Date(ex.date || ex.createdAt || Date.now());
      if (!isNaN(d.getTime())) {
        monthlyPaid[d.getMonth()] += Number(ex.amount) || 0;
      }
    }

    const currentMonthIdx = new Date().getMonth();
    const monthsSeries = monthNames.map((m, idx) => ({
      month: m,
      received: monthlyReceived[idx],
      paid: monthlyPaid[idx],
    }));

    const visibleMonths =
      chartRange === '6m'
        ? monthsSeries.slice(Math.max(0, currentMonthIdx - 5), currentMonthIdx + 1)
        : monthsSeries;

    // Unified Ledger (Received + Paid)
    const ledgerRows: UnifiedLedgerRow[] = [
      ...orgTxs.map(tx => ({
        id: tx.id,
        date: tx.timestamp || tx.createdAt || new Date().toISOString(),
        title: tx.donorName || 'Member Contribution',
        subtitle: tx.memberId || tx.utr || tx.id,
        sectionOrHead:
          tx.donorVeng ||
          (tx as any).section ||
          tx.groupName ||
          (tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).join(', ')) ||
          'Kumtluang Bawm',
        mode: (tx.paymentMethod || 'UPI').toUpperCase(),
        type: 'received' as const,
        amount: Number(tx.amount) || 0,
      })),
      ...orgExpenses.map(ex => ({
        id: ex.id,
        date: ex.date || ex.createdAt || new Date().toISOString(),
        title: (ex as any).payee || (ex as any).paidTo || (ex as any).purpose || ex.description || 'Organization Expense',
        subtitle: ex.voucherNo || ex.id,
        sectionOrHead: ex.head || ex.description || 'Operational Expense',
        mode: ex.paymentMode || 'Cash',
        type: 'paid' as const,
        amount: Number(ex.amount) || 0,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      targetCamp,
      totalCollections,
      txCount: orgTxs.length,
      activeTarget,
      progressPercent,
      totalPaidExpenses,
      expenseCount: orgExpenses.length,
      netBalance,
      memberCount: orgMembers.length,
      donutSlices,
      visibleMonths,
      ledgerRows,
    };
  }, [selectedOrg, campaigns, chartRange]);

  const filteredLedgerRows = useMemo(() => {
    if (!orgAnalytics) return [];
    return orgAnalytics.ledgerRows.filter(row => {
      if (ledgerFilter !== 'all' && row.type !== ledgerFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          row.title.toLowerCase().includes(q) ||
          row.subtitle.toLowerCase().includes(q) ||
          row.sectionOrHead.toLowerCase().includes(q) ||
          row.mode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orgAnalytics, ledgerFilter, searchQuery]);

  const handleExportCSV = () => {
    if (!selectedOrg || !orgAnalytics) return;
    const headers = ['Date', 'Reference', 'Member / Payee', 'Bial / Category', 'Mode', 'Status', 'Amount (INR)'];
    const rows = filteredLedgerRows.map(r => [
      new Date(r.date).toLocaleDateString('en-IN'),
      `"${r.subtitle.replace(/"/g, '""')}"`,
      `"${r.title.replace(/"/g, '""')}"`,
      `"${r.sectionOrHead.replace(/"/g, '""')}"`,
      r.mode,
      r.type === 'received' ? 'Received' : 'Paid',
      r.type === 'received' ? r.amount : -r.amount,
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedOrg.orgCode}_Financial_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      id="ronpay-workspace-modal"
      className="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
    >
      {/* 1. LOADING STATE */}
      {isLoading && (
        <div
          id="workspace-loading"
          className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-sm w-full text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Verifying Workspace Access</h3>
            <p className="text-xs text-slate-500 mt-1">
              Checking assigned organizations for <span className="font-mono font-semibold text-slate-700">{formattedE164}</span>
            </p>
          </div>
        </div>
      )}

      {/* 2. CASE C: WORKSPACE SELECTOR UI (Multiple Organizations Found) */}
      {!isLoading && routingCase === 'CASE_C' && (
        <div
          id="workspace-selector"
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
        >
          <div className="bg-slate-900 px-6 py-6 text-white relative border-b border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <p className="text-xs font-medium text-indigo-300 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Workspace Isolation · Verified Admin</span>
            </p>
            <h2 className="text-xl font-bold tracking-tight">Select Your Organization</h2>
            <p className="text-xs text-slate-300 mt-1">
              Phone <span className="font-mono text-white font-semibold">{formattedE164}</span> is assigned to{' '}
              <span className="text-amber-300 font-semibold">{matchedOrgs.length} workspaces</span>. Choose one to open its dedicated dashboard:
            </p>
          </div>

          <div className="p-6 space-y-3 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500">
              Assigned Organizations ({matchedOrgs.length})
            </p>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {matchedOrgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem('ronpay_isolated_org_id', org.id);
                    setSelectedOrg(org);
                    setRoutingCase('CASE_B');
                  }}
                  className="w-full text-left p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-600 hover:shadow-sm transition-all flex items-center justify-between gap-3 group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-sm flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                      {org.orgName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate group-hover:text-indigo-950">
                        {org.orgName}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        {org.location || 'Mizoram'} · <span className="font-mono font-semibold text-indigo-600">{org.orgCode}</span>
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              ))}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('ronpay_isolated_org_id');
                  onSelectNormalMode();
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Continue to Standard Donor View</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CASE B: RESPONSIVE ORGANIZATION DASHBOARD WITH STATISTICS & REPORTS */}
      {!isLoading && routingCase === 'CASE_B' && selectedOrg && orgAnalytics && (
        <div
          id="org-dashboard"
          className="bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        >
          {/* Top Organization Workspace Bar */}
          <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                {selectedOrg.orgName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                    <Lock className="w-3 h-3" /> Isolated Workspace
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-indigo-600">{selectedOrg.orgCode}</span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{selectedOrg.location || 'Mizoram'}</span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {selectedOrg.orgName}
                </h1>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2 shrink-0">
              {matchedOrgs.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRoutingCase('CASE_C')}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer whitespace-nowrap"
                >
                  Switch Workspace ({matchedOrgs.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelectOrganization(selectedOrg, 'quick_entry');
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-semibold text-indigo-700 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Quick Entry</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelectOrganization(selectedOrg, 'members_list');
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Member Roll ({orgAnalytics.memberCount})</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Close Dashboard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Main Scrollable Dashboard Body */}
          <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
            {/* TOP SECTION: 4 RESPONSIVE STATISTIC CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Collections */}
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Collections (Lut)</span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    ₹{orgAnalytics.totalCollections.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    {orgAnalytics.txCount} verified inflows · Opening ₹{(orgAnalytics.targetCamp.openingBalance || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Card 2: Active Target & Progress */}
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Active Target & Roll</span>
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                      {orgAnalytics.progressPercent}%
                    </p>
                    <span className="text-xs text-slate-500 font-mono tabular-nums">
                      of ₹{orgAnalytics.activeTarget.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${orgAnalytics.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Total Paid / Expenses */}
              <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Paid (Hmanral)</span>
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    ₹{orgAnalytics.totalPaidExpenses.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    {orgAnalytics.expenseCount} expense vouchers recorded
                  </p>
                </div>
              </div>

              {/* Card 4: Net Treasury Balance */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-200">Net Treasury Balance</span>
                  <div className="w-9 h-9 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center">
                    <Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-white font-mono tabular-nums">
                    ₹{orgAnalytics.netBalance.toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-indigo-200 mt-1 truncate font-mono">
                    {orgAnalytics.memberCount} Members · {orgAnalytics.targetCamp.upiId || 'ronpay@upi'}
                  </p>
                </div>
              </div>
            </div>

            {/* MIDDLE SECTION: VISUAL STATISTICS (CHARTS) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly Revenue & Expense Bar Chart (2 Columns on Desktop) */}
              <div className="lg:col-span-2 bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Monthly Revenue & Outflow</h3>
                    <p className="text-xs text-slate-500">
                      Comparison of monthly collections received vs. expenses paid
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
                    <button
                      type="button"
                      onClick={() => setChartRange('6m')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        chartRange === '6m' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Last 6 Months
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartRange('12m')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        chartRange === '12m' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Full Year
                    </button>
                  </div>
                </div>

                {/* Responsive Bar Chart Canvas */}
                {(() => {
                  const maxVal = Math.max(
                    1000,
                    ...orgAnalytics.visibleMonths.map(m => Math.max(m.received, m.paid))
                  );
                  return (
                    <div className="space-y-3">
                      <div className="h-52 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
                        {orgAnalytics.visibleMonths.map((item) => {
                          const recHeight = Math.max(6, Math.round((item.received / maxVal) * 160));
                          const paidHeight = Math.max(4, Math.round((item.paid / maxVal) * 160));
                          return (
                            <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group">
                              <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-40">
                                <div
                                  className="w-3 sm:w-5 bg-indigo-600 hover:bg-indigo-500 rounded-t-md transition-all relative"
                                  style={{ height: `${item.received > 0 ? recHeight : 6}px` }}
                                  title={`${item.month} Received: ₹${item.received.toLocaleString('en-IN')}`}
                                />
                                <div
                                  className="w-3 sm:w-5 bg-rose-400 hover:bg-rose-500 rounded-t-md transition-all relative"
                                  style={{ height: `${item.paid > 0 ? paidHeight : 4}px` }}
                                  title={`${item.month} Paid: ₹${item.paid.toLocaleString('en-IN')}`}
                                />
                              </div>
                              <span className="text-[11px] font-medium text-slate-500 font-mono">
                                {item.month}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-4">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
                            Received (Lut)
                          </span>
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <span className="w-2.5 h-2.5 rounded-xs bg-rose-400 inline-block" />
                            Paid (Hmanral)
                          </span>
                        </div>
                        <span className="font-mono tabular-nums">
                          Peak: ₹{maxVal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Collection Progress Donut Chart (1 Column on Desktop) */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Collection Progress</h3>
                  <p className="text-xs text-slate-500">
                    Distribution by Bial / Section & Fund Heads
                  </p>
                </div>

                {/* SVG Donut Chart */}
                <div className="my-4 flex items-center justify-center relative">
                  {(() => {
                    const size = 156;
                    const strokeWidth = 20;
                    const center = size / 2;
                    const radius = center - strokeWidth;
                    const circumference = 2 * Math.PI * radius;
                    let cumulativePercent = 0;

                    return (
                      <div className="relative flex items-center justify-center">
                        <svg width={size} height={size} className="-rotate-90">
                          <circle
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="transparent"
                            stroke="#f1f5f9"
                            strokeWidth={strokeWidth}
                          />
                          {orgAnalytics.donutSlices.map((slice, idx) => {
                            const strokeDasharray = `${(slice.percent / 100) * circumference} ${circumference}`;
                            const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                            cumulativePercent += slice.percent;
                            return (
                              <circle
                                key={idx}
                                cx={center}
                                cy={center}
                                r={radius}
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="butt"
                              />
                            );
                          })}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="text-xl font-bold text-slate-900 font-mono tabular-nums">
                            {orgAnalytics.progressPercent}%
                          </span>
                          <span className="text-[10px] font-medium text-slate-500">
                            Target Goal
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Donut Legend */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {orgAnalytics.donutSlices.map((slice, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: slice.color }}
                        />
                        <span className="text-slate-700 font-medium truncate">{slice.label}</span>
                      </div>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums shrink-0 ml-2">
                        {slice.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: RESPONSIVE RECORDS & REPORT TABLE */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recent Transactions & Reports</h3>
                  <p className="text-xs text-slate-500">
                    Verified organization inflows (Received) and treasury expenditures (Paid)
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Segmented Filter */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'received', label: 'Received' },
                        { id: 'paid', label: 'Paid' },
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setLedgerFilter(tab.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          ledgerFilter === tab.id
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search member, Bial, ref..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>

                  {/* Export CSV */}
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  {/* Full Statement */}
                  <button
                    type="button"
                    onClick={() => {
                      onSelectOrganization(selectedOrg, 'print_reports');
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Full Audit Report</span>
                  </button>
                </div>
              </div>

              {/* Mobile-Responsive Table Wrapper */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-3 px-4 whitespace-nowrap">Date & Reference</th>
                      <th className="py-3 px-4 whitespace-nowrap">Member / Payee</th>
                      <th className="py-3 px-4 whitespace-nowrap">Bial / Category</th>
                      <th className="py-3 px-4 whitespace-nowrap">Method</th>
                      <th className="py-3 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3 px-4 text-right whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredLedgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                          No matching records found for {selectedOrg.orgName}. Use Quick Entry to log new transactions.
                        </td>
                      </tr>
                    ) : (
                      filteredLedgerRows.slice(0, 12).map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-medium text-slate-900 block font-mono tabular-nums">
                              {new Date(row.date).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono truncate block max-w-[140px]">
                              {row.subtitle}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 block">{row.title}</span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                            {row.sectionOrHead}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                            {row.mode}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {row.type === 'received' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-semibold text-[11px]">
                                <ArrowDownLeft className="w-3 h-3" />
                                Received
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60 font-semibold text-[11px]">
                                <ArrowUpRight className="w-3 h-3" />
                                Paid
                              </span>
                            )}
                          </td>
                          <td
                            className={`py-3 px-4 text-right whitespace-nowrap font-mono font-bold tabular-nums ${
                              row.type === 'received' ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {row.type === 'received' ? '+' : '-'}₹{row.amount.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CASE A: NORMAL MODE DASHBOARD (No Admin Organizations Assigned) */}
      {!isLoading && routingCase === 'CASE_A' && (
        <div
          id="normal-dashboard"
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
        >
          <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center font-bold">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xs font-medium text-emerald-400 block">
                  Standard Donor Account
                </span>
                <h3 className="text-base font-bold">RONPAY Public Mode</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Phone number <span className="font-mono font-semibold text-slate-900">{formattedE164}</span> is not listed in any organization&apos;s <code className="font-mono text-indigo-600">assigned_admins</code> array. You are routed to the standard RONPAY Donor Dashboard.
            </p>
            <button
              type="button"
              onClick={() => {
                sessionStorage.removeItem('ronpay_isolated_org_id');
                onSelectNormalMode();
                onClose();
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition cursor-pointer"
            >
              Continue to RONPAY Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
