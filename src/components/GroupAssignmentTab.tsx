import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Layers, 
  UserCheck, 
  Search, 
  Plus, 
  Check, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Tag, 
  ShieldCheck, 
  Code2, 
  Smartphone, 
  Building2, 
  ChevronDown, 
  ArrowRight, 
  RefreshCw,
  Sparkles,
  UserPlus,
  Trash2,
  ExternalLink,
  Shield,
  HelpCircle
} from 'lucide-react';
import { Campaign, UserGroupMembership, BawmCategory, CreatorProfile } from '../types';
import { 
  getAllManagedUserAccounts, 
  assignUserToCampaigns, 
  bulkAssignUsersToCampaign, 
  removeUserFromCampaign, 
  ManagedUserAccount,
  getStoredGroupMemberships,
  sanitizePhone,
  approveMembershipRequest,
  rejectMembershipRequest,
  approveCreatorRoleRequest,
  rejectCreatorRoleRequest
} from '../services/groupMembershipService';
import { getStoredCreatorsList, saveStoredCreatorsList } from '../utils/storage';
import { BAWM_CONFIG } from '../data/initialData';

interface GroupAssignmentTabProps {
  campaigns: Campaign[];
  onOpenCreateQR?: () => void;
  onRefreshData?: () => void;
}

export const GroupAssignmentTab: React.FC<GroupAssignmentTabProps> = ({
  campaigns,
  onOpenCreateQR,
  onRefreshData
}) => {
  const [users, setUsers] = useState<ManagedUserAccount[]>(() => getAllManagedUserAccounts());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'unassigned' | 'developer' | 'tester' | 'creator' | 'staff' | 'user'>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  
  // Strictly Kumtluang campaigns have Member Roll and group memberships!
  const kumtluangCampaigns = useMemo(() => {
    return campaigns.filter(c => c.category === 'kumtluang');
  }, [campaigns]);

  // Multi-select for bulk actions
  const [selectedUserPhones, setSelectedUserPhones] = useState<string[]>([]);
  const [bulkTargetCampaignId, setBulkTargetCampaignId] = useState<string>(() => {
    const firstKumtluang = campaigns.find(c => c.category === 'kumtluang');
    return firstKumtluang?.id || 'cmp-kumtluang-1';
  });
  const [bulkRole, setBulkRole] = useState<string>('Member');
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string | null>(null);

  // Single user assignment modal / drawer state
  const [editingUser, setEditingUser] = useState<ManagedUserAccount | null>(null);
  const [selectedCampaignIdsForUser, setSelectedCampaignIdsForUser] = useState<string[]>([]);
  const [userRoleInGroups, setUserRoleInGroups] = useState<string>('Member');
  const [userSection, setUserSection] = useState<string>('');

  // Quick New Test / Dev Account Drawer
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserType, setNewUserType] = useState<'developer' | 'tester' | 'user'>('tester');
  const [newUserCampaignIds, setNewUserCampaignIds] = useState<string[]>([]);
  const [newUserRole, setNewUserRole] = useState('Tester');
  const [formError, setFormError] = useState('');

  const reloadData = () => {
    const fresh = getAllManagedUserAccounts();
    setUsers(fresh);
    if (onRefreshData) onRefreshData();
  };

  useEffect(() => {
    const handleUpdate = () => {
      setUsers(getAllManagedUserAccounts());
    };
    window.addEventListener('ronpay_group_memberships_updated', handleUpdate);
    return () => {
      window.removeEventListener('ronpay_group_memberships_updated', handleUpdate);
    };
  }, []);

  // Filtered accounts list
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(u => 
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        u.memberships.some(m => m.campaignTitle.toLowerCase().includes(q) || (m.role && m.role.toLowerCase().includes(q)))
      );
    }

    // Type filter
    if (typeFilter === 'unassigned') {
      result = result.filter(u => !u.isAssigned || u.assignedCampaignIds.length === 0);
    } else if (typeFilter !== 'all') {
      result = result.filter(u => u.accountType === typeFilter);
    }

    // Campaign filter
    if (campaignFilter !== 'all') {
      result = result.filter(u => u.assignedCampaignIds.includes(campaignFilter));
    }

    return result;
  }, [users, searchQuery, typeFilter, campaignFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const unassigned = users.filter(u => !u.isAssigned || u.assignedCampaignIds.length === 0).length;
    const developers = users.filter(u => u.accountType === 'developer').length;
    const testers = users.filter(u => u.accountType === 'tester').length;
    const totalMemberships = users.reduce((acc, u) => acc + u.assignedCampaignIds.length, 0);
    return { total, unassigned, developers, testers, totalMemberships };
  }, [users]);

  // Multi-select helpers
  const handleToggleSelectUser = (phone: string) => {
    setSelectedUserPhones(prev => 
      prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]
    );
  };

  const handleSelectAllVisible = () => {
    if (selectedUserPhones.length === filteredUsers.length && filteredUsers.length > 0) {
      setSelectedUserPhones([]);
    } else {
      setSelectedUserPhones(filteredUsers.map(u => u.phone));
    }
  };

  // Execute Bulk Assignment
  const handleRunBulkAssignment = () => {
    if (selectedUserPhones.length === 0) return;
    try {
      const res = bulkAssignUsersToCampaign(
        selectedUserPhones,
        bulkTargetCampaignId,
        bulkRole,
        undefined,
        'Admin Dashboard'
      );
      setBulkSuccessMsg(res.message);
      setSelectedUserPhones([]);
      reloadData();
      setTimeout(() => setBulkSuccessMsg(null), 3500);
    } catch (e: any) {
      alert(e.message || 'Bulk assignment failed');
    }
  };

  // Open Edit Single User Modal
  const handleOpenAssignModal = (user: ManagedUserAccount) => {
    setEditingUser(user);
    setSelectedCampaignIdsForUser([...user.assignedCampaignIds]);
    const firstRole = user.memberships[0]?.role || (user.accountType === 'developer' ? 'Developer' : user.accountType === 'tester' ? 'Tester' : 'Member');
    setUserRoleInGroups(firstRole);
    setUserSection(user.memberships[0]?.section || '');
  };

  // Save Single User Assignment
  const handleSaveUserAssignment = () => {
    if (!editingUser) return;
    try {
      assignUserToCampaigns(
        {
          phone: editingUser.phone,
          name: editingUser.name,
          email: editingUser.email,
          accountType: editingUser.accountType
        },
        selectedCampaignIdsForUser,
        userRoleInGroups,
        userSection,
        'Admin Console'
      );
      setBulkSuccessMsg(`${editingUser.name} hnenah groups/campaigns ${selectedCampaignIdsForUser.length} hlawhtling taka pek fel a ni!`);
      setEditingUser(null);
      reloadData();
      setTimeout(() => setBulkSuccessMsg(null), 3000);
    } catch (e: any) {
      alert(e.message || 'Error updating assignments');
    }
  };

  // Quick Remove single campaign from user
  const handleRemoveCampaign = (userPhone: string, campaignId: string) => {
    removeUserFromCampaign(userPhone, campaignId, 'Admin Console');
    reloadData();
  };

  // Promote Member / User to Creator
  const handlePromoteToCreator = (user: ManagedUserAccount) => {
    try {
      const creators = getStoredCreatorsList();
      const existing = creators.find(c => sanitizePhone(c.phone) === sanitizePhone(user.phone));
      const targetOrg = user.memberships[0]?.orgName || user.designation || 'YMA Vengthar Branch';
      
      const updatedCreator: CreatorProfile = {
        ...(existing || {}),
        phone: user.phone,
        name: user.name,
        email: user.email || existing?.email,
        role: 'CREATOR',
        accountType: 'creator',
        orgName: targetOrg,
        designation: user.designation || 'Branch Creator / Manager',
        isApproved: true,
        approvedCategories: ['ralna', 'khawlsak', 'kumtluang'],
        registeredAt: existing?.registeredAt || new Date().toISOString()
      };

      const updatedList = creators.filter(c => sanitizePhone(c.phone) !== sanitizePhone(user.phone));
      updatedList.push(updatedCreator);
      saveStoredCreatorsList(updatedList);

      setBulkSuccessMsg(`🎉 "${user.name}" (${user.phone}) Creator-ah hlawhtling takin upgrade a ni ta!`);
      reloadData();
      setTimeout(() => setBulkSuccessMsg(null), 4500);
    } catch (e: any) {
      alert(e.message || 'Could not upgrade account');
    }
  };

  // Create New Account
  const handleCreateNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const cleanP = sanitizePhone(newUserPhone);
    if (!cleanP || cleanP.length !== 10) {
      setFormError('Phone number 10 digits a ni tur a ni.');
      return;
    }
    if (!newUserName.trim()) {
      setFormError('Hming chhu lut rawh.');
      return;
    }

    try {
      assignUserToCampaigns(
        {
          phone: cleanP,
          name: newUserName.trim(),
          email: newUserEmail.trim() || undefined,
          accountType: newUserType
        },
        newUserCampaignIds,
        newUserRole,
        undefined,
        'Admin Console'
      );

      setBulkSuccessMsg(`Account thar "${newUserName}" hlawhtling taka siam a ni e!`);
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserPhone('');
      setNewUserEmail('');
      setNewUserCampaignIds([]);
      reloadData();
      setTimeout(() => setBulkSuccessMsg(null), 3500);
    } catch (err: any) {
      setFormError(err.message || 'Account siam theih a ni lo.');
    }
  };

  const pendingRequests = useMemo(() => {
    return getStoredGroupMemberships().filter(m => m.status === 'pending_approval' || m.roleRequestStatus === 'pending');
  }, [users]);

  return (
    <div className="space-y-4 animate-fadeIn text-slate-900">
      
      {/* 1. Header Banner & Quick Summary */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-4 sm:p-5 rounded-2xl border border-indigo-800/60 shadow-lg text-white space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                <Layers className="w-4 h-4 text-indigo-400" />
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                Kumtluang Member Group Assignment & Many-to-Many Desk
              </h3>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Member Roll awmna <b>Kumtluang bawm</b> (Kohhran, YMA, leh Pawl lian) bikah chiah Member nih theih a nih avangin, tester leh developer-te heta tang hian Kumtluang pawlah awlsam takin assign rawh le.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddUserModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Tester / Dev Account</span>
          </button>
        </div>

        {/* Pending Member Join & Creator Requests Card */}
        {pendingRequests.length > 0 && (
          <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 p-4 rounded-2xl border-2 border-amber-500/50 text-white space-y-3 shadow-lg animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <h4 className="text-sm font-black text-amber-200 uppercase tracking-wide">
                  Pending Join & Creator Role Requests ({pendingRequests.length})
                </h4>
              </div>
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30">
                Creator / Admin Approval Required
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {pendingRequests.map(req => {
                const isCreatorReq = req.roleRequestStatus === 'pending';

                return (
                  <div key={req.id} className="bg-slate-900/90 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-white text-xs">
                          {isCreatorReq ? '👑 ' : ''}{req.userName}
                        </span>
                        <span className="text-slate-400 font-mono">({req.userPhone})</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase ${
                          isCreatorReq ? 'bg-purple-900/80 text-purple-200 border border-purple-500/40' : 'bg-amber-900/80 text-amber-200 border border-amber-500/40'
                        }`}>
                          {isCreatorReq ? 'Creator Role Request' : 'Member Join Request'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-300 font-bold mt-0.5">
                        Group: {req.campaignTitle} {req.section ? `(${req.section})` : ''} • Current Role: {req.role || 'Member'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCreatorReq ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              approveCreatorRoleRequest(req.id, 'Super Admin');
                              setBulkSuccessMsg(`👑 ${req.userName} hnenah Creator nihna hlawhtling taka pek a ni e!`);
                              reloadData();
                              setTimeout(() => setBulkSuccessMsg(null), 3500);
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve Creator
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              rejectCreatorRoleRequest(req.id, 'Super Admin');
                              setBulkSuccessMsg(`${req.userName} Creator dilna hnawl a ni a, Member pangai a dah a ni.`);
                              reloadData();
                              setTimeout(() => setBulkSuccessMsg(null), 3500);
                            }}
                            className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              approveMembershipRequest(req.id, 'Creator / Admin');
                              setBulkSuccessMsg(`✅ ${req.userName} member request hlawhtling takin approved a ni e!`);
                              reloadData();
                              setTimeout(() => setBulkSuccessMsg(null), 3500);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve Member
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              rejectMembershipRequest(req.id, 'Creator / Admin');
                              reloadData();
                            }}
                            className="px-2.5 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4 Key Stat Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80">
          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Accounts</span>
            <span className="text-lg font-black text-white">{stats.total}</span>
          </div>

          <div className="bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/30 text-center">
            <span className="text-[10px] font-bold text-amber-300 uppercase block">Unassigned</span>
            <span className="text-lg font-black text-amber-400">{stats.unassigned}</span>
          </div>

          <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-center">
            <span className="text-[10px] font-bold text-sky-400 uppercase block">Devs & Testers</span>
            <span className="text-lg font-black text-sky-300">{stats.developers + stats.testers}</span>
          </div>

          <div className="bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/30 text-center">
            <span className="text-[10px] font-bold text-emerald-300 uppercase block">Total Memberships</span>
            <span className="text-lg font-black text-emerald-400">{stats.totalMemberships}</span>
          </div>
        </div>
      </div>

      {/* Success Notification Alert */}
      {bulkSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{bulkSuccessMsg}</span>
        </div>
      )}

      {/* 2. Filter & Search Controls */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user name, phone, designation, or group..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-600"
            >
              <option value="all">All Accounts ({users.length})</option>
              <option value="unassigned">⚠️ Unassigned Only ({stats.unassigned})</option>
              <option value="developer">Developers ({stats.developers})</option>
              <option value="tester">Testers ({stats.testers})</option>
              <option value="creator">Creators</option>
              <option value="staff">Staff Officers</option>
              <option value="user">Community Users</option>
            </select>

            {/* Campaign filter - Kumtluang only */}
            <select
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:border-indigo-600 max-w-[180px] truncate"
            >
              <option value="all">All Kumtluang Groups ({kumtluangCampaigns.length})</option>
              {kumtluangCampaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. Bulk Action Toolbar (Active when 1 or more accounts are checked) */}
        {selectedUserPhones.length > 0 && (
          <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                {selectedUserPhones.length}
              </span>
              <span className="text-xs font-black text-indigo-950">
                Account(s) selected for bulk group assignment
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkTargetCampaignId}
                onChange={(e) => setBulkTargetCampaignId(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-800"
              >
                {kumtluangCampaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    Assign to: {c.title}
                  </option>
                ))}
              </select>

              <select
                value={bulkRole}
                onChange={(e) => setBulkRole(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="Member">Role: Member</option>
                <option value="Tester">Role: Tester</option>
                <option value="Developer">Role: Developer</option>
                <option value="Collector">Role: Collector</option>
                <option value="Officer">Role: Officer</option>
                <option value="Treasurer">Role: Treasurer</option>
              </select>

              <button
                type="button"
                onClick={handleRunBulkAssignment}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Assign {selectedUserPhones.length} User(s)</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedUserPhones([])}
                className="px-2 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Accounts List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-black text-slate-600 uppercase tracking-wider">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedUserPhones.length > 0 && selectedUserPhones.length === filteredUsers.length}
              onChange={handleSelectAllVisible}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
              title="Select / Deselect All Visible"
            />
            <span>User Account ({filteredUsers.length})</span>
          </div>
          <span>Assigned Campaigns / Ledgers</span>
          <span className="hidden sm:inline">Actions</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Account hmuh a ni lo</p>
            <p className="text-xs text-slate-400">Search criteria emaw filter thlak la han zawng nawn rawh.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredUsers.map((user) => {
              const isSelected = selectedUserPhones.includes(user.phone);
              const isUnassigned = !user.isAssigned || user.assignedCampaignIds.length === 0;

              // Badge styling for account type
              const typeBadge = {
                developer: 'bg-sky-50 text-sky-700 border-sky-200',
                tester: 'bg-purple-50 text-purple-700 border-purple-200',
                staff: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                creator: 'bg-amber-50 text-amber-700 border-amber-200',
                user: 'bg-slate-100 text-slate-700 border-slate-200'
              }[user.accountType] || 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div 
                  key={user.id} 
                  className={`p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                    isSelected ? 'bg-indigo-50/50' : isUnassigned ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* User Profile Column */}
                  <div className="flex items-start gap-3 min-w-0 md:w-1/3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectUser(user.phone)}
                      className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer shrink-0"
                    />

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {user.name}
                        </span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full border ${typeBadge}`}>
                          {user.accountType}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        📞 {user.phone} {user.email && `• ${user.email}`}
                      </p>
                      {user.designation && (
                        <p className="text-[10px] text-slate-400 truncate">
                          {user.designation}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Assigned Campaigns / Groups Column */}
                  <div className="flex-1 min-w-0">
                    {isUnassigned ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>A la zawm lo (Unassigned Account)</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {user.memberships.map((mem) => {
                          return (
                            <span
                              key={mem.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 text-[10.5px] font-bold transition group"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                              <span className="truncate max-w-[140px] sm:max-w-[200px]" title={mem.campaignTitle}>
                                {mem.campaignTitle}
                              </span>
                              <span className="text-[9px] font-mono px-1 rounded bg-white text-indigo-700 border border-slate-200">
                                {mem.role}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCampaign(user.phone, mem.campaignId)}
                                className="text-slate-400 hover:text-rose-600 transition p-0.5"
                                title="Remove from this campaign"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Action Column */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    {user.accountType !== 'creator' && user.role !== 'CREATOR' ? (
                      <button
                        type="button"
                        onClick={() => handlePromoteToCreator(user)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                        title="Make he member / user he Creator-ah upgrade rawh"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Make Creator</span>
                      </button>
                    ) : (
                      <span className="px-2 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span>Creator</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenAssignModal(user)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>{isUnassigned ? 'Assign Group' : 'Manage Groups'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Modal / Drawer for Single User Group Assignment */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-base font-black text-slate-900">
                  Assign Groups / Campaigns
                </h4>
                <p className="text-xs text-slate-500">
                  User: <strong className="text-indigo-600">{editingUser.name}</strong> ({editingUser.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Role & Section Settings */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Role in Group(s):</label>
                <select
                  value={userRoleInGroups}
                  onChange={(e) => setUserRoleInGroups(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800"
                >
                  <option value="Member">Member</option>
                  <option value="Tester">Tester</option>
                  <option value="Developer">Developer</option>
                  <option value="Collector">Collector</option>
                  <option value="Officer">Officer</option>
                  <option value="Treasurer">Treasurer</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Section (Optional):</label>
                <input
                  type="text"
                  value={userSection}
                  onChange={(e) => setUserSection(e.target.value)}
                  placeholder="e.g. Bial 1 / Section A"
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800"
                />
              </div>
            </div>

            {/* Campaign Multi-Select Checkboxes - Kumtluang Groups only */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 flex items-center justify-between">
                <span>Select Kumtluang Groups to Assign (Member Roll):</span>
                <span className="text-[11px] text-indigo-600 font-bold">
                  {selectedCampaignIdsForUser.length} Selected
                </span>
              </label>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
                {kumtluangCampaigns.map((camp) => {
                  const isChecked = selectedCampaignIdsForUser.includes(camp.id);
                  return (
                    <label
                      key={camp.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isChecked 
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold' 
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/80 font-medium'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedCampaignIdsForUser(prev => 
                            prev.includes(camp.id) 
                              ? prev.filter(id => id !== camp.id) 
                              : [...prev, camp.id]
                          );
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{camp.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {camp.orgName || 'Kumtluang Group'} • ID: {camp.id}
                        </p>
                      </div>
                      <span className="text-[9.5px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-bold uppercase shrink-0">
                        Kumtluang
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUserAssignment}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Group Assignments</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal / Drawer for Quick Creating New Test Account */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
          <form onSubmit={handleCreateNewAccount} className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200">
                  <UserPlus className="w-4 h-4" />
                </span>
                <h4 className="text-base font-black text-slate-900">
                  Add Tester / Developer Account
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">User Full Name *</label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Malsawmdawngliana (Tester)"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">10-Digit Phone *</label>
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="986200XXXX"
                    maxLength={10}
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Account Type</label>
                  <select
                    value={newUserType}
                    onChange={(e) => setNewUserType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="tester">Mobile App Tester</option>
                    <option value="developer">Developer</option>
                    <option value="user">Regular User</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="tester@ronpay.app"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              {/* Initial Kumtluang Campaign Multi-Select */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Assign Initial Kumtluang Group (Optional):
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2 bg-slate-50">
                  {kumtluangCampaigns.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUserCampaignIds.includes(c.id)}
                        onChange={() => {
                          setNewUserCampaignIds(prev => 
                            prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          );
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="truncate">{c.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddUserModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Create & Assign</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
