import React, { useState } from 'react';
import { 
  X, 
  History, 
  Search, 
  Download, 
  Printer, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  Filter, 
  ArrowUpRight, 
  Sparkles,
  Calendar,
  Layers,
  HeartHandshake,
  Zap,
  Banknote,
  MessageSquare
} from 'lucide-react';
import { Transaction, BawmCategory } from '../types';
import { BAWM_CONFIG } from '../data/initialData';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../utils/date';

interface PeknaSulhnuModalProps {
  isOpen: boolean;
  transactions: Transaction[];
  onClose: () => void;
  onOpenReceipt?: (tx: Transaction) => void;
}

// Helper to categorize non-Bawm transactions (bills, recharges, tickets, taxes) under 'others'
export const getEffectiveCategory = (t: Transaction): BawmCategory => {
  if (t.category === 'others') return 'others';
  if (
    t.id.startsWith('BILL-') || 
    t.campaignId.startsWith('bill-') || 
    t.campaignTitle.toLowerCase().includes('bill') ||
    t.campaignTitle.toLowerCase().includes('recharge') ||
    t.campaignTitle.toLowerCase().includes('fastag') ||
    t.campaignTitle.toLowerCase().includes('broadband') ||
    t.campaignTitle.toLowerCase().includes('electricity') ||
    t.campaignTitle.toLowerCase().includes('water') ||
    t.campaignTitle.toLowerCase().includes('gas') ||
    t.campaignTitle.toLowerCase().includes('ticket') ||
    t.campaignTitle.toLowerCase().includes('loan') ||
    t.campaignTitle.toLowerCase().includes('tax')
  ) {
    return 'others';
  }
  return t.category;
};

export const PeknaSulhnuModal: React.FC<PeknaSulhnuModalProps> = ({
  isOpen,
  transactions,
  onClose,
  onOpenReceipt,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  if (!isOpen) return null;

  const filtered = transactions.filter(t => {
    const effectiveCategory = getEffectiveCategory(t);
    if (filterCategory !== 'all' && effectiveCategory !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.campaignTitle.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      const matchDonor = t.donorName.toLowerCase().includes(q);
      const matchPeriod = t.periodLabel ? t.periodLabel.toLowerCase().includes(q) : false;
      const matchCategory = effectiveCategory.toLowerCase().includes(q);
      if (!matchTitle && !matchId && !matchDonor && !matchPeriod && !matchCategory) return false;
    }
    return true;
  });

  const totalDonated = filtered.reduce((sum, t) => sum + t.amount, 0);

  const printSingleReceipt = (tx: Transaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Khawngaihin popups allow rawh le.');
      return;
    }

    const effectiveCat = getEffectiveCategory(tx);
    const categoryLabel = effectiveCat === 'others' 
      ? 'OTHERS (BILLS & RECHARGE)' 
      : effectiveCat.toUpperCase() + ' BAWM';

    const subcatsHtml = tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0
      ? `<div style="margin: 15px 0; padding: 10px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
          <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #475569;">ITEMIZED BREAKDOWN:</div>
          ${Object.entries(tx.subCategoryBreakdown).map(([k, v]) => `
            <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0;">
              <span>${k}</span>
              <b>₹${v}</b>
            </div>
          `).join('')}
        </div>`
      : '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RonPay Official Receipt - ${tx.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; padding: 30px 20px; color: #1e1b4b; text-align: center; }
            .receipt-card { max-width: 380px; margin: 0 auto; border: 2px solid #4338ca; border-radius: 20px; padding: 25px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: left; }
            .badge { background: #dcfce7; color: #166534; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 20px; display: inline-block; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px; }
            .label { color: #64748b; }
            .val { font-weight: bold; color: #0f172a; }
            .amount-box { background: #f1f5f9; padding: 15px; border-radius: 12px; text-align: center; margin: 15px 0; border: 1px dashed #cbd5e1; }
            .amount-val { font-size: 26px; font-weight: 900; color: #047857; }
            .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="receipt-card">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="margin: 0; color: #1e1b4b; font-size: 20px;">RONPAY OFFICIAL RECEIPT</h2>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">Mizoram Community & Bawm Payment</div>
              <div style="margin-top: 8px;"><span class="badge">PAID & VERIFIED</span></div>
            </div>

            <div class="amount-box">
              <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Pek Zat (Amount)</div>
              <div class="amount-val">₹${tx.amount.toLocaleString('en-IN')}</div>
            </div>

            <div class="row">
              <span class="label">Receipt No / TX ID:</span>
              <span class="val" style="font-family: monospace;">${tx.id}</span>
            </div>
            <div class="row">
              <span class="label">Date & Time:</span>
              <span class="val">${formatDateTimeDDMMYYYY(tx.timestamp)}</span>
            </div>
            ${tx.periodLabel ? `
              <div class="row">
                <span class="label">Pek Hun / Period:</span>
                <span class="val" style="color: #4338ca;">${tx.periodLabel}</span>
              </div>
            ` : ''}
            <div class="row">
              <span class="label">Category / Bawm:</span>
              <span class="val" style="text-transform: uppercase; color: #4338ca;">${categoryLabel}</span>
            </div>
            <div class="row">
              <span class="label">Campaign / Service:</span>
              <span class="val">${tx.campaignTitle}</span>
            </div>
            <div class="row">
              <span class="label">Petu Hming:</span>
              <span class="val">${tx.isAnonymous ? 'Anonymous' : tx.donorName}</span>
            </div>
            <div class="row">
              <span class="label">Payment Mode:</span>
              <span class="val" style="text-transform: uppercase;">${tx.paymentMethod === 'online' ? '⚡ ONLINE UPI' : '💵 CASH DEPOSIT'}</span>
            </div>
            ${tx.remark ? `
            <div class="row">
              <span class="label">Remark:</span>
              <span class="val" style="font-style: italic;">${tx.remark}</span>
            </div>
            ` : ''}

            ${subcatsHtml}

            <div class="row" style="font-size: 10px; margin-top: 10px;">
              <span class="label">Hash:</span>
              <span class="val" style="font-family: monospace; font-size: 9px;">${tx.txHash}</span>
            </div>

            <div class="footer">
              Hei hi RonPay System generated receipt a ni a, signature a ngai lo.<br/>
              <b>RonPay Mizoram Community Platform</b>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() { window.print(); window.close(); }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-800">
      <div className="bg-white w-full max-w-lg rounded-3xl p-4 sm:p-5 shadow-2xl border border-indigo-200 relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">Pekna Sulhnu</h3>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                  My History
                </span>
              </div>
              <p className="text-[10.5px] text-slate-400 font-medium">
                RonPay hmanga sum i lo thawh/pek tawhte leh Receipt-te
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-2xl p-3.5 text-white my-3 shrink-0 shadow-md border border-indigo-800 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">
              Pek Zat Zawng Zawng (Total Given)
            </span>
            <div className="text-2xl font-black text-amber-400">
              ₹{totalDonated.toLocaleString('en-IN')}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-indigo-200 font-bold">Thawh Zat (Transactions)</span>
            <div className="text-lg font-black text-white">{filtered.length} entries</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-2 mb-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Bawm, Campaign name, or Period..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none transition"
            />
          </div>

          {/* Category Tabs with Smooth Scroll and Visual Cue */}
          <div className="relative group">
            <div className="flex gap-1.5 overflow-x-auto pb-2 pt-0.5 text-xs scroll-smooth scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-slate-100">
              {[
                { key: 'all', label: 'All Payments', count: transactions.length },
                { key: 'ralna', label: 'Ralna Bawm', count: transactions.filter(t => getEffectiveCategory(t) === 'ralna').length },
                { key: 'khawlsak', label: 'Khawlsak Bawm', count: transactions.filter(t => getEffectiveCategory(t) === 'khawlsak').length },
                { key: 'rikrum', label: 'Rikrum Bawm', count: transactions.filter(t => getEffectiveCategory(t) === 'rikrum').length },
                { key: 'kumtluang', label: 'Kumtluang Bawm', count: transactions.filter(t => getEffectiveCategory(t) === 'kumtluang').length },
                { key: 'others', label: 'Others (Bills/Recharge)', count: transactions.filter(t => getEffectiveCategory(t) === 'others').length },
              ].map(tab => {
                const isActive = filterCategory === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setFilterCategory(tab.key)}
                    className={`px-3 py-1.5 rounded-xl font-extrabold text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200/80'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-black ${
                        isActive ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* List of Donations */}
        <div className="overflow-y-auto flex-1 space-y-2.5 pr-1 text-xs">
          {filtered.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <HeartHandshake className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
              <p className="font-bold text-slate-600 text-sm">Pekna sulhnu a la awm rih lo</p>
              <p className="text-[11px] text-slate-400">
                Bawm thlangin sum i thawh/pek veleh hetah hian a lo lang nghal dawn e.
              </p>
            </div>
          ) : (
            filtered.map((tx) => {
              const effectiveCat = getEffectiveCategory(tx);
              const isRalna = effectiveCat === 'ralna';
              const isRikrum = effectiveCat === 'rikrum';
              const isKhawlsak = effectiveCat === 'khawlsak';
              const isKumtluang = effectiveCat === 'kumtluang';
              const isOthers = effectiveCat === 'others';

              return (
                <div
                  key={tx.id}
                  className="bg-slate-50 hover:bg-indigo-50/40 p-3 rounded-2xl border border-slate-200 hover:border-indigo-300 transition space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        isRalna ? 'bg-slate-900 text-white border-slate-800' :
                        isRikrum ? 'bg-rose-100 text-rose-800 border-rose-200' :
                        isKhawlsak ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                        isKumtluang ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        'bg-purple-100 text-purple-900 border-purple-200'
                      }`}>
                        {isOthers ? 'OTHERS / BILL' : effectiveCat}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono font-medium">
                        {tx.id}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="font-black text-sm text-slate-900">
                        ₹{tx.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs">
                      {tx.campaignTitle}
                    </h4>
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 mt-0.5">
                      <span>{formatDateDDMMYYYY(tx.timestamp)}</span>
                      {tx.periodLabel && (
                        <span className="text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                          {tx.periodLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sub category tags if available */}
                  {tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/60">
                      {Object.entries(tx.subCategoryBreakdown).map(([cat, amt]) => (
                        <span key={cat} className="text-[9.5px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                          {cat}: <b>₹{amt}</b>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Remark if present (Compact space-saving inline) */}
                  {tx.remark && (
                    <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200/80 text-[10px] text-slate-600">
                      <MessageSquare className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold text-slate-700">Remark:</span>
                      <span className="italic truncate">{tx.remark}</span>
                    </div>
                  )}

                  {/* Actions & Payment Mode */}
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5">
                      {tx.paymentMethod === 'online' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200" title="Online UPI Payment">
                          <Zap className="w-2.5 h-2.5 text-amber-500" />
                          <span>Online</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200" title="Cash Counter Deposit">
                          <Banknote className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Cash</span>
                        </span>
                      )}
                      <span className="text-[9px] font-bold text-slate-400">
                        {tx.status === 'completed' ? '• Verified' : '• Pending'}
                      </span>
                    </div>

                    <button
                      onClick={() => printSingleReceipt(tx)}
                      className="bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 text-[10px] font-extrabold py-1 px-2.5 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Printer className="w-3 h-3 text-indigo-600" />
                      Print Receipt
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
