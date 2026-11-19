import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  ChevronDown,
  X,
  Check,
  FolderKanban,
  ShieldCheck,
  Clock,
  AlertCircle,
  MapPin,
  Layers
} from 'lucide-react';
import { Campaign } from '../types';
import {
  getStoredAuditorGrants,
  getStoredTransactions,
  getStoredExpenses,
  getCampaignAuditStatusSummary
} from '../utils/storage';

export type BawmAuditStatusFilter = 'all' | 'audited' | 'auditing' | 'discrepancy' | 'unaudited';
export type BawmCategoryFilter = 'all' | 'kumtluang' | 'ralna' | 'khawlsak' | 'rikrum';

interface SearchableBawmPickerProps {
  campaigns: Campaign[];
  selectedCampaignId: string;
  onSelect: (campaignId: string, campaign?: Campaign) => void;
  /** 'dark' for AuditorPortal header, 'light' for ReportsScreen / forms */
  theme?: 'dark' | 'light';
  /** Allow an "All Campaigns" option (e.g. ReportsScreen) */
  allowAllOption?: boolean;
  allOptionLabel?: string;
  /** Show Audit Status filter chips inside the picker */
  showAuditStatusFilter?: boolean;
  /** Show Category filter chips inside the picker */
  showCategoryFilter?: boolean;
  /** Optional custom placeholder when no campaign is selected */
  placeholder?: string;
  /** Optional className for trigger button */
  className?: string;
}

const CATEGORY_LABELS: Record<string, { label: string; badgeClass: string }> = {
  kumtluang: { label: 'Kumtluang', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  ralna: { label: 'Ralna', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  khawlsak: { label: 'Khawlsak', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rikrum: { label: 'Rikrum', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
};

const PAGE_SIZE = 40;

export const SearchableBawmPicker: React.FC<SearchableBawmPickerProps> = ({
  campaigns,
  selectedCampaignId,
  onSelect,
  theme = 'light',
  allowAllOption = false,
  allOptionLabel,
  showAuditStatusFilter = true,
  showCategoryFilter = true,
  placeholder = 'Bawm thlang rawh...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<BawmCategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<BawmAuditStatusFilter>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(PAGE_SIZE);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setVisibleLimit(PAGE_SIZE);
    const t = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 30);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [query, categoryFilter, statusFilter]);

  const selectedCampaign = useMemo(() => {
    if (!selectedCampaignId || selectedCampaignId === 'all') return null;
    return campaigns.find(c => c.id === selectedCampaignId) || null;
  }, [campaigns, selectedCampaignId]);

  // Classify each campaign once via Single Source of Truth (fast O(N) lookup for 500+ campaigns)
  const enrichedCampaigns = useMemo(() => {
    if (!isOpen) return [];
    const nowMs = Date.now();
    const allTxs = getStoredTransactions();
    const allExps = getStoredExpenses();
    const allGrants = getStoredAuditorGrants();

    return campaigns.map(c => {
      const summary = getCampaignAuditStatusSummary(c, {
        transactions: allTxs,
        expenses: allExps,
        grants: allGrants,
        nowMs
      });

      let auditStatus: Exclude<BawmAuditStatusFilter, 'all'> = 'unaudited';
      let priority = 4;
      if (summary.statusKey === 'discrepancy' || summary.statusKey === 'pending_reapproval') {
        auditStatus = 'discrepancy';
        priority = 1;
      } else if (summary.statusKey === 'auditing') {
        auditStatus = 'auditing';
        priority = 2;
      } else if (summary.statusKey === 'sealed') {
        auditStatus = 'audited';
        priority = 3;
      }

      const searchHaystack = [
        c.title,
        c.orgName,
        c.orgCode,
        c.location,
        c.subTitle,
        c.category,
        c.createdBy,
        c.contactPhone,
        summary.periodDisplay,
        c.id
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        campaign: c,
        auditStatus,
        priority,
        searchHaystack,
        lastAuditPeriod: summary.periodDisplay,
        statusShortLabel:
          summary.statusKey === 'auditing' && summary.activeAuditors.length === 0 && (summary.signOffCount > 0 || summary.verifiedTxCount + summary.verifiedExpCount > 0)
            ? `Partial (${summary.verifiedTxCount + summary.verifiedExpCount})`
            : summary.statusKey === 'auditing'
            ? 'Auditing'
            : summary.statusKey === 'sealed'
            ? 'Audited'
            : summary.statusKey === 'discrepancy' || summary.statusKey === 'pending_reapproval'
            ? 'Alert'
            : ''
      };
    });
  }, [isOpen, campaigns]);

  const statusCounts = useMemo(() => {
    const counts = { all: enrichedCampaigns.length, audited: 0, auditing: 0, discrepancy: 0, unaudited: 0 };
    enrichedCampaigns.forEach(item => {
      counts[item.auditStatus] += 1;
    });
    return counts;
  }, [enrichedCampaigns]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    return enrichedCampaigns
      .filter(item => {
        if (categoryFilter !== 'all' && String(item.campaign.category || '').toLowerCase() !== categoryFilter) {
          return false;
        }
        if (statusFilter !== 'all' && item.auditStatus !== statusFilter) {
          return false;
        }
        if (tokens.length > 0) {
          return tokens.every(tok => item.searchHaystack.includes(tok));
        }
        return true;
      })
      .sort((a, b) => {
        // Keep currently selected campaign at the very top when not searching
        if (!q) {
          if (a.campaign.id === selectedCampaignId) return -1;
          if (b.campaign.id === selectedCampaignId) return 1;
        }
        if (a.priority !== b.priority) return a.priority - b.priority;
        return String(a.campaign.title || '').localeCompare(String(b.campaign.title || ''));
      });
  }, [enrichedCampaigns, query, categoryFilter, statusFilter, selectedCampaignId]);

  const visibleItems = useMemo(() => {
    return filteredList.slice(0, visibleLimit);
  }, [filteredList, visibleLimit]);

  const handleChoose = (campId: string, camp?: Campaign) => {
    onSelect(campId, camp);
    setIsOpen(false);
  };

  const triggerLabel =
    allowAllOption && selectedCampaignId === 'all'
      ? allOptionLabel || `All Campaigns (${campaigns.length})`
      : selectedCampaign
      ? `${selectedCampaign.title} (${String(selectedCampaign.category || '').toUpperCase()})`
      : placeholder;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          theme === 'dark'
            ? `flex items-center justify-between gap-2 bg-white/10 hover:bg-white/15 border border-white/20 rounded-xl px-2.5 py-1 text-left transition cursor-pointer max-w-[270px] sm:max-w-[340px] ${className}`
            : `w-full flex items-center justify-between gap-2 bg-slate-50 hover:bg-white border border-slate-300 hover:border-indigo-400 rounded-xl px-3 py-2.5 text-left transition cursor-pointer ${className}`
        }
        title="Bawm zawnna leh thlanna (Searchable)"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderKanban
            className={`w-3.5 h-3.5 shrink-0 ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}
          />
          <span
            className={`truncate font-bold ${
              theme === 'dark' ? 'text-[11px] sm:text-xs text-white' : 'text-xs text-slate-900'
            }`}
          >
            {triggerLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {campaigns.length > 1 && (
            <span
              className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                theme === 'dark'
                  ? 'bg-indigo-500/30 text-indigo-100 border border-indigo-400/30'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {campaigns.length}
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-indigo-200' : 'text-slate-500'}`} />
        </div>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-[2px] flex items-start sm:items-center justify-center p-2.5 sm:p-4 animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[86vh] mt-6 sm:mt-0"
            onClick={e => e.stopPropagation()}
          >
            {/* Header + Instant Search Input */}
            <div className="p-3 sm:p-3.5 border-b border-slate-200 bg-slate-50/90 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FolderKanban className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-black text-xs sm:text-sm text-slate-900 truncate">
                    Bawm Zawnna &amp; Thlanna
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0 tabular-nums">
                    {filteredList.length} / {campaigns.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  aria-label="Close Bawm Picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Bawm hming, Org Code, Veng/Khua, emaw Phone chhu lut rawh..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Compact Filter Chips */}
              {(showAuditStatusFilter || showCategoryFilter) && (
                <div className="space-y-1.5">
                  {showAuditStatusFilter && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                      {(
                        [
                          { id: 'all', label: `All (${statusCounts.all})` },
                          { id: 'audited', label: `✓ Audited (${statusCounts.audited})` },
                          { id: 'auditing', label: `⏳ Auditing (${statusCounts.auditing})` },
                          ...(statusCounts.discrepancy > 0
                            ? [{ id: 'discrepancy' as const, label: `⚠️ Alert (${statusCounts.discrepancy})` }]
                            : []),
                          { id: 'unaudited', label: `La Audit Lo (${statusCounts.unaudited})` },
                        ] as Array<{ id: BawmAuditStatusFilter; label: string }>
                      ).map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setStatusFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border whitespace-nowrap transition cursor-pointer ${
                            statusFilter === tab.id
                              ? tab.id === 'audited'
                                ? 'bg-emerald-700 text-white border-emerald-700'
                                : tab.id === 'discrepancy'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {showCategoryFilter && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                      {(
                        [
                          { id: 'all', label: 'All Categories' },
                          { id: 'kumtluang', label: 'Kumtluang' },
                          { id: 'ralna', label: 'Ralna' },
                          { id: 'khawlsak', label: 'Khawlsak' },
                          { id: 'rikrum', label: 'Rikrum' },
                        ] as Array<{ id: BawmCategoryFilter; label: string }>
                      ).map(cat => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategoryFilter(cat.id)}
                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border whitespace-nowrap transition cursor-pointer ${
                            categoryFilter === cat.id
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Scrollable Results List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1.5 sm:p-2 space-y-1">
              {allowAllOption && !query.trim() && statusFilter === 'all' && categoryFilter === 'all' && (
                <button
                  type="button"
                  onClick={() => handleChoose('all')}
                  className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-left transition cursor-pointer ${
                    selectedCampaignId === 'all'
                      ? 'bg-indigo-50 border border-indigo-300'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate">
                        {allOptionLabel || `All My Campaigns (${campaigns.length})`}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        He category chhunga Bawm zawng zawng enkhawmna
                      </div>
                    </div>
                  </div>
                  {selectedCampaignId === 'all' && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </button>
              )}

              {visibleItems.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-1.5">
                  <div className="text-xs font-black text-slate-700">I zawn mil Bawm a awm lo</div>
                  <p className="text-[11px] text-slate-500">
                    Hming, Org Code, emaw Filter dang thlak chhin rawh le.
                  </p>
                  {(query || statusFilter !== 'all' || categoryFilter !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setStatusFilter('all');
                        setCategoryFilter('all');
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                    >
                      Filter Reset Rawh
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {visibleItems.map(({ campaign: c, auditStatus, lastAuditPeriod, statusShortLabel }) => {
                    const isSelected = c.id === selectedCampaignId;
                    const catMeta = CATEGORY_LABELS[String(c.category || '').toLowerCase()] || {
                      label: String(c.category || 'Bawm').toUpperCase(),
                      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
                    };

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleChoose(c.id, c)}
                        className={`w-full px-3 py-2 rounded-xl flex items-center justify-between gap-2.5 text-left transition cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold text-xs text-slate-900 truncate max-w-[230px] sm:max-w-[300px]">
                              {c.title}
                            </span>
                            <span className={`text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded border ${catMeta.badgeClass}`}>
                              {catMeta.label}
                            </span>
                            {c.orgCode && (
                              <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {c.orgCode}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium truncate">
                            {c.location && (
                              <span className="inline-flex items-center gap-0.5 truncate">
                                <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                {c.location}
                              </span>
                            )}
                            {lastAuditPeriod && (
                              <span className="text-emerald-700 font-bold truncate">
                                • {lastAuditPeriod}
                              </span>
                            )}
                            {!c.location && !lastAuditPeriod && c.subTitle && (
                              <span className="truncate">{c.subTitle}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {auditStatus === 'discrepancy' && (
                            <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> {statusShortLabel || 'Alert'}
                            </span>
                          )}
                          {auditStatus === 'auditing' && (
                            <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {statusShortLabel || 'Auditing'}
                            </span>
                          )}
                          {auditStatus === 'audited' && (
                            <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <ShieldCheck className="w-2.5 h-2.5" /> Audited
                            </span>
                          )}
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}

                  {filteredList.length > visibleLimit && (
                    <div className="pt-2 pb-1 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleLimit(v => v + PAGE_SIZE)}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold transition cursor-pointer"
                      >
                        + En Belh Rawh ({filteredList.length - visibleLimit} la awm)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
