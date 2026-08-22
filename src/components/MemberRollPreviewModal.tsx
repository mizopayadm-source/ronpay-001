import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Copy, 
  Search, 
  Filter, 
  Check, 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  Layers, 
  Calendar,
  Eye,
  CheckCircle2,
  ChevronDown,
  User,
  ShieldCheck,
  Award
} from 'lucide-react';
import { MemberRecord, Transaction, Campaign, CreatorProfile } from '../types';
import { formatDateDDMMYYYY } from '../utils/date';
import { printHtmlSafely } from '../utils/export';

export type PreviewReportFormat = 'style1_master' | 'style4_audit' | 'style2_matrix' | 'style3_passbook';

interface MemberRollPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  members: MemberRecord[];
  transactions: Transaction[];
  creatorProfile: CreatorProfile;
  initialFormat?: PreviewReportFormat;
  initialCampaignId?: string;
  initialMemberId?: string;
}

export const MemberRollPreviewModal: React.FC<MemberRollPreviewModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  members,
  transactions,
  creatorProfile,
  initialFormat = 'style1_master',
  initialCampaignId = 'all',
  initialMemberId = '',
}) => {
  const [selectedFormat, setSelectedFormat] = useState<PreviewReportFormat>(initialFormat);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(initialCampaignId);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(initialMemberId);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all');
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<'fit' | '100' | '90' | '80'>('100');

  // Month abbreviations
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Sync initial props when opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialFormat) setSelectedFormat(initialFormat);
      if (initialCampaignId) setSelectedCampaignId(initialCampaignId);
      if (initialMemberId) setSelectedMemberId(initialMemberId);
    }
  }, [isOpen, initialFormat, initialCampaignId, initialMemberId]);

  // Scoped campaign
  const activeCampaign = useMemo(() => {
    if (selectedCampaignId === 'all') return undefined;
    return campaigns.find(c => c.id === selectedCampaignId);
  }, [selectedCampaignId, campaigns]);

  // Scoped members
  const scopedMembers = useMemo(() => {
    if (selectedCampaignId === 'all') return members;
    return members.filter(m => m.campaignId === selectedCampaignId || (activeCampaign?.orgCode && m.orgCode === activeCampaign.orgCode));
  }, [members, selectedCampaignId, activeCampaign]);

  // Scoped transactions
  const scopedTransactions = useMemo(() => {
    if (selectedCampaignId === 'all') return transactions;
    return transactions.filter(t => t.campaignId === selectedCampaignId || (activeCampaign?.title && t.campaignTitle === activeCampaign.title));
  }, [transactions, selectedCampaignId, activeCampaign]);

  // Unique sections for filtering
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    scopedMembers.forEach(m => {
      if (m.section && m.section.trim()) {
        set.add(m.section.trim());
      }
    });
    return Array.from(set);
  }, [scopedMembers]);

  // Filtered members for display
  const filteredMembers = useMemo(() => {
    return scopedMembers.filter(m => {
      // Section filter
      if (selectedSectionFilter !== 'all' && m.section !== selectedSectionFilter) {
        return false;
      }
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = m.name.toLowerCase().includes(q);
      const matchId = m.id.toLowerCase().includes(q);
      const matchPhone = m.phoneLast4.includes(q) || (m.fullPhone && m.fullPhone.includes(q));
      const matchSec = m.section && m.section.toLowerCase().includes(q);
      const matchDep = m.dependents && m.dependents.some(d => d.name.toLowerCase().includes(q) || d.subId.toLowerCase().includes(q));
      return matchName || matchId || matchPhone || matchSec || matchDep;
    });
  }, [scopedMembers, selectedSectionFilter, searchQuery]);

  // If member selector is needed, ensure valid ID
  React.useEffect(() => {
    if (!selectedMemberId && filteredMembers.length > 0) {
      setSelectedMemberId(filteredMembers[0].id);
    }
  }, [filteredMembers, selectedMemberId]);

  const activeMember = useMemo(() => {
    return scopedMembers.find(m => m.id === selectedMemberId) || scopedMembers[0];
  }, [scopedMembers, selectedMemberId]);

  // Org branding
  const orgTitle = activeCampaign?.orgName || activeCampaign?.title || creatorProfile.orgName || creatorProfile.name || 'RonPay Organization / Church';
  const orgLogo = activeCampaign?.imageUrl || creatorProfile.logoUrl;
  const orgLocation = activeCampaign?.location || creatorProfile.address;
  const reportTitle = activeCampaign?.title || 'Consolidated Kumtluang Master Roll';

  // Sub-categories for matrix
  const categories = useMemo(() => {
    if (activeCampaign?.subCategories && activeCampaign.subCategories.length > 0) {
      return activeCampaign.subCategories;
    }
    return ['Pathian Ram Zauna', 'Ramthim', 'Mission', 'Building Fund', 'Tualchhung'];
  }, [activeCampaign]);

  // Master Ledger Data calculations
  const ledgerData = useMemo(() => {
    const monthTotals: { [key: string]: number } = {};
    months.forEach(m => { monthTotals[m] = 0; });
    let grandTotal = 0;

    const rows = filteredMembers.map((member, idx) => {
      const memberTxns = scopedTransactions.filter(t => 
        (t.donorName && t.donorName.toLowerCase().trim() === member.name.toLowerCase().trim()) ||
        (t.remark && t.remark.includes(member.id))
      );

      let rowTotal = 0;
      const monthAmounts: { [month: string]: number } = {};

      months.forEach(m => {
        const monthTxns = memberTxns.filter(t => {
          if (t.periodMonth && t.periodMonth.toLowerCase() === m.toLowerCase()) return true;
          const d = new Date(t.timestamp);
          return months[d.getMonth()] === m;
        });
        const sum = monthTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
        monthAmounts[m] = sum;
        rowTotal += sum;
        monthTotals[m] += sum;
      });

      grandTotal += rowTotal;

      return {
        member,
        slNo: idx + 1,
        monthAmounts,
        rowTotal
      };
    });

    return {
      rows,
      monthTotals,
      grandTotal
    };
  }, [filteredMembers, scopedTransactions, months]);

  // Financial Audit Statement Data
  const auditData = useMemo(() => {
    let onlineTotal = 0;
    let cashTotal = 0;

    scopedTransactions.forEach(t => {
      if (t.paymentMethod === 'cash') {
        cashTotal += t.amount || 0;
      } else {
        onlineTotal += t.amount || 0;
      }
    });

    return {
      onlineTotal,
      cashTotal,
      grandTotal: onlineTotal + cashTotal,
      totalCount: scopedTransactions.length
    };
  }, [scopedTransactions]);

  // Generate complete Printable HTML
  const generateReportHtml = () => {
    if (selectedFormat === 'style1_master') {
      const rowsHtml = ledgerData.rows.map(r => `
        <tr style="background: ${r.slNo % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px; color: #64748b;">${r.slNo}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-family: monospace; color: #1e3a8a; font-size: 11px;">${r.member.id}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #0f172a;">${r.member.name}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #64748b; font-size: 10px;">${r.member.section || '-'}</td>
          ${months.map(m => `
            <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">
              ${r.monthAmounts[m] > 0 ? r.monthAmounts[m].toLocaleString('en-IN') : '-'}
            </td>
          `).join('')}
          <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0f2fe; color: #0369a1; font-family: monospace; font-size: 11px;">
            ${r.rowTotal > 0 ? r.rowTotal.toLocaleString('en-IN') : '-'}
          </td>
        </tr>
      `).join('');

      const monthTotalCols = months.map(m => `
        <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; font-family: monospace; font-size: 11px;">
          ${ledgerData.monthTotals[m] > 0 ? ledgerData.monthTotals[m].toLocaleString('en-IN') : '-'}
        </td>
      `).join('');

      return `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Master Ledger • ${orgTitle}</title>
            <meta charset="utf-8" />
            <style>
              @page { size: A4 landscape; margin: 8mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 15px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th { background: #1e293b; color: white; padding: 8px 6px; font-size: 10px; text-transform: uppercase; border: 1px solid #0f172a; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
              .header-left { display: flex; align-items: center; gap: 12px; }
              @media print {
                thead { display: table-row-group !important; }
                tr { page-break-inside: avoid !important; break-inside: avoid !important; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="header-left">
                ${orgLogo ? `<img src="${orgLogo}" style="width: 50px; height: 50px; border-radius: 10px; object-fit: cover; border: 1px solid #1e3a8a;" />` : ''}
                <div>
                  <h1 style="margin: 0; font-size: 18px; color: #1e3a8a; font-weight: 900; text-transform: uppercase;">${orgTitle}</h1>
                  <h2 style="margin: 2px 0 0 0; font-size: 12.5px; color: #475569;">${reportTitle} — Master 12-Month Roll Ledger</h2>
                  ${orgLocation ? `<div style="font-size: 10px; color: #b45309; font-weight: 700;">📍 ${orgLocation}</div>` : ''}
                </div>
              </div>
              <div style="text-align: right; font-size: 10px; color: #64748b;">
                <div>Printed Date: <b>${formatDateDDMMYYYY(new Date())}</b></div>
                <div>Active Members: <b>${filteredMembers.length}</b></div>
                <div style="color: #047857; font-weight: 900; font-size: 12px; margin-top: 2px;">Grand Total: ₹${ledgerData.grandTotal.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 30px;">#</th>
                  <th style="width: 80px;">ID</th>
                  <th>NAME</th>
                  <th>SECTION</th>
                  ${months.map(m => `<th style="width: 45px;">${m.toUpperCase()}</th>`).join('')}
                  <th style="width: 70px; background: #0284c7;">TOTAL (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
              <tfoot>
                <tr style="background: #e2e8f0; font-weight: 900;">
                  <td colspan="4" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px; color: #0f172a;">
                    GRAND TOTAL COLLECTION:
                  </td>
                  ${monthTotalCols}
                  <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #0284c7; color: white; font-family: monospace; font-size: 12px;">
                    ₹${ledgerData.grandTotal.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </body>
        </html>
      `;
    }

    // Default fallback
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${orgTitle} Statement</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: sans-serif; padding: 20px; }
          </style>
        </head>
        <body>
          <h2>${orgTitle}</h2>
          <p>${reportTitle}</p>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const html = generateReportHtml();
    printHtmlSafely(html, `${orgTitle} - ${reportTitle}`);
  };

  const handleDownloadHtml = () => {
    const html = generateReportHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${orgTitle}_MemberRoll_${selectedFormat}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyTable = () => {
    let tsv = '';
    if (selectedFormat === 'style1_master') {
      tsv += ['SL', 'MEMBER ID', 'NAME', 'SECTION', ...months, 'TOTAL'].join('\t') + '\n';
      ledgerData.rows.forEach(r => {
        const rowVals = [
          r.slNo,
          r.member.id,
          r.member.name,
          r.member.section || '-',
          ...months.map(m => r.monthAmounts[m] || 0),
          r.rowTotal
        ];
        tsv += rowVals.join('\t') + '\n';
      });
      tsv += ['TOTAL', '', '', '', ...months.map(m => ledgerData.monthTotals[m]), ledgerData.grandTotal].join('\t') + '\n';
    }

    navigator.clipboard.writeText(tsv).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        
        {/* TOP MODAL TOOLBAR */}
        <div className="bg-slate-950 px-4 sm:px-6 py-3 border-b border-slate-800 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Eye className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base text-white truncate">
                  Member Roll & Financial Statement Preview
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0">
                  Live View
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {orgTitle} • {filteredMembers.length} Members Listed • Total ₹{ledgerData.grandTotal.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Top Actions: Print, Download, Copy, Close */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                title="Print Document or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Download Standalone HTML file"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">HTML</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTable}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Copy Table Data (TSV for Excel)"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="bg-slate-900 px-4 sm:px-6 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
          
          {/* Left Controls: Format & QR Scope */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Format Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="preview-format-select" className="text-slate-400 font-bold shrink-0">
                Format:
              </label>
              <select
                id="preview-format-select"
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as PreviewReportFormat)}
                className="bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="style1_master">📋 Format 1: Master 12-Month Ledger</option>
                <option value="style4_audit">📊 Format 2: Financial Audit Statement</option>
                <option value="style2_matrix">📑 Format 3: Mimal Category Matrix</option>
                <option value="style3_passbook">💳 Format 4: Mimal Passbook Slip</option>
              </select>
            </div>

            {/* Bawm Scope Selector */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="preview-camp-select" className="text-slate-400 font-bold shrink-0">
                QR Bawm:
              </label>
              <select
                id="preview-camp-select"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[200px] truncate"
              >
                <option value="all">🌐 All Campaigns ({members.length} Members)</option>
                {campaigns.map(c => (
                  <option key={c.id} value={c.id}>
                    🏛️ {c.orgCode || 'QR'} - {c.orgName || c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Filter (if available) */}
            {availableSections.length > 0 && selectedFormat === 'style1_master' && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="preview-sec-select" className="text-slate-400 font-bold shrink-0">
                  Section:
                </label>
                <select
                  id="preview-sec-select"
                  value={selectedSectionFilter}
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[150px] truncate"
                >
                  <option value="all">All Sections ({scopedMembers.length})</option>
                  {availableSections.map(sec => (
                    <option key={sec} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Member Selector (for Mimal views) */}
            {(selectedFormat === 'style2_matrix' || selectedFormat === 'style3_passbook') && (
              <div className="flex items-center gap-1.5">
                <label htmlFor="preview-member-select" className="text-slate-400 font-bold shrink-0">
                  Member:
                </label>
                <select
                  id="preview-member-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 cursor-pointer max-w-[180px] truncate"
                >
                  {scopedMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Search Input */}
          {selectedFormat === 'style1_master' && (
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search roll..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* DOCUMENT PREVIEW CANVAS CONTAINER */}
        <div className="flex-1 bg-slate-950 p-3 sm:p-6 overflow-y-auto overflow-x-auto flex justify-center items-start">
          
          {/* FORMAT 1: MASTER 12-MONTH ROLL LEDGER (Landscape A4 Sheet Simulation) */}
          {selectedFormat === 'style1_master' && (
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 p-5 sm:p-8 w-full max-w-5xl my-2 animate-fadeIn min-w-[800px]">
              
              {/* Document Letterhead */}
              <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-900 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {orgLogo ? (
                      <img src={orgLogo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-7 h-7 text-indigo-900" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-black uppercase text-indigo-950 tracking-tight">{orgTitle}</h1>
                    <h2 className="text-xs font-bold text-slate-600 mt-0.5">{reportTitle} • 12-Month Master Ledger</h2>
                    {orgLocation && (
                      <div className="text-[11px] font-semibold text-amber-800 mt-0.5">📍 {orgLocation}</div>
                    )}
                  </div>
                </div>

                <div className="text-right text-xs space-y-1">
                  <div className="text-slate-500">Date: <span className="font-bold text-slate-800">{formatDateDDMMYYYY(new Date())}</span></div>
                  <div className="text-slate-500">Enrolled Members: <span className="font-bold text-slate-800">{filteredMembers.length}</span></div>
                  <div className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 inline-block">
                    Total: ₹{ledgerData.grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* 12-Month Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[10px] uppercase">
                      <th className="p-2 border border-slate-900 text-center w-10">#</th>
                      <th className="p-2 border border-slate-900 w-24">ID</th>
                      <th className="p-2 border border-slate-900">Name (Chhungkaw Hotu)</th>
                      <th className="p-2 border border-slate-900">Section</th>
                      {months.map(m => (
                        <th key={m} className="p-2 border border-slate-900 text-right w-14">
                          {m}
                        </th>
                      ))}
                      <th className="p-2 border border-slate-900 text-right w-20 bg-indigo-700">
                        Total (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerData.rows.map(r => (
                      <tr key={r.member.id} className="border-b border-slate-200 hover:bg-indigo-50/50 transition">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500 font-mono">
                          {r.slNo}
                        </td>
                        <td className="p-2 border border-slate-200 font-mono font-black text-indigo-900">
                          {r.member.id}
                        </td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            {r.member.avatarUrl && (
                              <img src={r.member.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 border border-slate-300" />
                            )}
                            <span>{r.member.name}</span>
                          </div>
                          {r.member.dependents && r.member.dependents.length > 0 && (
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                              {r.member.dependents.map(d => d.name).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="p-2 border border-slate-200 text-slate-600 text-[10.5px]">
                          {r.member.section || '-'}
                        </td>
                        {months.map(m => {
                          const amt = r.monthAmounts[m];
                          return (
                            <td key={m} className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-800">
                              {amt > 0 ? amt.toLocaleString('en-IN') : <span className="text-slate-300 font-normal">-</span>}
                            </td>
                          );
                        })}
                        <td className="p-2 border border-slate-200 text-right font-mono font-black text-indigo-900 bg-indigo-50/70">
                          {r.rowTotal > 0 ? `₹${r.rowTotal.toLocaleString('en-IN')}` : '-'}
                        </td>
                      </tr>
                    ))}

                    {ledgerData.rows.length === 0 && (
                      <tr>
                        <td colSpan={17} className="p-8 text-center text-slate-400">
                          Member record zawnna mil a awm lo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={4} className="p-2.5 border border-slate-300 text-right uppercase tracking-wider">
                        Grand Total Collection:
                      </td>
                      {months.map(m => (
                        <td key={m} className="p-2.5 border border-slate-300 text-right font-mono text-indigo-950 font-bold">
                          {ledgerData.monthTotals[m] > 0 ? ledgerData.monthTotals[m].toLocaleString('en-IN') : '-'}
                        </td>
                      ))}
                      <td className="p-2.5 border border-slate-300 text-right font-mono font-black text-white bg-indigo-700 text-sm">
                        ₹${ledgerData.grandTotal.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Signatures Footer */}
              <div className="grid grid-cols-3 gap-4 pt-10 mt-6 border-t border-slate-200 text-center text-xs">
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">
                  Treasurer / Recorder
                </div>
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">
                  Finance Auditor
                </div>
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">
                  Secretary / Head Leader
                </div>
              </div>
            </div>
          )}

          {/* FORMAT 2: FINANCIAL AUDIT STATEMENT */}
          {selectedFormat === 'style4_audit' && (
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 p-6 sm:p-8 w-full max-w-4xl my-2 animate-fadeIn space-y-6">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-900 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {orgLogo ? (
                      <img src={orgLogo} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <Award className="w-7 h-7 text-indigo-900" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-black uppercase text-indigo-950 tracking-tight">{orgTitle}</h1>
                    <div className="text-xs font-bold text-indigo-700 uppercase tracking-widest mt-0.5">OFFICIAL FINANCIAL AUDIT STATEMENT</div>
                    {orgLocation && <div className="text-[11px] font-semibold text-amber-800">📍 {orgLocation}</div>}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600">
                  <div>Statement Date: <b>{formatDateDDMMYYYY(new Date())}</b></div>
                  <div>Bawm: <b>{reportTitle}</b></div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[11px] font-bold text-indigo-800 uppercase">Total Grand Collection</div>
                  <div className="text-xl font-black text-indigo-950 font-mono mt-1">₹{auditData.grandTotal.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">{auditData.totalCount} Transactions Verified</div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                  <div className="text-[11px] font-bold text-blue-800 uppercase">Online UPI Payments</div>
                  <div className="text-xl font-black text-blue-950 font-mono mt-1">₹{auditData.onlineTotal.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-blue-600 font-semibold mt-0.5">Direct Settlement Mode</div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Cash & Counter Receipts</div>
                  <div className="text-xl font-black text-emerald-950 font-mono mt-1">₹{auditData.cashTotal.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">Physical Collection Mode</div>
                </div>
              </div>

              {/* Verified Transactions Table */}
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">
                  Audited Transaction Records ({scopedTransactions.length})
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-900 text-white font-bold text-[10.5px]">
                        <th className="p-2 border-b">Date & Time</th>
                        <th className="p-2 border-b">Donor / Member</th>
                        <th className="p-2 border-b text-center">Mode</th>
                        <th className="p-2 border-b">Remarks / Purpose</th>
                        <th className="p-2 border-b text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scopedTransactions.slice(0, 30).map((t, idx) => (
                        <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-2 border-b border-slate-100 font-mono text-[11px] text-slate-600">
                            {formatDateDDMMYYYY(new Date(t.timestamp))}
                          </td>
                          <td className="p-2 border-b border-slate-100 font-bold text-slate-900">
                            {t.donorName}
                          </td>
                          <td className="p-2 border-b border-slate-100 text-center">
                            <span className={`px-2 py-0.5 rounded text-[9.5px] font-black uppercase ${
                              t.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {t.paymentMethod === 'cash' ? 'CASH' : 'ONLINE'}
                            </span>
                          </td>
                          <td className="p-2 border-b border-slate-100 text-slate-600 text-[11px]">
                            {t.remark || '-'}
                          </td>
                          <td className="p-2 border-b border-slate-100 text-right font-mono font-black text-slate-900">
                            ₹{t.amount?.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 text-center text-xs">
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">Prepared by (Treasurer)</div>
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">Verified by (Finance Auditor)</div>
                <div className="border-t border-slate-400 pt-2 font-bold text-slate-700">Approved by (Secretary)</div>
              </div>
            </div>
          )}

          {/* FORMAT 3: MIMAL CATEGORY MATRIX */}
          {selectedFormat === 'style2_matrix' && activeMember && (
            <div className="bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-300 p-6 sm:p-8 w-full max-w-4xl my-2 animate-fadeIn space-y-5">
              <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-900 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                    {activeMember.avatarUrl ? (
                      <img src={activeMember.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-indigo-900" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-lg font-black text-slate-900">{activeMember.name}</h1>
                    <div className="text-xs font-mono font-black text-indigo-700">ID: {activeMember.id} {activeMember.section ? `• ${activeMember.section}` : ''}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">{orgTitle} • Mimal Category Matrix</div>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <span className="bg-indigo-100 text-indigo-900 font-black px-3 py-1 rounded-xl text-xs">
                    12-Month Matrix
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs text-left">
                  <thead>
                    <tr className="bg-slate-900 text-white font-bold text-[10.5px]">
                      <th className="p-2 border">Category / Awmzia</th>
                      {months.map(m => (
                        <th key={m} className="p-2 border text-right w-14">{m}</th>
                      ))}
                      <th className="p-2 border text-right w-20 bg-indigo-700">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat, idx) => {
                      const memberTxns = scopedTransactions.filter(t => 
                        ((t.donorName && t.donorName.toLowerCase().trim() === activeMember.name.toLowerCase().trim()) ||
                         (t.remark && t.remark.includes(activeMember.id))) &&
                        (t.subCategory === cat || (t.remark && t.remark.includes(cat)))
                      );
                      let catTotal = 0;

                      return (
                        <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="p-2 border border-slate-200 font-bold text-slate-800">{cat}</td>
                          {months.map(m => {
                            const sum = memberTxns.filter(t => {
                              if (t.periodMonth && t.periodMonth.toLowerCase() === m.toLowerCase()) return true;
                              const d = new Date(t.timestamp);
                              return months[d.getMonth()] === m;
                            }).reduce((acc, t) => acc + (t.amount || 0), 0);
                            catTotal += sum;
                            return (
                              <td key={m} className="p-2 border border-slate-200 text-right font-mono font-bold text-slate-700">
                                {sum > 0 ? sum.toLocaleString('en-IN') : '-'}
                              </td>
                            );
                          })}
                          <td className="p-2 border border-slate-200 text-right font-mono font-black text-indigo-950 bg-indigo-50">
                            {catTotal > 0 ? `₹${catTotal.toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FORMAT 4: MIMAL PASSBOOK SLIP */}
          {selectedFormat === 'style3_passbook' && activeMember && (
            <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border-2 border-indigo-950 p-6 sm:p-8 w-full max-w-md my-2 animate-fadeIn space-y-4">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 space-y-1">
                <div className="w-12 h-12 rounded-2xl bg-indigo-900 text-white flex items-center justify-center mx-auto shadow-md">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h3 className="font-black text-base uppercase text-indigo-950">{orgTitle}</h3>
                <p className="text-xs font-bold text-indigo-700">MIMAL PEKNA PASSBOOK SLIP</p>
                {orgLocation && <p className="text-[10.5px] text-slate-500">📍 {orgLocation}</p>}
              </div>

              {/* Member Details */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-bold">
                <div className="flex justify-between">
                  <span className="text-slate-500">Member ID:</span>
                  <span className="font-mono font-black text-indigo-950">{activeMember.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Chhungkaw Hotu:</span>
                  <span className="text-slate-900">{activeMember.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <span className="font-mono text-slate-800">{activeMember.fullPhone || `****${activeMember.phoneLast4}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Section / Bial:</span>
                  <span className="text-slate-800">{activeMember.section || '-'}</span>
                </div>
              </div>

              {/* Monthly breakdown */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs">
                <div className="bg-slate-900 text-white p-2 font-bold flex justify-between text-[11px]">
                  <span>THLA / PERIOD</span>
                  <span>PEK ZAT (₹)</span>
                </div>
                <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                  {months.map(m => {
                    const memberTxns = scopedTransactions.filter(t => 
                      ((t.donorName && t.donorName.toLowerCase().trim() === activeMember.name.toLowerCase().trim()) ||
                       (t.remark && t.remark.includes(activeMember.id))) &&
                      (t.periodMonth?.toLowerCase() === m.toLowerCase() || months[new Date(t.timestamp).getMonth()] === m)
                    );
                    const sum = memberTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
                    return (
                      <div key={m} className="flex justify-between p-2 font-semibold">
                        <span className="text-slate-600">{m} 2026</span>
                        <span className="font-mono font-black text-slate-900">
                          {sum > 0 ? `₹${sum.toLocaleString('en-IN')}` : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-center pt-3 border-t border-slate-200">
                <div className="text-[10px] text-slate-400 font-medium">Official Computerized Statement</div>
                <div className="text-xs font-bold text-slate-700 mt-0.5">Authorised Signatory • {orgTitle}</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
