import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BawmFilterBar } from './components/BawmFilterBar';
import { BawmActiveBanner } from './components/BawmActiveBanner';
import { MemberRollTable } from './components/MemberRollTable';
import { MemberModal } from './components/MemberModal';
import { CreateBawmModal } from './components/CreateBawmModal';
import { QrStandeeModal } from './components/QrStandeeModal';
import { ReceiptModal } from './components/ReceiptModal';
import { MemberRollModal } from './components/MemberRollModal';
import { INITIAL_BAWMS, INITIAL_MEMBERS } from './data/mockData';
import { BawmItem, MemberRollItem, FilterOptions, PaymentStatus } from './types';
import { exportMembersToCSV, triggerConfetti } from './utils/formatters';

const STORAGE_BAWMS_KEY = 'mizo_qr_bawm_list_v1';
const STORAGE_MEMBERS_KEY = 'mizo_qr_members_list_v1';

export default function App() {
  // Load persisted state or initial seed data
  const [bawms, setBawms] = useState<BawmItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BAWMS_KEY);
      return saved ? JSON.parse(saved) : INITIAL_BAWMS;
    } catch {
      return INITIAL_BAWMS;
    }
  });

  const [members, setMembers] = useState<MemberRollItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_MEMBERS_KEY);
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  // Filters State
  const [filters, setFilters] = useState<FilterOptions>({
    selectedBawmId: 'all', // 'all' for consolidated view or specific Bawm ID
    searchQuery: '',
    status: 'all',
    section: 'all',
    sortBy: 'id',
    sortOrder: 'asc'
  });

  // Modals state
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isCreateBawmModalOpen, setIsCreateBawmModalOpen] = useState(false);
  const [isStandeeModalOpen, setIsStandeeModalOpen] = useState(false);
  const [isMemberRollModalOpen, setIsMemberRollModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const [editingMember, setEditingMember] = useState<MemberRollItem | null>(null);
  const [receiptMember, setReceiptMember] = useState<MemberRollItem | null>(null);
  const [standeeBawmId, setStandeeBawmId] = useState<string | undefined>(undefined);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_BAWMS_KEY, JSON.stringify(bawms));
  }, [bawms]);

  useEffect(() => {
    localStorage.setItem(STORAGE_MEMBERS_KEY, JSON.stringify(members));
  }, [members]);

  const selectedBawm = bawms.find(b => b.id === filters.selectedBawmId);
  const bawmMap = new Map<string, BawmItem>(bawms.map(b => [b.id, b]));

  // Dynamically compute available sections based strictly on the selected Bawm
  const availableSections = filters.selectedBawmId === 'all'
    ? Array.from(new Set(bawms.flatMap(b => b.sections)))
    : (selectedBawm?.sections || []);

  // Strict Dynamic Member List Filtering
  const filteredMembers = members.filter((member) => {
    // 1. Strict Bawm Isolation Check:
    // If a specific QR/Bawm is selected (e.g. BCM Ebenezer), ONLY members of that Bawm are permitted
    if (filters.selectedBawmId !== 'all' && member.bawmId !== filters.selectedBawmId) {
      return false;
    }

    // 2. Section isolation
    if (filters.section !== 'all' && member.section !== filters.section) {
      return false;
    }

    // 3. Status filter
    if (filters.status !== 'all' && member.status !== filters.status) {
      return false;
    }

    // 4. Search query
    if (filters.searchQuery.trim() !== '') {
      const q = filters.searchQuery.toLowerCase();
      const mBawm = bawmMap.get(member.bawmId);
      const matchId = member.memberId.toLowerCase().includes(q);
      const matchName = member.name.toLowerCase().includes(q);
      const matchSection = member.section.toLowerCase().includes(q);
      const matchPhone = (member.phone || '').toLowerCase().includes(q);
      const matchRef = (member.transactionRef || '').toLowerCase().includes(q);
      const matchBawm = (mBawm?.name || '').toLowerCase().includes(q);
      return matchId || matchName || matchSection || matchPhone || matchRef || matchBawm;
    }

    return true;
  });

  // Filter change helper
  const handleFilterChange = (newFilters: Partial<FilterOptions>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      selectedBawmId: 'all',
      searchQuery: '',
      status: 'all',
      section: 'all',
      sortBy: 'id',
      sortOrder: 'asc'
    });
  };

  // Member CRUD Handlers
  const handleSaveMember = (
    memberData: Omit<MemberRollItem, 'id' | 'updatedAt'>,
    editId?: string
  ) => {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (editId) {
      setMembers(prev =>
        prev.map(m =>
          m.id === editId ? { ...m, ...memberData, updatedAt: timestamp } : m
        )
      );
    } else {
      const newMember: MemberRollItem = {
        ...memberData,
        id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        updatedAt: timestamp
      };
      setMembers(prev => [newMember, ...prev]);
    }
  };

  const handleDeleteMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const handleToggleStatus = (member: MemberRollItem, newStatus: PaymentStatus) => {
    const today = new Date().toISOString().slice(0, 10);
    setMembers(prev =>
      prev.map(m => {
        if (m.id === member.id) {
          const updatedPaidAmount =
            newStatus === 'paid'
              ? m.pledgeAmount
              : newStatus === 'partial'
              ? Math.floor(m.pledgeAmount / 2)
              : 0;

          return {
            ...m,
            status: newStatus,
            paidAmount: updatedPaidAmount,
            paymentDate: newStatus !== 'pending' ? (m.paymentDate || today) : undefined,
            paymentMethod: newStatus !== 'pending' ? (m.paymentMethod || 'UPI QR') : undefined,
            updatedAt: today
          };
        }
        return m;
      })
    );
  };

  // Bawm Creation Handler
  const handleCreateBawm = (newBawmData: Omit<BawmItem, 'id' | 'createdAt'>) => {
    const slug = newBawmData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const newBawm: BawmItem = {
      ...newBawmData,
      id: `bawm-${slug}-${Date.now().toString().slice(-4)}`,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    setBawms(prev => [newBawm, ...prev]);
    // Automatically select the new Bawm in filter
    setFilters(prev => ({ ...prev, selectedBawmId: newBawm.id, section: 'all' }));
    triggerConfetti();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const bawmTitle = filters.selectedBawmId === 'all'
      ? 'All_Lists_Consolidated'
      : (selectedBawm?.name || 'Bawm');
    const enriched = filteredMembers.map(m => ({
      ...m,
      bawmName: bawmMap.get(m.bawmId)?.name || 'Unknown'
    }));
    exportMembersToCSV(enriched, bawmTitle);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased">
      {/* Top Navigation */}
      <Navbar
        bawms={bawms}
        members={members}
        onOpenCreateBawm={() => setIsCreateBawmModalOpen(true)}
        onOpenAddMember={() => {
          setEditingMember(null);
          setIsMemberModalOpen(true);
        }}
        onOpenStandee={() => {
          setStandeeBawmId(filters.selectedBawmId !== 'all' ? filters.selectedBawmId : undefined);
          setIsStandeeModalOpen(true);
        }}
        onOpenModalView={() => setIsMemberRollModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Active Bawm Context Banner */}
        <BawmActiveBanner
          selectedBawm={selectedBawm}
          allBawms={bawms}
          members={members}
          onOpenStandee={(bId) => {
            setStandeeBawmId(bId || filters.selectedBawmId);
            setIsStandeeModalOpen(true);
          }}
          onOpenAddMember={(bId) => {
            setEditingMember(null);
            setIsMemberModalOpen(true);
          }}
        />

        {/* Filter Bar with prominent "Select Active QR / Bawm" Dropdown */}
        <BawmFilterBar
          bawms={bawms}
          filters={filters}
          onFilterChange={handleFilterChange}
          availableSections={availableSections}
          totalResultsCount={filteredMembers.length}
          onResetFilters={handleResetFilters}
          onExportCSV={handleExportCSV}
        />

        {/* Dynamic Filtered Member Roll Table (Strictly isolated) */}
        <MemberRollTable
          members={filteredMembers}
          bawms={bawms}
          selectedBawmId={filters.selectedBawmId}
          onEditMember={(member) => {
            setEditingMember(member);
            setIsMemberModalOpen(true);
          }}
          onDeleteMember={handleDeleteMember}
          onToggleStatus={handleToggleStatus}
          onOpenReceipt={(member) => {
            setReceiptMember(member);
            setIsReceiptModalOpen(true);
          }}
          onAddNewMember={() => {
            setEditingMember(null);
            setIsMemberModalOpen(true);
          }}
        />
      </main>

      {/* Modals */}
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        editMember={editingMember}
        bawms={bawms}
        defaultBawmId={filters.selectedBawmId !== 'all' ? filters.selectedBawmId : undefined}
      />

      <CreateBawmModal
        isOpen={isCreateBawmModalOpen}
        onClose={() => setIsCreateBawmModalOpen(false)}
        onCreateBawm={handleCreateBawm}
      />

      <QrStandeeModal
        isOpen={isStandeeModalOpen}
        onClose={() => setIsStandeeModalOpen(false)}
        bawms={bawms}
        defaultBawmId={standeeBawmId || (filters.selectedBawmId !== 'all' ? filters.selectedBawmId : undefined)}
      />

      <ReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptMember(null);
        }}
        member={receiptMember}
        bawm={receiptMember ? (bawmMap.get(receiptMember.bawmId) || null) : null}
      />

      <MemberRollModal
        isOpen={isMemberRollModalOpen}
        onClose={() => setIsMemberRollModalOpen(false)}
        bawms={bawms}
        members={members}
        onAddNewMember={(bId) => {
          setIsMemberRollModalOpen(false);
          setEditingMember(null);
          setIsMemberModalOpen(true);
        }}
        onOpenReceipt={(member) => {
          setReceiptMember(member);
          setIsReceiptModalOpen(true);
        }}
        onToggleStatus={handleToggleStatus}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>QR Bawm & Member Roll Management System</strong> • Mizoram Kohhran & Tlawmngai Pawl Thawhlawm
          </div>
          <div className="text-slate-400">
            Strict QR & Section Isolation Enabled
          </div>
        </div>
      </footer>
    </div>
  );
}
