import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Layers, 
  CheckCircle2, 
  Building2, 
  ArrowRight, 
  UserCheck, 
  Search, 
  Check, 
  Plus, 
  Sparkles, 
  ExternalLink, 
  Trash2, 
  ShieldCheck, 
  BookOpen, 
  TrendingUp, 
  FileText,
  AlertCircle,
  HelpCircle,
  Clock,
  Compass
} from 'lucide-react';
import { Campaign, CreatorProfile, UserGroupMembership } from '../types';
import { 
  getUserGroupMemberships, 
  getActiveCampaignContext, 
  setActiveCampaignContext, 
  requestToJoinCampaign, 
  removeUserFromCampaign,
  sanitizePhone,
  requestCreatorRoleInCampaign
} from '../services/groupMembershipService';
import { formatDateDDMMYYYY } from '../utils/date';
import { isCampaignCreator } from '../utils/storage';

interface MyMembershipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorProfile: CreatorProfile;
  campaigns: Campaign[];
  onSelectCampaignContext?: (campaign: Campaign) => void;
  onOpenMemberRoll?: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports' | 'expenses', campaignId?: string) => void;
  onOpenReports?: () => void;
}

export const MyMembershipsModal: React.FC<MyMembershipsModalProps> = ({
  isOpen,
  onClose,
  creatorProfile,
  campaigns,
  onSelectCampaignContext,
  onOpenMemberRoll,
  onOpenReports
}) => {
  const userPhone = sanitizePhone(creatorProfile?.phone) || '9862300000';
  const [memberships, setMemberships] = useState<UserGroupMembership[]>(() => getUserGroupMemberships(userPhone));
  const [activeContextId, setActiveContextId] = useState<string>(() => getActiveCampaignContext(userPhone) || campaigns[0]?.id || 'cmp-kumtluang-1');
  
  // Tab state: 'my_groups' | 'browse_new'
  const [activeTab, setActiveTab] = useState<'my_groups' | 'browse_new'>('my_groups');
  const [browseSearch, setBrowseSearch] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Refresh memberships on open or updates
  const reloadMemberships = () => {
    const fresh = getUserGroupMemberships(userPhone);
    setMemberships(fresh);
    const active = getActiveCampaignContext(userPhone);
    if (active) setActiveContextId(active);
  };

  useEffect(() => {
    if (isOpen) {
      reloadMemberships();
    }
  }, [isOpen, userPhone]);

  useEffect(() => {
    const handleUpdate = () => {
      reloadMemberships();
    };
    window.addEventListener('ronpay_group_memberships_updated', handleUpdate);
    window.addEventListener('ronpay_active_campaign_context_changed', handleUpdate);
    return () => {
      window.removeEventListener('ronpay_group_memberships_updated', handleUpdate);
      window.removeEventListener('ronpay_active_campaign_context_changed', handleUpdate);
    };
  }, [userPhone]);

  // Strictly Kumtluang campaigns have Member Roll and group memberships!
  const kumtluangCampaigns = useMemo(() => {
    return (campaigns || []).filter(c => c.category === 'kumtluang');
  }, [campaigns]);

  // Kumtluang memberships of the current user
  const kumtluangMemberships = useMemo(() => {
    return (memberships || []).filter(m => m.category === 'kumtluang');
  }, [memberships]);

  const isPrivilegedAdmin = Boolean(
    creatorProfile?.isAdmin ||
    creatorProfile?.role === 'SUPER_ADMIN' ||
    creatorProfile?.role === 'ADMIN' ||
    creatorProfile?.role === 'MODERATOR'
  );

  // Check if active user is an authorized Creator or Admin for any Kumtluang campaign
  const isUserCreatorOrAdmin = useMemo(() => {
    if (isPrivilegedAdmin) return true;
    const ownsAnyKumtluang = kumtluangCampaigns.some(c => isCampaignCreator(c, creatorProfile));
    const hasActiveCreatorRole = kumtluangMemberships.some(m => m.role === 'Creator' && m.status === 'active');
    return ownsAnyKumtluang || hasActiveCreatorRole;
  }, [isPrivilegedAdmin, creatorProfile, kumtluangCampaigns, kumtluangMemberships]);

  if (!isOpen) return null;

  // Active Campaign Object (prefer Kumtluang)
  const activeCampaignObj = kumtluangCampaigns.find(c => c.id === activeContextId) || kumtluangCampaigns[0] || campaigns[0];

  // Campaign IDs the user is currently member of
  const joinedCampaignIds = new Set(kumtluangMemberships.map(m => m.campaignId));

  // Available Kumtluang campaigns to browse and join
  const availableToJoin = kumtluangCampaigns.filter(c => !joinedCampaignIds.has(c.id));

  // Filtered available Kumtluang campaigns
  const filteredBrowseCampaigns = availableToJoin.filter(c => {
    if (browseSearch.trim()) {
      const q = browseSearch.toLowerCase().trim();
      return (
        c.title.toLowerCase().includes(q) ||
        (c.orgName && c.orgName.toLowerCase().includes(q)) ||
        (c.location && c.location.toLowerCase().includes(q)) ||
        (c.cause && c.cause.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Switch Active Campaign Context
  const handleSwitchContext = (campaignId: string) => {
    setActiveCampaignContext(campaignId, userPhone);
    setActiveContextId(campaignId);
    const targetCamp = campaigns.find(c => c.id === campaignId);
    if (targetCamp && onSelectCampaignContext) {
      onSelectCampaignContext(targetCamp);
    }
    setFeedbackToast(`Active Bawm context hi "${targetCamp?.title || campaignId}" ah thlak a ni ta!`);
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Join a new campaign (Pending Creator / Admin approval)
  const handleJoinCampaign = (campaign: Campaign) => {
    try {
      requestToJoinCampaign(
        {
          phone: userPhone,
          name: creatorProfile.name || 'Member User',
          email: creatorProfile.email
        },
        campaign.id,
        campaign.section || 'General'
      );
      setFeedbackToast(`🎉 "${campaign.title}" zawmna request thawn a ni ta! Creator emaw Admin in an approve hnuah member i ni ang.`);
      reloadMemberships();
      setTimeout(() => setFeedbackToast(null), 4500);
    } catch (e: any) {
      alert(e.message || 'Could not join group');
    }
  };

  // Request Creator role for this specific campaign
  const handleRequestCreatorRole = (mem: UserGroupMembership) => {
    if (confirm(`"${mem.campaignTitle}"-ah hian Creator nihna dil i duh em? He Bawm Creator lo ni tawh sa emaw Admin in emaw an approve hnu ah chiah Creator nihna i nei thei chauh ang.`)) {
      try {
        requestCreatorRoleInCampaign(userPhone, mem.campaignId);
        setFeedbackToast(`👑 "${mem.campaignTitle}"-ah Creator nihna dilna thawn fel a ni ta! Creator / Admin in an approve hnuah Creator nihna i nei ang.`);
        reloadMemberships();
        setTimeout(() => setFeedbackToast(null), 4500);
      } catch (e: any) {
        alert(e.message || 'Could not request creator role');
      }
    }
  };

  // Leave a campaign
  const handleLeaveCampaign = (campaignId: string, campaignTitle: string) => {
    if (confirm(`"${campaignTitle}" hi chhuahsan i duh tak zet em?`)) {
      removeUserFromCampaign(userPhone, campaignId, creatorProfile.name || 'User');
      setFeedbackToast(`"${campaignTitle}" chhuahsan fel a ni.`);
      reloadMemberships();
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto flex flex-col">
        
        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition cursor-pointer p-1.5 rounded-xl hover:bg-slate-100"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/30">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                My Memberships (Ka Pawl & Bawmte)
              </h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200">
                {memberships.length} Joined
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {creatorProfile.name || 'Member'} • 📞 {userPhone}
            </p>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedbackToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Active Campaign Context Banner - Only shown to authorized Creators and Admins */}
        {isUserCreatorOrAdmin && activeCampaignObj && (
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 sm:p-4 rounded-2xl border border-indigo-800 shadow-md space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Active Campaign Context (Hman Lai Mek)</span>
              </div>
              <span className="text-[9.5px] bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded-md border border-indigo-400/30 uppercase font-mono">
                {activeCampaignObj.category}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-0.5">
              <div className="min-w-0">
                <h4 className="text-sm sm:text-base font-black text-white truncate">
                  {activeCampaignObj.title}
                </h4>
                <p className="text-[11px] text-slate-300 truncate">
                  {activeCampaignObj.orgName || 'Mizoram'} • {activeCampaignObj.section || 'All Sections'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenMemberRoll && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenMemberRoll('members_list', activeCampaignObj.id);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[11px] rounded-xl border border-indigo-400/40 transition flex items-center gap-1 cursor-pointer"
                    title="View Member Roll"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Member Roll</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5">
              💡 Member record, quick payments, leh thawhlawm luhna hi he Bawm context atang hian a kalpui ziah e.
            </p>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('my_groups')}
            className={`py-2 px-3 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'my_groups'
                ? 'bg-white text-indigo-950 font-black shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Ka Pawl / Bawmte ({kumtluangMemberships.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('browse_new')}
            className={`py-2 px-3 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'browse_new'
                ? 'bg-white text-indigo-950 font-black shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Kumtluang Pawl Zawm Rawh ({availableToJoin.length})</span>
          </button>
        </div>

        {/* TAB 1: MY JOINED GROUPS */}
        {activeTab === 'my_groups' && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1 animate-fadeIn">
            {kumtluangMemberships.length === 0 ? (
              <div className="p-6 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Kumtluang Pawl emaw Bawm zawm i la nei lo</p>
                <p className="text-[11px] text-slate-500">
                  Member Roll awmna Kohhran emaw Pawl zawm nan "Kumtluang Pawl Zawm Rawh" tab-ah khian kal rawh le.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('browse_new')}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Browse Kumtluang Groups</span>
                </button>
              </div>
            ) : (
              kumtluangMemberships.map((mem) => {
                const isPending = mem.status === 'pending_approval';
                const isCurrentActive = !isPending && mem.campaignId === activeContextId;
                const campObj = campaigns.find(c => c.id === mem.campaignId);
                const canAccessRoll = Boolean(
                  isPrivilegedAdmin ||
                  (campObj && isCampaignCreator(campObj, creatorProfile)) ||
                  (mem.role === 'Creator' && mem.status === 'active') ||
                  (mem.role === 'Officer' && mem.status === 'active') ||
                  (mem.role === 'Treasurer' && mem.status === 'active')
                );

                return (
                  <div
                    key={mem.id}
                    className={`p-3.5 rounded-2xl border transition space-y-2.5 ${
                      isPending
                        ? 'bg-amber-50/40 border-amber-300'
                        : isCurrentActive
                        ? 'bg-indigo-50/70 border-indigo-400 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h5 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {mem.campaignTitle}
                          </h5>
                          {isCurrentActive && (
                            <span className="text-[9px] bg-emerald-600 text-white font-black px-2 py-0.2 rounded-full uppercase shadow-2xs">
                              Active Context
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {mem.orgName || campObj?.orgName || 'Mizoram'} • {mem.category.toUpperCase()}
                        </p>
                      </div>

                      {isPending ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shrink-0 font-medium">
                          ⏳ Dil Mek (Pending)
                        </span>
                      ) : mem.role === 'Creator' ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 shrink-0">
                          👑 Creator
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 shrink-0 font-mono">
                          {mem.role}
                        </span>
                      )}
                    </div>

                    {/* Member Roll Info Details or Pending Notice */}
                    {isPending ? (
                      <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/90 text-[11px] text-amber-950 font-medium space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-amber-900">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Creator / Admin Approve Nghak Mek</span>
                        </div>
                        <p className="text-[10.5px] text-amber-800">
                          He Bawmah hian Member nihna i dil mek a, Creator emaw Admin in an pawm (approve) hnuah Member puitling niin Roll-ah a lang ang.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-[10.5px] bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                        {mem.memberId && (
                          <span className="text-slate-600 font-medium">
                            Roll ID: <strong className="text-slate-900 font-mono">{mem.memberId}</strong>
                          </span>
                        )}
                        {mem.section && (
                          <span className="text-slate-600 font-medium">
                            Section: <strong className="text-slate-900">{mem.section}</strong>
                          </span>
                        )}
                        <span className="text-slate-400 ml-auto text-[10px]">
                          Joined: {formatDateDDMMYYYY(mem.joinedAt)}
                        </span>
                      </div>
                    )}

                    {/* Group Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!isPending && !isCurrentActive && (
                          <button
                            type="button"
                            onClick={() => handleSwitchContext(mem.campaignId)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Switch Context</span>
                          </button>
                        )}
                        {!isPending && isCurrentActive && (
                          <span className="text-xs font-black text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Selected</span>
                          </span>
                        )}

                        {!isPending && canAccessRoll && onOpenMemberRoll && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onOpenMemberRoll('members_list', mem.campaignId);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
                            title="Open Member Roll"
                          >
                            Roll
                          </button>
                        )}

                        {/* Creator role request button if member is active and not already Creator */}
                        {!isPending && mem.role !== 'Creator' && (
                          mem.roleRequestStatus === 'pending' ? (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 flex items-center gap-1">
                              ⏳ Creator Dil Mek
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRequestCreatorRole(mem)}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-[10.5px] rounded-xl border border-purple-200 transition cursor-pointer flex items-center gap-1 shrink-0"
                              title="He Bawmah hian Creator nihna dil rawh"
                            >
                              <span>👑 Creator nihna dil</span>
                            </button>
                          )
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLeaveCampaign(mem.campaignId, mem.campaignTitle)}
                        className="text-slate-400 hover:text-rose-600 text-xs font-bold p-1 rounded-lg transition cursor-pointer"
                        title="Leave Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: BROWSE & JOIN NEW GROUPS */}
        {activeTab === 'browse_new' && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1 animate-fadeIn">
            {/* Search and Category Filter for Browsing */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={browseSearch}
                  onChange={(e) => setBrowseSearch(e.target.value)}
                  placeholder="Search available campaigns by name or organization..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-[11px] text-indigo-900 font-bold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Member Roll awmna <b>Kumtluang Bawm (Kohhran & Pawl)</b> chauh tarlan an ni e.</span>
              </div>
            </div>

            {/* List of Available Campaigns to Join */}
            {filteredBrowseCampaigns.length === 0 ? (
              <div className="p-6 text-center space-y-1.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                <Sparkles className="w-6 h-6 text-amber-500 mx-auto" />
                <p className="font-bold text-slate-700">Zawm tur Bawm dang hmuh a ni lo</p>
                <p>Bawm awm sa zawng zawng hi i zawm tawh a ni thei e!</p>
              </div>
            ) : (
              filteredBrowseCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-2xs space-y-2.5 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                          {camp.title}
                        </h5>
                        <span className="text-[9px] px-2 py-0.2 rounded-md bg-slate-100 text-slate-700 font-mono font-bold uppercase">
                          {camp.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {camp.orgName || 'Mizoram'} • {camp.location || 'All Areas'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinCampaign(camp)}
                      className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Request / Join</span>
                    </button>
                  </div>

                  {camp.cause && (
                    <p className="text-[11px] text-slate-600 line-clamp-2">
                      {camp.cause}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
};
