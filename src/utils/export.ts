import { Transaction } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from './date';

export interface MatrixRow {
  donorName: string;
  categoryAmounts: { [category: string]: number };
  total: number;
  isAnonymous?: boolean;
  paymentMethods: ('online' | 'cash')[];
  paymentMethodLabel: 'ONLINE' | 'CASH' | 'ONLINE + CASH';
  remarks?: string[];
}

export interface KumtluangMatrixData {
  categories: string[];
  rows: MatrixRow[];
  columnTotals: { [category: string]: number };
  grandTotal: number;
  onlineTotal: number;
  cashTotal: number;
}

export const ALL_MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface MonthRangeConfig {
  startMonth?: string;
  endMonth?: string;
  preset?: string;
}

export interface TargetExportInfo {
  targetAmount: number;
  targetPeriod?: 'monthly' | 'yearly' | 'total' | string;
  periodLabel?: string;
  periodSuffix?: string;
  progressPct?: number;
  isCompleted?: boolean;
  remaining?: number;
  surplus?: number;
  campaignTitle?: string;
}

export interface PDFExportOptions {
  includeMonthlyChart?: boolean;
  monthRangeConfig?: MonthRangeConfig;
  includeSignatures?: boolean;
  preparedByTitle?: string;
  verifiedByTitle?: string;
  approvedByTitle?: string;
  targetInfo?: TargetExportInfo;
}

/**
 * Returns the ordered array of month abbreviations for a given From - Upto month configuration.
 */
export const getMonthsListForConfig = (config?: MonthRangeConfig): string[] => {
  const start = config?.startMonth || 'Apr';
  const end = config?.endMonth || 'Mar';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const sIdx = months.indexOf(start);
  const eIdx = months.indexOf(end);
  if (sIdx === -1 || eIdx === -1) {
    return ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  }
  
  if (sIdx === eIdx) {
    return [start]; // Single month (e.g. From Aug Upto Aug)
  }
  if (sIdx < eIdx) {
    return months.slice(sIdx, eIdx + 1);
  } else {
    // Wrap around (e.g., Apr to Mar => Apr..Dec, Jan..Mar)
    return [...months.slice(sIdx), ...months.slice(0, eIdx + 1)];
  }
};

/**
 * Builds a donor-by-category matrix specifically for Kumtluang Bawm / multi-category campaigns.
 */
export const buildKumtluangMatrix = (
  transactions: Transaction[],
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc'
): KumtluangMatrixData => {
  const categorySet = new Set<string>();
  const donorMap = new Map<string, { [cat: string]: number }>();
  const donorPaymentMethods = new Map<string, Set<'online' | 'cash'>>();
  const donorRemarks = new Map<string, string[]>();

  let onlineTotal = 0;
  let cashTotal = 0;

  transactions.forEach(t => {
    const donor = t.isAnonymous ? 'Anonymous' : (t.donorName || 'Unknown Donor');
    const method: 'online' | 'cash' = t.paymentMethod === 'cash' ? 'cash' : 'online';

    if (method === 'online') {
      onlineTotal += t.amount;
    } else {
      cashTotal += t.amount;
    }

    if (!donorPaymentMethods.has(donor)) {
      donorPaymentMethods.set(donor, new Set());
    }
    donorPaymentMethods.get(donor)!.add(method);

    if (t.remark && t.remark.trim()) {
      if (!donorRemarks.has(donor)) {
        donorRemarks.set(donor, []);
      }
      const cleanRemark = t.remark.trim();
      if (!donorRemarks.get(donor)!.includes(cleanRemark)) {
        donorRemarks.get(donor)!.push(cleanRemark);
      }
    }

    if (!donorMap.has(donor)) {
      donorMap.set(donor, {});
    }
    const donorCats = donorMap.get(donor)!;

    if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
      Object.entries(t.subCategoryBreakdown).forEach(([cat, amt]) => {
        const cleanCat = cat.trim();
        const numAmt = Number(amt) || 0;
        if (numAmt > 0) {
          categorySet.add(cleanCat);
          donorCats[cleanCat] = (donorCats[cleanCat] || 0) + numAmt;
        }
      });
    } else {
      const fallbackCat = t.campaignTitle || 'General Collection';
      categorySet.add(fallbackCat);
      donorCats[fallbackCat] = (donorCats[fallbackCat] || 0) + t.amount;
    }
  });

  const categories = Array.from(categorySet);
  const rows: MatrixRow[] = [];
  const columnTotals: { [category: string]: number } = {};
  categories.forEach(c => { columnTotals[c] = 0; });
  let grandTotal = 0;

  donorMap.forEach((catAmounts, donorName) => {
    let rowTotal = 0;
    const cleanCatAmounts: { [category: string]: number } = {};

    categories.forEach(c => {
      const amt = catAmounts[c] || 0;
      cleanCatAmounts[c] = amt;
      rowTotal += amt;
      columnTotals[c] += amt;
    });

    grandTotal += rowTotal;

    const methodsSet = donorPaymentMethods.get(donorName) || new Set<'online' | 'cash'>(['online']);
    const methodsArr = Array.from(methodsSet);
    let methodLabel: 'ONLINE' | 'CASH' | 'ONLINE + CASH' = 'ONLINE';
    if (methodsSet.has('online') && methodsSet.has('cash')) {
      methodLabel = 'ONLINE + CASH';
    } else if (methodsSet.has('cash')) {
      methodLabel = 'CASH';
    } else {
      methodLabel = 'ONLINE';
    }

    const remarksList = donorRemarks.get(donorName);

    rows.push({
      donorName,
      categoryAmounts: cleanCatAmounts,
      total: rowTotal,
      paymentMethods: methodsArr,
      paymentMethodLabel: methodLabel,
      remarks: remarksList && remarksList.length > 0 ? remarksList : undefined,
    });
  });

  // Apply sorting to matrix rows
  if (sortOrder === 'name-asc') {
    rows.sort((a, b) => a.donorName.localeCompare(b.donorName));
  } else if (sortOrder === 'name-desc') {
    rows.sort((a, b) => b.donorName.localeCompare(a.donorName));
  } else if (sortOrder === 'amount-desc') {
    rows.sort((a, b) => b.total - a.total);
  }

  return {
    categories,
    rows,
    columnTotals,
    grandTotal,
    onlineTotal,
    cashTotal,
  };
};

/**
 * Computes monthly distribution for the visual bar chart based on selected month configuration
 */
export const computeMonthlyDistribution = (
  transactions: Transaction[],
  config?: MonthRangeConfig
) => {
  const months = getMonthsListForConfig(config);
  const monthTotals: Record<string, number> = {};
  months.forEach(m => { monthTotals[m] = 0; });

  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  transactions.forEach(t => {
    try {
      const d = new Date(t.timestamp);
      const mIdx = d.getMonth(); // 0=Jan, 3=Apr, 7=Aug
      const mName = monthNamesShort[mIdx];
      if (monthTotals[mName] !== undefined) {
        monthTotals[mName] += t.amount;
      }
    } catch {
      // fallback
    }
  });

  const maxVal = Math.max(...Object.values(monthTotals), 1);
  return {
    months,
    monthTotals,
    maxVal,
  };
};

/**
 * Exports formatted XML/HTML Excel Workbook (.xls) with custom cell styles, colors, borders, and currency formats.
 */
export const exportFormattedExcel = (
  transactions: Transaction[],
  title: string = 'RonPay_Formatted_Report',
  isKumtluang: boolean = false,
  campaignName: string = 'All Campaigns',
  dateRangeText: string = 'All Time',
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  targetInfo?: TargetExportInfo
) => {
  const orgName = creatorInfo?.orgName?.trim() || (campaignName && campaignName !== 'All Campaigns' ? campaignName : '') || creatorInfo?.name?.trim() || 'RONPAY ORGANIZATION';
  const location = creatorInfo?.address?.trim() || 'Mizoram, India';
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const onlineTransactions = transactions.filter(t => t.paymentMethod === 'online');
  const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
  const onlineTotal = onlineTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

  let tableContentHtml = '';

  if (isKumtluang) {
    const matrix = buildKumtluangMatrix(transactions, sortOrder);
    const colCount = matrix.categories.length + 3; // SlNo + Hming + PaymentMode + categories + Total

    const catHeaders = matrix.categories.map(c => 
      `<th class="header-cat">${c.toUpperCase()}</th>`
    ).join('');

    const dataRows = matrix.rows.map((r, idx) => {
      const modeText = r.paymentMethodLabel === 'ONLINE' ? '⚡ ONLINE' : r.paymentMethodLabel === 'CASH' ? '💵 CASH' : '⚡+💵 ONLINE & CASH';
      return `
      <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
        <td class="cell-center cell-bold">${idx + 1}</td>
        <td class="cell-left cell-bold">${r.donorName}</td>
        <td class="cell-center cell-mode ${r.paymentMethodLabel === 'CASH' ? 'mode-cash' : 'mode-online'}">${modeText}</td>
        ${matrix.categories.map(c => `
          <td class="cell-currency">${r.categoryAmounts[c] || 0}</td>
        `).join('')}
        <td class="cell-currency-total">${r.total}</td>
      </tr>
    `;
    }).join('');

    const totalCols = matrix.categories.map(c => `
      <td class="cell-grand-currency">${matrix.columnTotals[c] || 0}</td>
    `).join('');

    const targetRowsHtml = targetInfo && targetInfo.targetAmount > 0 ? `
        <tr class="meta-row">
          <td colspan="2" class="meta-header">🎯 Target Goal:</td>
          <td colspan="${colCount - 2}" class="meta-data">INR ${targetInfo.targetAmount.toLocaleString('en-IN')}${targetInfo.periodSuffix || ''} (${targetInfo.periodLabel || 'Target'})</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">📈 Target Achievement:</td>
          <td colspan="${colCount - 2}" class="meta-data-highlight">${targetInfo.progressPct ?? Math.round((matrix.grandTotal / targetInfo.targetAmount) * 100)}% Collected (${matrix.grandTotal >= targetInfo.targetAmount ? `Goal Achieved (+INR ${(matrix.grandTotal - targetInfo.targetAmount).toLocaleString('en-IN')} surplus)` : `INR ${(targetInfo.targetAmount - matrix.grandTotal).toLocaleString('en-IN')} Remaining`})</td>
        </tr>
    ` : '';

    tableContentHtml = `
      <table class="report-table">
        <!-- Title Banner -->
        <tr>
          <th colspan="${colCount}" class="title-banner">${orgName.toUpperCase()}</th>
        </tr>
        <tr>
          <td colspan="${colCount}" class="subtitle-banner">📍 ${location}</td>
        </tr>
        <tr>
          <td colspan="${colCount}" class="badge-banner">REPORTS & FINANCIAL STATEMENTS</td>
        </tr>
        <tr>
          <td colspan="${colCount}" class="date-banner">Trxn Date: ${dateRangeText}</td>
        </tr>
        <tr><td colspan="${colCount}" class="empty-row"></td></tr>

        <!-- Meta Summary Grid -->
        <tr class="meta-row">
          <td colspan="2" class="meta-header">NGO / Church / Title:</td>
          <td colspan="${colCount - 2}" class="meta-data">${orgName}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Veng / Khua / Location:</td>
          <td colspan="${colCount - 2}" class="meta-data">${location}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Document Type:</td>
          <td colspan="${colCount - 2}" class="meta-data">Reports & Financial Statements</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Trxn Date:</td>
          <td colspan="${colCount - 2}" class="meta-data">${dateRangeText}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Total Donors:</td>
          <td colspan="${colCount - 2}" class="meta-data">${matrix.rows.length} Donors</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">⚡ Online Collection (UPI):</td>
          <td colspan="${colCount - 2}" class="meta-data-online">INR ${matrix.onlineTotal.toLocaleString('en-IN')}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">💵 Cash Collection (Counter):</td>
          <td colspan="${colCount - 2}" class="meta-data-cash">INR ${matrix.cashTotal.toLocaleString('en-IN')}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Grand Total Collection:</td>
          <td colspan="${colCount - 2}" class="meta-data-highlight">INR ${matrix.grandTotal.toLocaleString('en-IN')}</td>
        </tr>
        ${targetRowsHtml}
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Exported At:</td>
          <td colspan="${colCount - 2}" class="meta-data">${formatDateTimeDDMMYYYY(new Date().toISOString())}</td>
        </tr>
        <tr><td colspan="${colCount}" class="empty-row"></td></tr>

        <!-- Data Headers -->
        <thead>
          <tr>
            <th class="header-sl">SL NO.</th>
            <th class="header-name">HMING (DONOR)</th>
            <th class="header-mode">PAYMENT MODE</th>
            ${catHeaders}
            <th class="header-total">TOTAL (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${dataRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="cell-grand-label">GRAND TOTAL</td>
            ${totalCols}
            <td class="cell-grand-highlight">${matrix.grandTotal}</td>
          </tr>
        </tfoot>
      </table>
    `;
  } else {
    // Standard Itemized Sheet
    const colCount = 7;
    const dataRows = transactions.map((t, idx) => {
      let remarks = t.periodLabel || '';
      if (t.remark && t.remark.trim()) {
        remarks = remarks ? `${remarks} • Note: ${t.remark.trim()}` : t.remark.trim();
      }
      if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
        const parts = Object.entries(t.subCategoryBreakdown).map(([k, v]) => `${k}: ${v}`);
        remarks = remarks ? `${remarks} (${parts.join(', ')})` : parts.join(', ');
      }

      const modeText = t.paymentMethod === 'cash' ? '💵 CASH' : '⚡ ONLINE';

      return `
        <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="cell-center cell-bold">${idx + 1}</td>
          <td class="cell-center cell-date">${formatDateTimeDDMMYYYY(t.timestamp)}</td>
          <td class="cell-left cell-bold">${t.isAnonymous ? 'Anonymous' : t.donorName}</td>
          <td class="cell-center cell-mode ${t.paymentMethod === 'cash' ? 'mode-cash' : 'mode-online'}">${modeText}</td>
          <td class="cell-left">${remarks || '-'}</td>
          <td class="cell-center cell-hash">${t.txHash || t.id}</td>
          <td class="cell-currency-total">${t.amount}</td>
        </tr>
      `;
    }).join('');

    tableContentHtml = `
      <table class="report-table">
        <!-- Title Banner -->
        <tr>
          <th colspan="${colCount}" class="title-banner">${orgName.toUpperCase()}</th>
        </tr>
        <tr>
          <td colspan="${colCount}" class="subtitle-banner">📍 ${location}</td>
        </tr>
        <tr>
          <td colspan="${colCount}" class="badge-banner">REPORTS & FINANCIAL STATEMENTS</td>
        </tr>
        <tr>
          <td colspan="${colCount}" class="date-banner">Trxn Date: ${dateRangeText}</td>
        </tr>
        <tr><td colspan="${colCount}" class="empty-row"></td></tr>

        <!-- Meta Summary Grid -->
        <tr class="meta-row">
          <td colspan="2" class="meta-header">NGO / Church / Title:</td>
          <td colspan="${colCount - 2}" class="meta-data">${orgName}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Veng / Khua / Location:</td>
          <td colspan="${colCount - 2}" class="meta-data">${location}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Document Type:</td>
          <td colspan="${colCount - 2}" class="meta-data">Reports & Financial Statements</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Trxn Date:</td>
          <td colspan="${colCount - 2}" class="meta-data">${dateRangeText}</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Total Transactions:</td>
          <td colspan="${colCount - 2}" class="meta-data">${transactions.length} Entries</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">⚡ Online Collection (UPI):</td>
          <td colspan="${colCount - 2}" class="meta-data-online">INR ${onlineTotal.toLocaleString('en-IN')} (${onlineTransactions.length} txns)</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">💵 Cash Collection (Counter):</td>
          <td colspan="${colCount - 2}" class="meta-data-cash">INR ${cashTotal.toLocaleString('en-IN')} (${cashTransactions.length} txns)</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Grand Total Collection:</td>
          <td colspan="${colCount - 2}" class="meta-data-highlight">INR ${totalAmount.toLocaleString('en-IN')}</td>
        </tr>
        ${targetInfo && targetInfo.targetAmount > 0 ? `
        <tr class="meta-row">
          <td colspan="2" class="meta-header">🎯 Target Goal:</td>
          <td colspan="${colCount - 2}" class="meta-data">INR ${targetInfo.targetAmount.toLocaleString('en-IN')}${targetInfo.periodSuffix || ''} (${targetInfo.periodLabel || 'Target'})</td>
        </tr>
        <tr class="meta-row">
          <td colspan="2" class="meta-header">📈 Target Achievement:</td>
          <td colspan="${colCount - 2}" class="meta-data-highlight">${targetInfo.progressPct ?? Math.round((totalAmount / targetInfo.targetAmount) * 100)}% Collected (${totalAmount >= targetInfo.targetAmount ? `Goal Achieved (+INR ${(totalAmount - targetInfo.targetAmount).toLocaleString('en-IN')} surplus)` : `INR ${(targetInfo.targetAmount - totalAmount).toLocaleString('en-IN')} Remaining`})</td>
        </tr>
        ` : ''}
        <tr class="meta-row">
          <td colspan="2" class="meta-header">Exported At:</td>
          <td colspan="${colCount - 2}" class="meta-data">${formatDateTimeDDMMYYYY(new Date().toISOString())}</td>
        </tr>
        <tr><td colspan="${colCount}" class="empty-row"></td></tr>

        <!-- Data Headers -->
        <thead>
          <tr>
            <th class="header-sl">SL NO.</th>
            <th class="header-date">DATE & TIME</th>
            <th class="header-name">HMING (DONOR)</th>
            <th class="header-mode">PAYMENT MODE</th>
            <th class="header-remarks">REMARKS / NOTE</th>
            <th class="header-ref">TX HASH / ID</th>
            <th class="header-total">AMOUNT (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${dataRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="cell-grand-label">GRAND TOTAL COLLECTION</td>
            <td class="cell-grand-highlight">${totalAmount}</td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${(campaignName || 'Report').slice(0, 31).replace(/[:\\\/?*\[\]]/g, '')}</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          .report-table { border-collapse: collapse; width: 100%; font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; }
          .title-banner { background-color: #0f172a; color: #ffffff; font-size: 15pt; font-weight: bold; text-align: center; height: 36px; }
          .subtitle-banner { background-color: #1e293b; color: #fef08a; font-size: 10pt; font-weight: bold; text-align: center; height: 24px; }
          .badge-banner { background-color: #0284c7; color: #ffffff; font-size: 9.5pt; font-weight: bold; text-align: center; height: 20px; }
          .date-banner { background-color: #0f172a; color: #cbd5e1; font-size: 9pt; font-weight: bold; text-align: center; height: 20px; }
          .empty-row { height: 12px; }
          
          .meta-header { background-color: #f1f5f9; color: #334155; font-weight: bold; border: 0.5pt solid #cbd5e1; padding: 4px 8px; font-size: 9pt; }
          .meta-data { background-color: #ffffff; color: #0f172a; font-weight: bold; border: 0.5pt solid #cbd5e1; padding: 4px 8px; font-size: 9pt; }
          .meta-data-highlight { background-color: #dcfce7; color: #166534; font-weight: bold; border: 0.5pt solid #cbd5e1; padding: 4px 8px; font-size: 10pt; }

          th { background-color: #1e1b4b; color: #ffffff; font-weight: bold; font-size: 9.5pt; text-align: center; border: 0.5pt solid #4338ca; height: 28px; padding: 6px; }
          .header-sl { width: 50px; }
          .header-name { width: 220px; text-align: left; padding-left: 8px; }
          .header-cat { width: 130px; text-align: right; padding-right: 8px; }
          .header-total { width: 130px; text-align: right; background-color: #312e81; padding-right: 8px; }
          .header-date { width: 140px; }
          .header-mode { width: 90px; }
          .header-remarks { width: 200px; text-align: left; }
          .header-ref { width: 140px; }

          .row-even { background-color: #ffffff; }
          .row-odd { background-color: #f8fafc; }

          td { border: 0.5pt solid #e2e8f0; padding: 5px 8px; font-size: 9.5pt; }
          .cell-center { text-align: center; }
          .cell-left { text-align: left; }
          .cell-bold { font-weight: bold; color: #0f172a; }
          .cell-date { mso-number-format:"\@"; color: #475569; }
          .cell-mode { font-weight: bold; color: #166534; }
          .cell-hash { font-family: monospace; font-size: 8.5pt; color: #64748b; mso-number-format:"\@"; }
          
          .cell-currency { text-align: right; font-weight: 600; color: #0f172a; mso-number-format:"\#\,\#\#0"; }
          .cell-currency-total { text-align: right; font-weight: bold; color: #4338ca; background-color: #f1f5f9; mso-number-format:"\#\,\#\#0"; }

          .cell-grand-label { background-color: #e2e8f0; color: #0f172a; font-weight: bold; font-size: 10pt; border-top: 1.5pt solid #0f172a; border-bottom: 2pt double #0f172a; height: 26px; }
          .cell-grand-currency { text-align: right; background-color: #e2e8f0; color: #166534; font-weight: bold; font-size: 10pt; border-top: 1.5pt solid #0f172a; border-bottom: 2pt double #0f172a; mso-number-format:"\#\,\#\#0"; }
          .cell-grand-highlight { text-align: right; background-color: #dcfce7; color: #15803d; font-weight: bold; font-size: 11pt; border-top: 1.5pt solid #0f172a; border-bottom: 2pt double #0f172a; mso-number-format:"\#\,\#\#0"; }
        </style>
      </head>
      <body>
        ${tableContentHtml}
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${sanitizedTitle}_${formatDateDDMMYYYY(new Date()).replace(/\//g, '-')}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportKumtluangMatrixToCSV = (
  transactions: Transaction[], 
  title: string = 'Kumtluang_Bawm_Category_Report',
  campaignName?: string,
  dateRangeText?: string,
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  targetInfo?: TargetExportInfo
) => {
  const matrix = buildKumtluangMatrix(transactions, sortOrder);
  const orgDisplay = creatorInfo?.orgName?.trim() || (campaignName && campaignName !== 'All Campaigns' ? campaignName : '') || creatorInfo?.name?.trim() || 'RONPAY ORGANIZATION';
  const locationDisplay = creatorInfo?.address?.trim() || 'Mizoram, India';

  // Meta information headers with strict DD/MM/YYYY formatting and audit trail
  const metaRows = [
    `"${orgDisplay.toUpperCase()}"`,
    `"Location / Veng:","${locationDisplay.replace(/"/g, '""')}"`,
    `"Document:","Reports & Financial Statements"`,
    `"Trxn Date:","${(dateRangeText || 'All Dates').replace(/"/g, '""')}"`,
    `"Total Donors:","${matrix.rows.length}"`,
    `"⚡ Online Collection (UPI):","Rs. ${matrix.onlineTotal.toLocaleString('en-IN')}"`,
    `"💵 Cash Collection (Counter):","Rs. ${matrix.cashTotal.toLocaleString('en-IN')}"`,
    `"Grand Total Collection:","Rs. ${matrix.grandTotal.toLocaleString('en-IN')}"`,
    ...(targetInfo && targetInfo.targetAmount > 0 ? [
      `"🎯 Target Goal:","Rs. ${targetInfo.targetAmount.toLocaleString('en-IN')}${targetInfo.periodSuffix || ''} (${targetInfo.periodLabel || 'Target'})"`,
      `"📈 Target Achievement:","${targetInfo.progressPct ?? Math.round((matrix.grandTotal / targetInfo.targetAmount) * 100)}% Collected (Rs. ${matrix.grandTotal.toLocaleString('en-IN')} of Rs. ${targetInfo.targetAmount.toLocaleString('en-IN')})"`,
      `"Target Status:","${matrix.grandTotal >= targetInfo.targetAmount ? `Goal Achieved (+Rs. ${(matrix.grandTotal - targetInfo.targetAmount).toLocaleString('en-IN')} surplus)` : `Rs. ${(targetInfo.targetAmount - matrix.grandTotal).toLocaleString('en-IN')} la mamawh`}"`
    ] : []),
    `"Exported Date & Time:","${formatDateTimeDDMMYYYY(new Date().toISOString())}"`,
    `""`,
  ].filter(Boolean);

  // Headers: Hming, Payment Mode, Cat1, Cat2, ..., Total
  const headers = ['Hming (Donor)', 'Payment Mode', ...matrix.categories, 'Total (INR)'];

  const dataRows = matrix.rows.map(r => {
    return [
      `"${r.donorName.replace(/"/g, '""')}"`,
      `"${r.paymentMethodLabel}"`,
      ...matrix.categories.map(c => (r.categoryAmounts[c] || 0).toString()),
      r.total.toString(),
    ];
  });

  const totalRow = [
    '"TOTAL"',
    '""',
    ...matrix.categories.map(c => (matrix.columnTotals[c] || 0).toString()),
    matrix.grandTotal.toString(),
  ];

  const csvContent = [
    ...metaRows,
    headers.join(','),
    ...dataRows.map(row => row.join(',')),
    totalRow.join(','),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${sanitizedTitle}_${formatDateDDMMYYYY(new Date()).replace(/\//g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportDetailedTransactionsCSV = (
  transactions: Transaction[],
  title: string = 'RonPay_Itemized_Transactions',
  campaignName?: string,
  dateRangeText?: string,
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  targetInfo?: TargetExportInfo
) => {
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const onlineTransactions = transactions.filter(t => t.paymentMethod === 'online');
  const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
  const onlineTotal = onlineTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

  const orgDisplay = creatorInfo?.orgName?.trim() || (campaignName && campaignName !== 'All Campaigns' ? campaignName : '') || creatorInfo?.name?.trim() || 'RONPAY ORGANIZATION';
  const locationDisplay = creatorInfo?.address?.trim() || 'Mizoram, India';

  // Meta info header with DD/MM/YYYY and audit details
  const metaRows = [
    `"${orgDisplay.toUpperCase()}"`,
    `"Location / Veng:","${locationDisplay.replace(/"/g, '""')}"`,
    `"Document:","Reports & Financial Statements"`,
    `"Trxn Date:","${(dateRangeText || 'All Dates').replace(/"/g, '""')}"`,
    `"Total Transactions:","${transactions.length}"`,
    `"⚡ Online Collection (UPI):","Rs. ${onlineTotal.toLocaleString('en-IN')} (${onlineTransactions.length} txns)"`,
    `"💵 Cash Collection (Counter):","Rs. ${cashTotal.toLocaleString('en-IN')} (${cashTransactions.length} txns)"`,
    `"Grand Total Collection:","Rs. ${totalAmount.toLocaleString('en-IN')}"`,
    ...(targetInfo && targetInfo.targetAmount > 0 ? [
      `"🎯 Target Goal:","Rs. ${targetInfo.targetAmount.toLocaleString('en-IN')}${targetInfo.periodSuffix || ''} (${targetInfo.periodLabel || 'Target'})"`,
      `"📈 Target Achievement:","${targetInfo.progressPct ?? Math.round((totalAmount / targetInfo.targetAmount) * 100)}% Collected (Rs. ${totalAmount.toLocaleString('en-IN')} of Rs. ${targetInfo.targetAmount.toLocaleString('en-IN')})"`,
      `"Target Status:","${totalAmount >= targetInfo.targetAmount ? `Goal Achieved (+Rs. ${(totalAmount - targetInfo.targetAmount).toLocaleString('en-IN')} surplus)` : `Rs. ${(targetInfo.targetAmount - totalAmount).toLocaleString('en-IN')} la mamawh`}"`
    ] : []),
    `"Exported Date & Time:","${formatDateTimeDDMMYYYY(new Date().toISOString())}"`,
    `""`,
  ].filter(Boolean);

  // Full headers including subcategory details
  const headers = [
    'Transaction ID',
    'Date & Time',
    'Category / Bawm',
    'Campaign Title',
    'Donor Name',
    'Amount (INR)',
    'Payment Mode',
    'Status',
    'Remarks / Note / Subcategory',
    'Reference / Tx Hash'
  ];

  const rows = transactions.map(t => {
    let breakdownStr = t.periodLabel || '';
    if (t.remark && t.remark.trim()) {
      breakdownStr = breakdownStr ? `${breakdownStr} | Note: ${t.remark.trim()}` : `Note: ${t.remark.trim()}`;
    }
    if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
      const parts = Object.entries(t.subCategoryBreakdown).map(([k, v]) => `${k}: Rs.${v}`);
      breakdownStr = breakdownStr ? `${breakdownStr} | ${parts.join('; ')}` : parts.join('; ');
    }

    return [
      `"${t.id}"`,
      `"${formatDateTimeDDMMYYYY(t.timestamp)}"`,
      `"${t.category.toUpperCase()}"`,
      `"${(t.campaignTitle || '').replace(/"/g, '""')}"`,
      `"${(t.isAnonymous ? 'Anonymous' : (t.donorName || '')).replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
      `"${t.paymentMethod.toUpperCase()}"`,
      `"${t.status.toUpperCase()}"`,
      `"${breakdownStr.replace(/"/g, '""')}"`,
      `"${t.txHash || ''}"`
    ];
  });

  const totalRow = [
    '"TOTAL"',
    '""',
    '""',
    '""',
    `"${transactions.length} Transactions"`,
    totalAmount.toFixed(2),
    '""',
    '""',
    '""',
    '""'
  ];

  const csvContent = [
    ...metaRows,
    headers.join(','),
    ...rows.map(row => row.join(',')),
    totalRow.join(',')
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${sanitizedTitle}_${formatDateDDMMYYYY(new Date()).replace(/\//g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportTransactionsToCSV = (
  transactions: Transaction[], 
  title: string = 'RonPay_Transactions', 
  isKumtluang: boolean = false,
  campaignName?: string,
  dateRangeText?: string,
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  targetInfo?: TargetExportInfo
) => {
  if (isKumtluang) {
    exportKumtluangMatrixToCSV(transactions, title, campaignName, dateRangeText, creatorInfo, sortOrder, targetInfo);
    return;
  }

  exportDetailedTransactionsCSV(transactions, title, campaignName, dateRangeText, creatorInfo, targetInfo);
};

/**
 * Generates and prints the High-Precision PDF Financial Statement matching the uploaded Mockup specification.
 */
export const printTransactionsPDF = (
  transactions: Transaction[], 
  title: string = 'Financial Statement', 
  isKumtluang: boolean = false,
  campaignName: string = 'All Campaigns',
  dateRangeText: string = 'All Time',
  imageUrl?: string,
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  options: PDFExportOptions = { includeMonthlyChart: true, includeSignatures: true }
) => {
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const onlineTransactions = transactions.filter(t => t.paymentMethod === 'online');
  const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
  const onlineTotal = onlineTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups in your browser to generate and print PDF reports.');
    return;
  }

  const rawOrg = creatorInfo?.orgName?.trim();
  const orgDisplay = (rawOrg && rawOrg !== 'RonPay HQ / Master Console') 
    ? rawOrg 
    : (campaignName && campaignName !== 'All Campaigns' ? campaignName : (creatorInfo?.name || 'NGO / Church / Organization'));
  const locationDisplay = creatorInfo?.address?.trim() || 'Mizoram, India';
  const creatorDisplay = creatorInfo ? `${creatorInfo.name} (${creatorInfo.phone || ''})` : 'Authorized Official';

  // Summary bar with breakdown of Online & Cash Collections
  const collectionSummaryBarHtml = `
    <div style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; page-break-inside: avoid;">
      <div style="flex: 1; min-width: 150px; background: #eef2ff; border: 1px solid #c7d2fe; padding: 6px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 8.5px; font-weight: 800; color: #4338ca; text-transform: uppercase;">⚡ Online (UPI)</div>
          <div style="font-size: 13px; font-weight: 900; color: #1e1b4b;">₹${onlineTotal.toLocaleString('en-IN')}</div>
        </div>
        <span style="font-size: 9px; font-weight: bold; background: #c7d2fe; color: #312e81; padding: 2px 6px; border-radius: 4px;">${onlineTransactions.length} txns</span>
      </div>
      <div style="flex: 1; min-width: 150px; background: #fffbeb; border: 1px solid #fde68a; padding: 6px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 8.5px; font-weight: 800; color: #b45309; text-transform: uppercase;">💵 Cash (Counter)</div>
          <div style="font-size: 13px; font-weight: 900; color: #78350f;">₹${cashTotal.toLocaleString('en-IN')}</div>
        </div>
        <span style="font-size: 9px; font-weight: bold; background: #fde68a; color: #92400e; padding: 2px 6px; border-radius: 4px;">${cashTransactions.length} txns</span>
      </div>
      <div style="flex: 1.2; min-width: 180px; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 6px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 8.5px; font-weight: 800; color: #15803d; text-transform: uppercase;">Grand Total Collection</div>
          <div style="font-size: 14px; font-weight: 900; color: #14532d;">₹${totalAmount.toLocaleString('en-IN')}</div>
        </div>
        <span style="font-size: 9px; font-weight: bold; background: #bbf7d0; color: #166534; padding: 2px 6px; border-radius: 4px;">${transactions.length} Total</span>
      </div>
    </div>
  `;

  // Target Progress bar and summary if target exists
  let targetSummaryHtml = '';
  if (options.targetInfo && options.targetInfo.targetAmount > 0) {
    const tInfo = options.targetInfo;
    const target = tInfo.targetAmount;
    const periodText = tInfo.periodSuffix || '';
    const pct = tInfo.progressPct ?? Math.round((totalAmount / target) * 100);
    const clampedPct = Math.min(pct, 100);
    const isDone = totalAmount >= target;
    const remaining = Math.max(0, target - totalAmount);
    const surplus = Math.max(0, totalAmount - target);

    targetSummaryHtml = `
      <div style="background: #f8fafc; border: 1.5px solid #818cf8; border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 10.5px; font-weight: 900; color: #312e81; text-transform: uppercase; letter-spacing: 0.3px;">🎯 TARGET & COLLECTION PROGRESS</span>
            <span style="font-size: 8.5px; font-weight: bold; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 4px;">${tInfo.periodLabel || 'Target Goal'}</span>
          </div>
          <div style="font-size: 11px; font-weight: 900; color: ${isDone ? '#047857' : '#4338ca'};">
            ${pct}% Tling Tawh ${isDone ? '🎉 (Achieved)' : ''}
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 5px; color: #334155;">
          <span>🎯 Target Goal: <b style="color: #0f172a;">₹${target.toLocaleString('en-IN')}${periodText}</b></span>
          <span>📈 Pek Tling Zat: <b style="color: #047857;">₹${totalAmount.toLocaleString('en-IN')}</b> (${pct}%)</span>
          <span>${isDone ? `🎉 A chuang: <b style="color: #047857;">+₹${surplus.toLocaleString('en-IN')}</b>` : `⏳ Mamawh Baki: <b style="color: #b45309;">₹${remaining.toLocaleString('en-IN')}</b>`}</span>
        </div>

        <div style="width: 100%; height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden; border: 1px solid #cbd5e1;">
          <div style="width: ${clampedPct}%; height: 100%; background: ${isDone ? '#10b981' : '#4f46e5'}; border-radius: 3px;"></div>
        </div>
      </div>
    `;
  }

  // Build Monthly Chart HTML if requested
  let monthlyChartHtml = '';
  if (options.includeMonthlyChart !== false) {
    const { months, monthTotals, maxVal } = computeMonthlyDistribution(transactions, options.monthRangeConfig);
    
    const isSingleMonth = months.length === 1;
    const chartBars = months.map(m => {
      const val = monthTotals[m] || 0;
      // Calculate proportional height (min 6px, max 44px)
      const heightPx = val > 0 ? Math.max(12, Math.round((val / maxVal) * 44)) : 4;
      const isHigh = val > 0;
      const barWidth = isSingleMonth ? 28 : (months.length <= 3 ? 18 : 10);
      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 58px; flex: ${isSingleMonth ? '0 0 auto' : '1'}; min-width: 14px; padding: 0 4px;">
          <span style="font-size: 7px; color: #fef08a; margin-bottom: 2px; font-weight: bold;">₹${val > 999 ? (val/1000).toFixed(1) + 'k' : val}</span>
          <div style="width: ${barWidth}px; height: ${heightPx}px; background-color: ${isHigh ? '#ef4444' : '#334155'}; border: 1px solid ${isHigh ? '#f87171' : '#475569'}; border-radius: 3px 3px 0 0;"></div>
          <span style="font-size: 8px; color: ${isHigh ? '#fca5a5' : '#94a3b8'}; margin-top: 3px; font-weight: bold; text-transform: uppercase;">${m}</span>
        </div>
      `;
    }).join('');

    monthlyChartHtml = `
      <div class="chart-container" style="${isSingleMonth ? 'width: 140px;' : (months.length <= 4 ? 'width: 170px;' : 'width: 230px;')}">
        <div class="chart-title-box">
          <span class="chart-title">MONTHLY TREND</span>
        </div>
        <div class="chart-bars-wrap" style="${isSingleMonth ? 'justify-content: center;' : ''}">
          ${chartBars}
        </div>
      </div>
    `;
  }

  // Header Avatar Box HTML (Rounded with golden border)
  const avatarHtml = imageUrl 
    ? `<img src="${imageUrl}" class="header-avatar" alt="Logo" />`
    : `<div class="header-avatar-fallback">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
          <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
          <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
        </svg>
      </div>`;

  // Signature Block HTML
  let signatureBlockHtml = '';
  if (options.includeSignatures !== false) {
    signatureBlockHtml = `
      <div class="sign-grid">
        <div class="sign-box">
          <div class="sign-label">${options.preparedByTitle || 'Prepared by (Recorder / Collector)'}</div>
          <div class="sign-subtext">${creatorDisplay}</div>
          <div class="digital-seal">✓ Digitally Verified by RonPay</div>
        </div>
        <div class="sign-box">
          <div class="sign-label">${options.verifiedByTitle || 'Verified by (Treasurer / Finance)'}</div>
          <div class="sign-subtext">Signature & Seal</div>
        </div>
        <div class="sign-box">
          <div class="sign-label">${options.approvedByTitle || 'Approved by (Secretary / Leader)'}</div>
          <div class="sign-subtext">Signature & Date</div>
        </div>
      </div>
    `;
  }

  // Common Print CSS Styles
  const sharedPrintStyles = `
    @page { 
      size: auto; 
      margin: 12mm 10mm 12mm 10mm; 
    }
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
      color: #1e293b; 
      margin: 0; 
      padding: 16px; 
      font-size: 11px; 
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    /* Enhanced Top Header Banner (Only on first page) */
    .header-banner {
      background: linear-gradient(135deg, #090e1a 0%, #111827 50%, #1e1b4b 100%);
      border: 1.5px solid #312e81;
      border-radius: 18px;
      padding: 16px 20px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      page-break-after: avoid;
      break-after: avoid;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .header-left-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
      flex: 1;
    }
    .header-avatar {
      width: 84px;
      height: 84px;
      border-radius: 16px;
      object-fit: cover;
      border: 2.5px solid #f59e0b;
      box-shadow: 0 4px 10px rgba(0,0,0,0.4);
      flex-shrink: 0;
    }
    .header-avatar-fallback {
      width: 84px;
      height: 84px;
      border-radius: 16px;
      background-color: #1e293b;
      border: 2.5px solid #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .header-content-stack {
      display: flex;
      flex-direction: column;
      gap: 2.5px;
      min-width: 0;
      flex: 1;
    }
    .org-title {
      font-size: 21px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.3px;
      margin: 0;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .location-text {
      font-size: 13px;
      font-weight: 700;
      color: #fbbf24;
      display: flex;
      align-items: center;
      gap: 4px;
      margin: 0;
      line-height: 1.25;
    }
    .doc-badge-title {
      font-size: 12px;
      font-weight: 800;
      color: #38bdf8;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      margin: 0;
      line-height: 1.25;
    }
    .period-text {
      font-size: 11px;
      font-weight: 600;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 4px;
      margin: 0;
      line-height: 1.25;
    }

    /* Right Chart Container */
    .chart-container {
      border: 1.5px solid #ef4444;
      border-radius: 12px;
      padding: 8px 12px;
      background: rgba(15, 23, 42, 0.7);
      width: 230px;
      flex-shrink: 0;
    }
    .chart-title-box {
      display: flex;
      flex-direction: column;
      border-bottom: 1px dashed rgba(239, 68, 68, 0.4);
      padding-bottom: 3px;
      margin-bottom: 6px;
    }
    .chart-title {
      font-size: 8.5px;
      font-weight: 900;
      color: #f87171;
      letter-spacing: 0.5px;
    }
    .chart-bars-wrap {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 58px;
      overflow-x: auto;
    }

    /* Table Styles */
    table { 
      width: 100%; 
      border-collapse: collapse; 
      text-align: left; 
      font-size: 11px; 
      margin-top: 10px; 
    }
    thead th {
      background: #1e1b4b;
      color: #ffffff;
      padding: 10px 12px;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
    }
    .total-row {
      background: #e2e8f0;
      font-weight: 900;
    }

    /* Prevent header row repeating on subsequent pages */
    thead {
      display: table-row-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    tfoot {
      display: table-row-group !important;
    }

    /* Signature Blocks */
    .sign-grid {
      margin-top: 40px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sign-box {
      border-top: 1.5px dashed #64748b;
      padding-top: 8px;
    }
    .sign-label {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
    }
    .sign-subtext {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 2px;
    }
    .digital-seal {
      font-size: 8.5px;
      font-weight: bold;
      color: #4338ca;
      margin-top: 4px;
      display: inline-block;
      background: #e0e7ff;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .footer {
      margin-top: 30px;
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      font-size: 9px;
      color: #64748b;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    @media print {
      body { padding: 0; }
      .header-banner { margin-top: 0; }
      thead { display: table-row-group !important; }
    }
  `;

  // If Kumtluang Bawm, format matrix table: Sl No | Hming | Mode | Cat 1 | Cat 2 | ... | Total
  if (isKumtluang) {
    const matrix = buildKumtluangMatrix(transactions, sortOrder);
    const matrixHeaderThs = matrix.categories.map(c => `<th style="text-align: right; padding: 9px 12px; font-weight: 800;">${c.toUpperCase()}</th>`).join('');
    
    const matrixRowsHtml = matrix.rows.map((r, idx) => {
      const modeBadge = r.paymentMethodLabel === 'CASH'
        ? `<span style="background: #fef3c7; color: #92400e; font-weight: bold; font-size: 8.5px; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a;">💵 CASH</span>`
        : r.paymentMethodLabel === 'ONLINE'
        ? `<span style="background: #e0e7ff; color: #3730a3; font-weight: bold; font-size: 8.5px; padding: 2px 6px; border-radius: 4px; border: 1px solid #c7d2fe;">⚡ ONLINE</span>`
        : `<span style="background: #f1f5f9; color: #0f172a; font-weight: bold; font-size: 8.5px; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">⚡+💵 MIXED</span>`;

      return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #64748b; text-align: center; width: 45px;">${idx + 1}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a;">${r.donorName}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; width: 85px;">${modeBadge}</td>
        ${matrix.categories.map(c => `
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: ${r.categoryAmounts[c] > 0 ? '#0f172a' : '#94a3b8'};">
            ${r.categoryAmounts[c] > 0 ? `₹${r.categoryAmounts[c].toLocaleString('en-IN')}` : '-'}
          </td>
        `).join('')}
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 900; color: #4338ca; background-color: #f1f5f9;">
          ₹${r.total.toLocaleString('en-IN')}
        </td>
      </tr>
    `;
    }).join('');

    const matrixFooterTds = matrix.categories.map(c => `
      <td style="text-align: right; padding: 11px 12px; font-weight: 900; color: #047857; border-top: 2px solid #0f172a; font-size: 12px;">
        ₹${matrix.columnTotals[c].toLocaleString('en-IN')}
      </td>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${orgDisplay} - Financial Statement</title>
          <meta charset="utf-8" />
          <style>${sharedPrintStyles}</style>
        </head>
        <body>
          <!-- Top Header Banner with Creator Photo and 4-line Information Hierarchy -->
          <div class="header-banner">
            <div class="header-left-wrap">
              ${avatarHtml}
              <div class="header-content-stack">
                <h1 class="org-title">${orgDisplay}</h1>
                <div class="location-text">📍 ${locationDisplay}</div>
                <div class="doc-badge-title">Reports & Financial Statements</div>
                <div class="period-text">Trxn Date: <b>${dateRangeText}</b></div>
              </div>
            </div>
            ${monthlyChartHtml}
          </div>

          ${collectionSummaryBarHtml}

          ${targetSummaryHtml}

          <!-- Main Table -->
          <table>
            <thead>
              <tr>
                <th style="width: 45px; text-align: center;">SL NO.</th>
                <th style="padding: 10px 12px;">HMING (DONOR)</th>
                <th style="width: 85px; text-align: center;">MODE</th>
                ${matrixHeaderThs}
                <th style="text-align: right; padding: 10px 12px; background: #312e81;">TOTAL (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${matrixRowsHtml}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" style="padding: 11px 12px; font-weight: 900; color: #1e1b4b; border-top: 2px solid #0f172a; font-size: 12px;">GRAND TOTAL</td>
                ${matrixFooterTds}
                <td style="text-align: right; padding: 11px 12px; font-weight: 900; color: #047857; border-top: 2px solid #0f172a; font-size: 13px; background-color: #dcfce7;">
                  ₹${matrix.grandTotal.toLocaleString('en-IN')}
                </td>
              </tr>
            </tfoot>
          </table>

          ${signatureBlockHtml}

          <div class="footer">
            <span>${orgDisplay} • Official Financial Statement</span>
            <span>Generated Date: ${formatDateDDMMYYYY(new Date())}</span>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
    return;
  }

  // Standard itemized report for Ralna, Khawlsak, Rikrum, etc.
  const rowsHtml = transactions.map((t, idx) => {
    const isCash = t.paymentMethod.toLowerCase().includes('cash');
    const paymentBadge = isCash
      ? `<span style="background: #fef3c7; color: #92400e; font-weight: bold; font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid #fde68a;">💵 CASH</span>`
      : `<span style="background: #e0e7ff; color: #3730a3; font-weight: bold; font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid #c7d2fe;">⚡ ONLINE</span>`;

    let remarks = t.periodLabel || '';
    if (t.remark && t.remark.trim()) {
      remarks = remarks ? `${remarks} • Note: ${t.remark.trim()}` : t.remark.trim();
    }
    if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
      const parts = Object.entries(t.subCategoryBreakdown).map(([k, v]) => `${k}: ₹${v}`);
      remarks = remarks ? `${remarks} (${parts.join(', ')})` : parts.join(', ');
    }

    return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #64748b; text-align: center; width: 45px;">${idx + 1}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; font-family: monospace;">${formatDateTimeDDMMYYYY(t.timestamp)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; font-size: 11px; color: #0f172a;">${t.isAnonymous ? '<i>Anonymous</i>' : t.donorName}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; text-align: center;">${paymentBadge}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 10.5px; color: #334155;">${remarks || '-'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 9.5px; color: #64748b;">${t.txHash || t.id.slice(0, 12)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; font-size: 11px; color: #0f172a;">₹${t.amount.toLocaleString('en-IN')}</td>
      </tr>
    `;
  }).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${orgDisplay} - Financial Statement</title>
        <meta charset="utf-8" />
        <style>${sharedPrintStyles}</style>
      </head>
      <body>
        <!-- Top Header Banner with Creator Photo and 4-line Information Hierarchy -->
        <div class="header-banner">
          <div class="header-left-wrap">
            ${avatarHtml}
            <div class="header-content-stack">
              <h1 class="org-title">${orgDisplay}</h1>
              <div class="location-text">📍 ${locationDisplay}</div>
              <div class="doc-badge-title">Reports & Financial Statements</div>
              <div class="period-text">Trxn Date: <b>${dateRangeText}</b></div>
            </div>
          </div>
          ${monthlyChartHtml}
        </div>

        ${collectionSummaryBarHtml}

        ${targetSummaryHtml}

        <table>
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">SL NO.</th>
              <th>DATE & TIME</th>
              <th>HMING (DONOR)</th>
              <th style="text-align: center;">PAYMENT MODE</th>
              <th>REMARKS / NOTE</th>
              <th>REFERENCE / HASH</th>
              <th style="text-align: right;">AMOUNT (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="6" style="padding: 11px 12px; border-top: 2px solid #0f172a; font-size: 12px; color: #1e1b4b;">GRAND TOTAL COLLECTION</td>
              <td style="padding: 11px 12px; border-top: 2px solid #0f172a; text-align: right; font-size: 13px; color: #047857; background: #dcfce7;">
                ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        ${signatureBlockHtml}

        <div class="footer">
          <span>${orgDisplay} • Official Financial Statement</span>
          <span>Generated Date: ${formatDateDDMMYYYY(new Date())}</span>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

