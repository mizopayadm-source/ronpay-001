import { Transaction, MemberRecord, Campaign } from '../types';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from './date';
import { getTransactionMonthInfo } from './monthHelper';
import { getMembers, getStoredCampaigns } from './storage';

export interface MatrixRow {
  donorName: string;
  categoryAmounts: { [category: string]: number };
  total: number;
  isAnonymous?: boolean;
  donorType?: 'member' | 'group' | 'general';
  groupName?: string;
  section?: string;
  paymentMethods: ('online' | 'cash')[];
  paymentMethodLabel: 'ONLINE' | 'CASH' | 'ONLINE + CASH';
  remarks?: string[];
  transactionIds?: string[];
  transactions?: Transaction[];
  memberId?: string;
  phone?: string;
}

export interface KumtluangMatrixData {
  categories: string[];
  rows: MatrixRow[];
  columnTotals: { [category: string]: number };
  grandTotal: number;
  onlineTotal: number;
  cashTotal: number;
  memberRows: MatrixRow[];
  groupRows: MatrixRow[];
  generalRows: MatrixRow[];
  memberTotal: number;
  groupTotal: number;
  generalTotal: number;
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
 * Universal safe print trigger that opens the high-resolution Print Preview screen.
 * Dispatches the event so users can inspect, review, zoom, and decide when to trigger printing.
 */
export const printHtmlSafely = (
  html: string, 
  docTitle: string = 'Print Document',
  fileName?: string
) => {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('ronpay-open-print-modal', {
        detail: { html, docTitle, fileName }
      }));
    } catch (e) {
      console.warn('Print modal event dispatch failed', e);
    }
  }
};

/**
 * Universal File Download & Share helper:
 * 1. Checks if Web Share API (navigator.share) is available with files on Mobile / Android WebViews.
 * 2. Fallback to standard Blob URL & <a> download click.
 * 3. Fallback to Base64 Data URI for WebViews without Blob download support.
 */
export const downloadFileUniversal = async (
  content: string | Blob,
  fileName: string,
  mimeType: string,
  title: string = 'RonPay Report'
): Promise<boolean> => {
  try {
    // Check for Native Android Bridge (MainActivity.java: RonPayBridge / AndroidBlobDownloader)
    const bridge = typeof window !== 'undefined'
      ? ((window as any).RonPayBridge || (window as any).AndroidBlobDownloader || (window as any).AndroidDownloader)
      : null;

    if (bridge?.getBase64FromBlobData) {
      try {
        let base64 = '';
        if (typeof content === 'string') {
          if (content.startsWith('data:')) {
            base64 = content;
          } else {
            const bytes = new TextEncoder().encode(content);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
            }
            base64 = btoa(binary);
          }
        } else if (content instanceof Blob) {
          const arrayBuf = await content.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuf);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
          }
          base64 = btoa(binary);
        }

        if (base64) {
          bridge.getBase64FromBlobData(base64, mimeType, fileName);
          return true;
        }
      } catch (bridgeErr) {
        console.warn('RonPayBridge download error in downloadFileUniversal:', bridgeErr);
      }
    }

    const blob = content instanceof Blob 
      ? content 
      : new Blob([mimeType.includes('charset') ? '\uFEFF' + content : content], { type: mimeType });

    // Method 1: Standard Blob Object URL download (Fastest and universal for Desktop Chrome/Edge/Firefox & Mobile)
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch {}
      }, 2000);
      return true;
    } catch (blobErr) {
      console.warn('Direct Blob anchor download error, trying server relay fallback:', blobErr);
    }

    // Method 2: Server download relay fallback for Android WebViews where Blob URLs are blocked
    try {
      if (typeof fetch !== 'undefined') {
        let base64 = '';
        let textContent = '';
        if (content instanceof Blob) {
          const arrayBuf = await content.arrayBuffer();
          const uint8 = new Uint8Array(arrayBuf);
          let binary = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, Array.from(uint8.subarray(i, i + chunkSize)));
          }
          base64 = btoa(binary);
        } else {
          textContent = content;
        }

        const resp = await fetch('/api/prepare-download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data: base64 || undefined,
            textContent: textContent || undefined,
            fileName,
            mimeType
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.downloadUrl) {
            const serverDownloadUrl = new URL(data.downloadUrl, window.location.origin).href;
            if (bridge?.openInExternalBrowser) {
              bridge.openInExternalBrowser(serverDownloadUrl);
              return true;
            }
            const a = document.createElement('a');
            a.href = serverDownloadUrl;
            a.download = fileName;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              try { document.body.removeChild(a); } catch {}
            }, 1500);
            return true;
          }
        }
      }
    } catch (relayErr) {
      console.warn('Server download relay error:', relayErr);
    }

    return false;
  } catch (err) {
    console.error('downloadFileUniversal error:', err);
    return false;
  }
};

/**
 * Returns the ordered array of month abbreviations for a given From - Upto month configuration.
 * Default is calendar year: Jan to Dec.
 */
export const getMonthsListForConfig = (config?: MonthRangeConfig): string[] => {
  const start = config?.startMonth || 'Jan';
  const end = config?.endMonth || 'Dec';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const sIdx = months.indexOf(start);
  const eIdx = months.indexOf(end);
  if (sIdx === -1 || eIdx === -1) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  campaign?: Campaign | null
): KumtluangMatrixData => {
  // If campaign is not explicitly provided, attempt to resolve it from the transactions
  let activeCampaign = campaign;
  if (!activeCampaign && transactions.length > 0) {
    try {
      const allCamps = getStoredCampaigns();
      const firstCampId = transactions[0]?.campaignId;
      if (firstCampId && transactions.every(t => t.campaignId === firstCampId)) {
        activeCampaign = allCamps.find(c => c.id === firstCampId) || null;
      }
    } catch (e) {}
  }

  // Predefined sub-categories configured specifically for this campaign / Bawm
  let predefinedSubCats: string[] = Array.isArray(activeCampaign?.subCategories) && activeCampaign.subCategories.length > 0
    ? (activeCampaign.subCategories.map(s => s?.trim()).filter(Boolean) as string[])
    : [];

  // Canonical heads ONLY for the specific canonical campaign (BMP Shillong) if needed
  predefinedSubCats = predefinedSubCats.map(s => s === 'Inkhawm Thawhlawm' ? 'Group' : s);

  if (activeCampaign?.id === 'cmp-1788107291420' || (!activeCampaign && transactions.some(t => t.campaignId === 'cmp-1788107291420'))) {
    if (!predefinedSubCats.includes('BMP Fund')) predefinedSubCats.unshift('BMP Fund');
    if (!predefinedSubCats.includes('General')) {
      const bmpIdx = predefinedSubCats.indexOf('BMP Fund');
      predefinedSubCats.splice(bmpIdx + 1, 0, 'General');
    }
    if (!predefinedSubCats.includes('Group')) {
      predefinedSubCats.push('Group');
    }
    predefinedSubCats = predefinedSubCats.filter(s => s !== 'Inkhawm Thawhlawm');
  } else if (predefinedSubCats.includes('BMP Fund') && !predefinedSubCats.includes('General')) {
    const bmpIdx = predefinedSubCats.indexOf('BMP Fund');
    predefinedSubCats.splice(bmpIdx + 1, 0, 'General');
    if (!predefinedSubCats.includes('Group')) {
      predefinedSubCats.push('Group');
    }
    predefinedSubCats = predefinedSubCats.filter(s => s !== 'Inkhawm Thawhlawm');
  }

  // If viewing across multiple campaigns without a single selected campaign:
  if (predefinedSubCats.length === 0 && transactions.length > 0) {
    try {
      const allCamps = getStoredCampaigns();
      const campIdSet = new Set(transactions.map(t => t.campaignId).filter(Boolean));
      const involvedCamps = allCamps.filter(c => campIdSet.has(c.id));
      involvedCamps.forEach(c => {
        if (Array.isArray(c.subCategories)) {
          c.subCategories.forEach(sc => {
            const clean = sc?.trim();
            if (clean && !predefinedSubCats.includes(clean)) {
              predefinedSubCats.push(clean);
            }
          });
        }
      });
    } catch (e) {}
  }

  const categorySet = new Set<string>();
  const donorMap = new Map<string, { [cat: string]: number }>();
  const donorPaymentMethods = new Map<string, Set<'online' | 'cash'>>();
  const donorRemarks = new Map<string, string[]>();
  const donorTypeMap = new Map<string, 'member' | 'group' | 'general'>();
  const donorGroupNameMap = new Map<string, string>();
  const donorSectionMap = new Map<string, string>();
  const donorTransactionsMap = new Map<string, Transaction[]>();
  const donorMemberIdMap = new Map<string, string>();
  const donorPhoneMap = new Map<string, string>();

  let onlineTotal = 0;
  let cashTotal = 0;

  // 1. Strictly register official Fund Heads configured for this campaign
  predefinedSubCats.forEach(sc => {
    categorySet.add(sc);
  });

  // Build canonical member name resolution map to merge any slight discrepancies or partial names
  const memberNameMap = new Map<string, string>();
  const memberSectionMap = new Map<string, string>();
  const registeredMemberNames: string[] = [];
  try {
    const mems = getMembers(activeCampaign?.id);
    mems.forEach(m => {
      if (m && m.name) {
        const cName = m.name.trim();
        if (m.id) {
          memberNameMap.set(m.id.toLowerCase().trim(), cName);
          if (m.section) memberSectionMap.set(m.id.toLowerCase().trim(), m.section.trim());
        }
        if (m.section) {
          memberSectionMap.set(cName.toLowerCase(), m.section.trim());
        }
        registeredMemberNames.push(cName);
      }
    });
  } catch (e) {}

  transactions.forEach(t => {
    let donor = t.isAnonymous ? 'Anonymous' : (t.donorName || 'Unknown Donor');

    // Determine donor type (strictly isolate Member vs Group vs General)
    const resolvedType: 'member' | 'group' | 'general' = 
      t.donorType === 'group' || (t.groupName && t.groupName.trim().length > 0)
        ? 'group'
        : t.donorType === 'general'
        ? 'general'
        : 'member';

    // 1. Strict memberId lookup (e.g. BMPSHL-1739 -> Upa Thawngphena Tuallawt) - Only for member type!
    if (!t.isAnonymous && t.memberId && resolvedType === 'member') {
      const canonicalName = memberNameMap.get(t.memberId.toLowerCase().trim());
      if (canonicalName) {
        donor = canonicalName;
      }
    }

    // 2. Fuzzy / Partial Name Security Guard: only for member type
    if (!t.isAnonymous && donor !== 'Unknown Donor' && resolvedType === 'member') {
      const donorNorm = donor.toLowerCase().trim();
      for (const canonical of registeredMemberNames) {
        const canNorm = canonical.toLowerCase().trim();
        if (canNorm === donorNorm) {
          donor = canonical;
          break;
        }
        if (canNorm.startsWith(donorNorm + ' ') || canNorm.endsWith(' ' + donorNorm)) {
          donor = canonical;
          break;
        }
      }
    }

    if (!donorTypeMap.has(donor)) {
      donorTypeMap.set(donor, resolvedType);
    }
    if (t.groupName && !donorGroupNameMap.has(donor)) {
      donorGroupNameMap.set(donor, t.groupName);
    }
    
    // Resolve section or unit accurately
    const isBmpTx = t.campaignId === 'cmp-1788107291420' || 
      String(t.campaignTitle || '').toLowerCase().includes('bmp') || 
      String(t.campaignTitle || '').toLowerCase().includes('shillong') || 
      String(t.memberId || '').startsWith('BMPSHL-') ||
      activeCampaign?.id === 'cmp-1788107291420' ||
      String(activeCampaign?.title || '').toLowerCase().includes('bmp');

    let resolvedSection = t.donorVeng;
    if (t.memberId && memberSectionMap.has(t.memberId.toLowerCase().trim())) {
      resolvedSection = memberSectionMap.get(t.memberId.toLowerCase().trim());
    } else if (memberSectionMap.has(donor.toLowerCase().trim())) {
      resolvedSection = memberSectionMap.get(donor.toLowerCase().trim());
    }

    if (isBmpTx) {
      if (!resolvedSection || resolvedSection === 'Section A' || resolvedSection === 'Section B' || resolvedSection === 'Section C' || resolvedSection === 'Section D' || resolvedSection === 'Bial 1 (Vengchhak)' || resolvedSection === 'Shillong') {
        resolvedSection = 'Shillong Unit';
      }
    }

    if (resolvedSection && !donorSectionMap.has(donor)) {
      donorSectionMap.set(donor, resolvedSection);
    }

    if (!donorTransactionsMap.has(donor)) {
      donorTransactionsMap.set(donor, []);
    }
    donorTransactionsMap.get(donor)!.push(t);

    if (t.memberId && !donorMemberIdMap.has(donor)) {
      donorMemberIdMap.set(donor, t.memberId);
    }
    if (t.donorPhone && !donorPhoneMap.has(donor)) {
      donorPhoneMap.set(donor, t.donorPhone);
    }

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

    const donorLower = (t.donorName || '').toLowerCase().trim();
    const isDonorInkhawm = 
      donorLower.includes('inkhawm') || 
      donorLower.includes('inkawm') || 
      (t.subCategory && (t.subCategory.toLowerCase().includes('inkhawm') || t.subCategory.toLowerCase().includes('inkawm')));

    // Strict Campaign-Category Isolation:
    // If the campaign has predefined categories (e.g. Vengthar YMA has ['Chhiatni Fund']):
    // All contributions for this Bawm MUST strictly be attributed to this Bawm's own categories.
    // Under NO circumstances may foreign categories leak in.
    if (predefinedSubCats.length === 1) {
      // Single category Bawm: 100% of funds belong to this specific single category!
      const targetCat = predefinedSubCats[0];
      categorySet.add(targetCat);
      donorCats[targetCat] = (donorCats[targetCat] || 0) + t.amount;
    } else if (predefinedSubCats.length > 1) {
      // Multi-category Bawm: allocate strictly among the campaign's declared categories
      const officialNormMap = new Map<string, string>();
      predefinedSubCats.forEach(sc => officialNormMap.set(sc.toLowerCase().trim(), sc));

      let allocatedAmt = 0;
      if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
        Object.entries(t.subCategoryBreakdown).forEach(([catKey, val]) => {
          const num = Number(val) || 0;
          if (num > 0) {
            const cleanKey = catKey.trim().toLowerCase();
            let matchedOfficial = officialNormMap.get(cleanKey);
            if (!matchedOfficial) {
              matchedOfficial = predefinedSubCats.find(sc => {
                const scLower = sc.toLowerCase();
                return scLower === cleanKey || scLower.includes(cleanKey) || cleanKey.includes(scLower);
              });
            }
            if (!matchedOfficial && predefinedSubCats.includes('General')) {
              if (cleanKey.includes('general') || cleanKey.includes('inkhawm') || cleanKey.includes('thawhlawm') || cleanKey.includes('hnathlang') || cleanKey.includes('contribution') || resolvedType === 'general' || t.donorType === 'general') {
                matchedOfficial = 'General';
              }
            }
            if (!matchedOfficial && predefinedSubCats.includes('Group')) {
              if (cleanKey.includes('group') || resolvedType === 'group' || t.donorType === 'group' || (t.groupName && t.groupName.trim().length > 0)) {
                matchedOfficial = 'Group';
              }
            }
            if (matchedOfficial) {
              const actualAdd = t.amount > 0 ? Math.min(num, Math.max(0, t.amount - allocatedAmt)) : num;
              if (actualAdd > 0) {
                categorySet.add(matchedOfficial);
                donorCats[matchedOfficial] = (donorCats[matchedOfficial] || 0) + actualAdd;
                allocatedAmt += actualAdd;
              }
            }
          }
        });
      }

      // If breakdown was missing or did not fully allocate transaction amount:
      if (allocatedAmt < t.amount) {
        const remainingAmt = t.amount - allocatedAmt;
        let resolvedSubCat: string | undefined = undefined;

        if (t.subCategory && t.subCategory.trim()) {
          const cleanSub = t.subCategory.trim().toLowerCase();
          resolvedSubCat = officialNormMap.get(cleanSub) || predefinedSubCats.find(sc => {
            const scLower = sc.toLowerCase();
            return scLower === cleanSub || scLower.includes(cleanSub) || cleanSub.includes(scLower);
          });
        }

        if (!resolvedSubCat && t.remark) {
          const bracketMatch = t.remark.match(/\[(.*?)\]/);
          if (bracketMatch && bracketMatch[1]?.trim()) {
            const bClean = bracketMatch[1].trim().toLowerCase();
            resolvedSubCat = officialNormMap.get(bClean) || predefinedSubCats.find(sc => {
              const scLower = sc.toLowerCase();
              return scLower === bClean || scLower.includes(bClean) || bClean.includes(scLower);
            });
          }
        }

        const isGroupOffering = 
          resolvedType === 'group' ||
          t.donorType === 'group' ||
          (t.groupName && t.groupName.trim().length > 0) ||
          (t.subCategory && t.subCategory.toLowerCase().includes('group'));

        if (!resolvedSubCat && isGroupOffering && predefinedSubCats.includes('Group')) {
          resolvedSubCat = 'Group';
        }

        const isGeneralOffering = 
          resolvedType === 'general' ||
          t.donorType === 'general' ||
          isDonorInkhawm ||
          (t.subCategory && (
            t.subCategory.toLowerCase().includes('general') ||
            t.subCategory.toLowerCase().includes('thawhlawm') ||
            t.subCategory.toLowerCase().includes('hnathlang') ||
            t.subCategory.toLowerCase().includes('contribution')
          ));

        if (!resolvedSubCat && isGeneralOffering && predefinedSubCats.includes('General')) {
          resolvedSubCat = 'General';
        }

        if (!resolvedSubCat && isDonorInkhawm && predefinedSubCats.includes('Inkhawm Thawhlawm')) {
          resolvedSubCat = 'Inkhawm Thawhlawm';
        }

        if (!resolvedSubCat) {
          resolvedSubCat = predefinedSubCats[0];
        }

        categorySet.add(resolvedSubCat);
        donorCats[resolvedSubCat] = (donorCats[resolvedSubCat] || 0) + remainingAmt;
      }
    } else {
      // General dynamic fallback ONLY when no predefined categories exist anywhere
      let hasBreakdown = false;
      if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
        Object.entries(t.subCategoryBreakdown).forEach(([cat, amt]) => {
          let cleanCat = cat.trim();
          const numAmt = Number(amt) || 0;
          if (numAmt > 0) {
            categorySet.add(cleanCat);
            donorCats[cleanCat] = (donorCats[cleanCat] || 0) + numAmt;
            hasBreakdown = true;
          }
        });
      }

      if (!hasBreakdown) {
        let resolvedSubCat = t.subCategory?.trim();
        if (!resolvedSubCat && t.remark) {
          const bracketMatch = t.remark.match(/\[(.*?)\]/);
          if (bracketMatch && bracketMatch[1]?.trim()) {
            resolvedSubCat = bracketMatch[1].trim();
          }
        }
        if (!resolvedSubCat) {
          resolvedSubCat = 'Thawhlawm';
        }
        categorySet.add(resolvedSubCat);
        donorCats[resolvedSubCat] = (donorCats[resolvedSubCat] || 0) + t.amount;
      }
    }
  });

  // Include predefined campaign categories (strictly preserving order: BMP Fund, General, Group, etc.)
  let categories: string[] = [];
  if (predefinedSubCats.length > 0) {
    const combined = new Set<string>();
    predefinedSubCats.forEach(c => {
      if (c && c.trim()) {
        const clean = c.trim() === 'Inkhawm Thawhlawm' ? 'Group' : c.trim();
        combined.add(clean);
      }
    });
    categorySet.forEach(c => {
      if (c && c.trim()) {
        const clean = c.trim() === 'Inkhawm Thawhlawm' ? 'Group' : c.trim();
        combined.add(clean);
      }
    });
    categories = Array.from(combined).filter(c => c !== 'Inkhawm Thawhlawm');
  } else {
    categories = Array.from(categorySet).map(c => c === 'Inkhawm Thawhlawm' ? 'Group' : c).filter(Boolean);
    if (categories.length === 0) {
      categories = ['Thawhlawm'];
    }
  }

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

    const dType = donorTypeMap.get(donorName) || 'member';
    const txList = donorTransactionsMap.get(donorName) || [];
    const txIds = txList.map(t => t.id).filter(Boolean);
    const mId = donorMemberIdMap.get(donorName);
    const dPhone = donorPhoneMap.get(donorName);

    rows.push({
      donorName,
      categoryAmounts: cleanCatAmounts,
      total: rowTotal,
      donorType: dType,
      groupName: donorGroupNameMap.get(donorName),
      section: donorSectionMap.get(donorName),
      paymentMethods: methodsArr,
      paymentMethodLabel: methodLabel,
      remarks: remarksList && remarksList.length > 0 ? remarksList : undefined,
      transactionIds: txIds,
      transactions: txList,
      memberId: mId,
      phone: dPhone,
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

  // Pre-calculate segregated sub-collections so Mimal, Group, and General are strictly isolated
  const memberRows = rows.filter(r => r.donorType === 'member');
  const groupRows = rows.filter(r => r.donorType === 'group');
  const generalRows = rows.filter(r => r.donorType === 'general');
  const memberTotal = memberRows.reduce((s, r) => s + r.total, 0);
  const groupTotal = groupRows.reduce((s, r) => s + r.total, 0);
  const generalTotal = generalRows.reduce((s, r) => s + r.total, 0);

  return {
    categories,
    rows,
    columnTotals,
    grandTotal,
    onlineTotal,
    cashTotal,
    memberRows,
    groupRows,
    generalRows,
    memberTotal,
    groupTotal,
    generalTotal,
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

  transactions.forEach(t => {
    try {
      const info = getTransactionMonthInfo(t);
      const mName = months.find(m => m.toLowerCase() === info.shortMonth.toLowerCase());
      if (mName && monthTotals[mName] !== undefined) {
        monthTotals[mName] += (t.amount || 0);
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
  targetInfo?: TargetExportInfo,
  campaign?: Campaign | null
) => {
  const orgName = creatorInfo?.orgName?.trim() || (campaignName && campaignName !== 'All Campaigns' ? campaignName : '') || creatorInfo?.name?.trim() || 'RONPAY ORGANIZATION';
  const location = creatorInfo?.address?.trim() || 'Mizoram, India';
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

  const onlineTransactions = transactions.filter(t => t.paymentMethod !== 'cash');
  const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
  const onlineTotal = onlineTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

  let tableContentHtml = '';

  if (isKumtluang) {
    const matrix = buildKumtluangMatrix(transactions, sortOrder, campaign);
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
    const colCount = 8;
    const dataRows = transactions.map((t, idx) => {
      let remarks = t.periodLabel || '';
      if (t.remark && t.remark.trim()) {
        remarks = remarks ? `${remarks} • Note: ${t.remark.trim()}` : t.remark.trim();
      }
      if (t.subCategoryBreakdown && Object.keys(t.subCategoryBreakdown).length > 0) {
        const parts = Object.entries(t.subCategoryBreakdown).map(([k, v]) => `${k}: ${v}`);
        remarks = remarks ? `${remarks} (${parts.join(', ')})` : parts.join(', ');
      }

      const modeText = t.paymentMethod === 'phonepe' ? '⚡ PHONEPE' : t.paymentMethod === 'cash' ? '💵 CASH' : '⚡ ONLINE';
      const recType = t.donorType === 'group' || (Boolean(t.groupName) && t.groupName!.trim().length > 0)
        ? 'GROUP'
        : t.donorType === 'general'
        ? 'GENERAL'
        : 'MIMAL';

      return `
        <tr class="${idx % 2 === 0 ? 'row-even' : 'row-odd'}">
          <td class="cell-center cell-bold">${idx + 1}</td>
          <td class="cell-center cell-date">${formatDateTimeDDMMYYYY(t.timestamp)}</td>
          <td class="cell-left cell-bold">${t.isAnonymous ? 'Anonymous' : t.donorName}</td>
          <td class="cell-center cell-mode ${recType === 'GROUP' ? 'mode-cash' : recType === 'GENERAL' ? 'mode-online' : ''}">${recType}</td>
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
            <th class="header-mode">RECORD TYPE</th>
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
            <td colspan="7" class="cell-grand-label">GRAND TOTAL COLLECTION</td>
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

  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${sanitizedTitle}_${formatDateDDMMYYYY(new Date()).replace(/\//g, '-')}.xls`;
  downloadFileUniversal(excelTemplate, fileName, 'application/vnd.ms-excel;charset=utf-8;', title);
};

export const exportKumtluangMatrixToCSV = (
  transactions: Transaction[], 
  title: string = 'Kumtluang_Bawm_Category_Report',
  campaignName?: string,
  dateRangeText?: string,
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  targetInfo?: TargetExportInfo,
  campaign?: Campaign | null
) => {
  const matrix = buildKumtluangMatrix(transactions, sortOrder, campaign);
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

  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${sanitizedTitle}_${formatDateDDMMYYYY(new Date()).replace(/\//g, '-')}.csv`;
  downloadFileUniversal(csvContent, fileName, 'text/csv;charset=utf-8;', title);
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
  const onlineTransactions = transactions.filter(t => t.paymentMethod !== 'cash');
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

  // Full headers including subcategory and record type details
  const headers = [
    'Transaction ID',
    'Date & Time',
    'Category / Bawm',
    'Campaign Title',
    'Donor Name',
    'Record Type',
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

    const recType = t.donorType === 'group' || (Boolean(t.groupName) && t.groupName!.trim().length > 0)
      ? 'GROUP'
      : t.donorType === 'general'
      ? 'GENERAL'
      : 'MIMAL';

    return [
      `"${t.id}"`,
      `"${formatDateTimeDDMMYYYY(t.timestamp)}"`,
      `"${t.category.toUpperCase()}"`,
      `"${(t.campaignTitle || '').replace(/"/g, '""')}"`,
      `"${(t.isAnonymous ? 'Anonymous' : (t.donorName || '')).replace(/"/g, '""')}"`,
      `"${recType}"`,
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
    '""',
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

  const sanitizedTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${sanitizedTitle}_${formatDateDDMMYYYY(new Date()).replace(/\//g, '-')}.csv`;
  downloadFileUniversal(csvContent, fileName, 'text/csv;charset=utf-8;', title);
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
 * Generates the complete HTML string for the High-Precision PDF Financial Statement.
 */
export const generateTransactionsPDFHtml = (
  transactions: Transaction[], 
  title: string = 'Financial Statement', 
  isKumtluang: boolean = false,
  campaignName: string = 'All Campaigns',
  dateRangeText: string = 'All Time',
  imageUrl?: string,
  sortOrder?: 'date-desc' | 'name-asc' | 'name-desc' | 'amount-desc',
  creatorInfo?: { name: string; orgName: string; phone: string; address?: string },
  options: PDFExportOptions = { includeMonthlyChart: true, includeSignatures: true }
): string => {
  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  const onlineTransactions = transactions.filter(t => t.paymentMethod !== 'cash');
  const cashTransactions = transactions.filter(t => t.paymentMethod === 'cash');
  const onlineTotal = onlineTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

  const rawOrg = creatorInfo?.orgName?.trim();
  const orgDisplay = (rawOrg && rawOrg !== 'RonPay HQ / Master Console') 
    ? rawOrg 
    : (campaignName && campaignName !== 'All Campaigns' ? campaignName : (creatorInfo?.name || 'NGO / Church / Organization'));
  const locationDisplay = creatorInfo?.address?.trim() || 'Mizoram, India';
  const creatorDisplay = creatorInfo ? `${creatorInfo.name} (${creatorInfo.phone || ''})` : 'Authorized Official';

  // Summary bar with breakdown of Online & Cash Collections
  const collectionSummaryBarHtml = `
    <div class="summary-bar" style="width: 100%; display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; page-break-inside: avoid; box-sizing: border-box;">
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
      <div class="target-bar" style="width: 100%; background: #f8fafc; border: 1.5px solid #818cf8; border-radius: 8px; padding: 8px 12px; margin-bottom: 14px; page-break-inside: avoid; box-sizing: border-box;">
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
    
    /* Document Sheet Wrapper to guarantee exact alignment across headers, cards, and tables */
    .statement-sheet {
      width: 100%;
      min-width: 100%;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Enhanced Top Header Banner (Only on first page) */
    .header-banner {
      width: 100%;
      box-sizing: border-box;
      background: linear-gradient(135deg, #090e1a 0%, #111827 50%, #1e1b4b 100%);
      border: 1.5px solid #312e81;
      border-radius: 18px;
      padding: 16px 20px;
      margin-left: 0;
      margin-right: 0;
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

    .summary-bar {
      width: 100%;
      box-sizing: border-box;
      margin-left: 0;
      margin-right: 0;
    }
    .target-bar {
      width: 100%;
      box-sizing: border-box;
      margin-left: 0;
      margin-right: 0;
    }

    /* Table Styles */
    table { 
      width: 100%; 
      box-sizing: border-box;
      border-collapse: collapse; 
      text-align: left; 
      font-size: 11px; 
      margin-top: 10px; 
      margin-left: 0;
      margin-right: 0;
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

    @media screen and (max-width: 640px) {
      body { padding: 8px; font-size: 10px; }
      .header-banner { flex-direction: column; align-items: flex-start; padding: 12px; gap: 10px; }
      .header-avatar { width: 56px; height: 56px; }
      .chart-container { width: 100%; max-width: 100%; }
      .summary-bar { flex-direction: column; gap: 6px; }
      .target-bar { flex-direction: column; gap: 6px; }
      table { font-size: 10px; }
      th, td { padding: 6px 8px !important; }
      .sign-grid { grid-template-columns: 1fr; gap: 14px; margin-top: 24px; }
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
    const catCount = matrix.categories.length;
    const isDense = catCount >= 5;
    const colPad = isDense ? 'padding: 6px 4px;' : 'padding: 8px 10px;';
    const colFontSize = isDense ? 'font-size: 8.5px;' : 'font-size: 9.5px;';
    const colThPad = isDense ? 'padding: 8px 4px;' : 'padding: 10px 10px;';

    const matrixHeaderThs = matrix.categories.map(c => 
      `<th style="text-align: right; ${colThPad} ${colFontSize} font-weight: 800; white-space: normal; word-break: break-word; line-height: 1.15;">${c.toUpperCase()}</th>`
    ).join('');
    
    const matrixRowsHtml = matrix.rows.map((r, idx) => {
      const modeBadge = r.paymentMethodLabel === 'CASH'
        ? `<span style="background: #fef3c7; color: #92400e; font-weight: bold; font-size: ${isDense ? '8px' : '8.5px'}; padding: 2px ${isDense ? '4px' : '6px'}; border-radius: 4px; border: 1px solid #fde68a;">💵 CASH</span>`
        : r.paymentMethodLabel === 'ONLINE'
        ? `<span style="background: #e0e7ff; color: #3730a3; font-weight: bold; font-size: ${isDense ? '8px' : '8.5px'}; padding: 2px ${isDense ? '4px' : '6px'}; border-radius: 4px; border: 1px solid #c7d2fe;">⚡ ONLINE</span>`
        : `<span style="background: #f1f5f9; color: #0f172a; font-weight: bold; font-size: ${isDense ? '8px' : '8.5px'}; padding: 2px ${isDense ? '4px' : '6px'}; border-radius: 4px; border: 1px solid #cbd5e1;">⚡+💵 MIXED</span>`;

      return `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="${isDense ? 'padding: 6px 3px;' : 'padding: 8px 12px;'} border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #64748b; text-align: center; width: ${isDense ? '36px' : '45px'};">${idx + 1}</td>
        <td style="${isDense ? 'padding: 6px 5px; font-size: 10px;' : 'padding: 8px 12px; font-size: 11px;'} border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a; white-space: nowrap;">
          <div>${r.donorName}</div>
          ${r.section ? `<div style="font-size: 8.5px; font-weight: 600; color: #64748b; margin-top: 1px;">${r.section.toLowerCase().includes('unit') ? r.section : `Sec: ${r.section}`}</div>` : ''}
        </td>
        <td style="${isDense ? 'padding: 6px 3px;' : 'padding: 8px 12px;'} border-bottom: 1px solid #e2e8f0; text-align: center; width: ${isDense ? '70px' : '85px'};">${modeBadge}</td>
        ${matrix.categories.map(c => `
          <td style="${colPad} ${colFontSize} border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: ${r.categoryAmounts[c] > 0 ? '#0f172a' : '#94a3b8'};">
            ${r.categoryAmounts[c] > 0 ? `₹${r.categoryAmounts[c].toLocaleString('en-IN')}` : '-'}
          </td>
        `).join('')}
        <td style="${colPad} border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 900; ${colFontSize} color: #4338ca; background-color: #f1f5f9;">
          ₹${r.total.toLocaleString('en-IN')}
        </td>
      </tr>
    `;
    }).join('');

    const matrixFooterTds = matrix.categories.map(c => `
      <td style="text-align: right; ${colPad} font-weight: 900; color: #047857; border-top: 2px solid #0f172a; ${isDense ? 'font-size: 10px;' : 'font-size: 12px;'}">
        ₹${matrix.columnTotals[c].toLocaleString('en-IN')}
      </td>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${orgDisplay} - Financial Statement</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <style>${sharedPrintStyles}</style>
        </head>
        <body>
          <div class="statement-sheet">
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
                  <th style="width: ${isDense ? '36px' : '45px'}; text-align: center; ${colThPad}">SL NO.</th>
                  <th style="${isDense ? 'padding: 8px 6px; font-size: 9px;' : 'padding: 10px 12px;'}">HMING (DONOR)</th>
                  <th style="width: ${isDense ? '70px' : '85px'}; text-align: center; ${colThPad}">MODE</th>
                  ${matrixHeaderThs}
                  <th style="text-align: right; ${colThPad} ${colFontSize} background: #312e81;">TOTAL (₹)</th>
                </tr>
              </thead>
              <tbody>
                ${matrixRowsHtml}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="3" style="${colPad} font-weight: 900; color: #1e1b4b; border-top: 2px solid #0f172a; ${isDense ? 'font-size: 11px;' : 'font-size: 12px;'}">GRAND TOTAL</td>
                  ${matrixFooterTds}
                  <td style="text-align: right; ${colPad} font-weight: 900; color: #047857; border-top: 2px solid #0f172a; ${isDense ? 'font-size: 11.5px;' : 'font-size: 13px;'} background-color: #dcfce7;">
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
          </div>
        </body>
      </html>
    `;
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

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${orgDisplay} - Financial Statement</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>${sharedPrintStyles}</style>
      </head>
      <body>
        <div class="statement-sheet">
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
        </div>
      </body>
    </html>
  `;
};

/**
 * Generates and prints the High-Precision PDF Financial Statement.
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
  const html = generateTransactionsPDFHtml(
    transactions,
    title,
    isKumtluang,
    campaignName,
    dateRangeText,
    imageUrl,
    sortOrder,
    creatorInfo,
    options
  );
  const cleanTarget = (campaignName || creatorInfo?.orgName || 'Financial_Statement')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const fileName = `RonPay_Report_${cleanTarget}.pdf`;
  printHtmlSafely(html, `${campaignName} - ${title}`, fileName);
};

/**
 * Helper to determine if a transaction belongs to a specific Member Record.
 * Matches by:
 * 1. Direct memberId match
 * 2. Remark containing member.id
 * 3. Phone number matching (exact or last 4 digits)
 * 4. Fuzzy name matching (handling accents, punctuation, '& Chhungte', etc.)
 */
export const isTransactionForMember = (t: Transaction, member: MemberRecord): boolean => {
  if (!t || !member) return false;

  // Strict Isolation: Group and General transactions NEVER match individual members
  if (t.donorType === 'group' || t.donorType === 'general' || (t.groupName && t.groupName.trim().length > 0)) {
    return false;
  }

  // Strict Org / Campaign Guard: Prevent cross-campaign contamination (e.g. EBE vs KTL)
  if (t.memberId && member.orgCode) {
    const tPrefix = t.memberId.split('-')[0].toUpperCase();
    const mPrefix = member.orgCode.toUpperCase();
    if (tPrefix && mPrefix && tPrefix !== mPrefix) {
      return false;
    }
  }
  if (t.campaignId && member.campaignId && t.campaignId !== member.campaignId) {
    return false;
  }

  // 1. Direct member ID match
  if (t.memberId && member.id && t.memberId.toLowerCase().trim() === member.id.toLowerCase().trim()) {
    return true;
  }

  // 2. Remark containing Member ID
  if (t.remark && member.id && t.remark.toLowerCase().includes(member.id.toLowerCase().trim())) {
    return true;
  }

  // 3. Phone number match (last 4 digits or full phone)
  if (t.donorPhone && (member.fullPhone || member.phoneLast4)) {
    const cleanTxPhone = t.donorPhone.replace(/\D/g, '');
    const cleanMemPhone = (member.fullPhone || '').replace(/\D/g, '');
    if (cleanTxPhone && cleanMemPhone && cleanTxPhone === cleanMemPhone) {
      return true;
    }
    if (cleanTxPhone.length >= 4 && member.phoneLast4 && cleanTxPhone.endsWith(member.phoneLast4)) {
      return true;
    }
  }

  // 4. Robust Name Match
  if (t.donorName && member.name) {
    const tClean = t.donorName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const mClean = member.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tClean === mClean) return true;
    if (tClean.length > 3 && mClean.length > 3) {
      if (tClean.includes(mClean) || mClean.includes(tClean)) return true;
    }

    // Check primary name without '& Chhungte' / '(Nupui)'
    const tPrimary = t.donorName.split('&')[0].replace(/\([^)]*\)/g, '').trim().toLowerCase();
    const mPrimary = member.name.split('&')[0].replace(/\([^)]*\)/g, '').trim().toLowerCase();
    if (tPrimary && mPrimary && (tPrimary === mPrimary || tPrimary.includes(mPrimary) || mPrimary.includes(tPrimary))) {
      return true;
    }
  }

  return false;
};

/**
 * Extracts category contribution amount from a transaction.
 * Supports subCategoryBreakdown object and direct subCategory/remark matching.
 */
export const getTransactionCategoryAmount = (t: Transaction, category: string): number => {
  if (!t || !category) return 0;
  const targetCatLower = category.toLowerCase().trim();

  // If transaction has detailed multi-category breakdown
  if (t.subCategoryBreakdown && typeof t.subCategoryBreakdown === 'object') {
    // 1. Exact key match
    for (const [key, val] of Object.entries(t.subCategoryBreakdown)) {
      if (key.toLowerCase().trim() === targetCatLower) {
        return Number(val) || 0;
      }
    }
    // 2. Partial key match
    for (const [key, val] of Object.entries(t.subCategoryBreakdown)) {
      const kLower = key.toLowerCase().trim();
      if (kLower.includes(targetCatLower) || targetCatLower.includes(kLower)) {
        return Number(val) || 0;
      }
    }
  }

  // Fallback to single subCategory matching
  if (t.subCategory) {
    const subLower = t.subCategory.toLowerCase().trim();
    if (subLower === targetCatLower || subLower.includes(targetCatLower) || targetCatLower.includes(subLower)) {
      return t.amount || 0;
    }
  }

  // Fallback to remark matching
  if (t.remark) {
    const remarkLower = t.remark.toLowerCase();
    if (remarkLower.includes(targetCatLower)) {
      return t.amount || 0;
    }
  }

  return 0;
};

/**
 * Format 1: Master 12-Month Table HTML Generator
 */
export const generateMasterLedgerPrintHtml = (
  members: MemberRecord[],
  transactions: Transaction[],
  campaignTitle: string,
  orgName: string,
  logoUrl?: string,
  location?: string,
  sortOrder: 'name_asc' | 'name_desc' | 'id_asc' | 'section' | 'amount_desc' | string = 'name_asc'
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthTotals: { [key: string]: number } = {};
  months.forEach(m => { monthTotals[m] = 0; });
  let grandTotal = 0;

  // 1. Sort members according to requested order
  const sortedMembers = [...members];
  if (sortOrder === 'name_asc' || sortOrder === 'name-asc') {
    sortedMembers.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  } else if (sortOrder === 'name_desc' || sortOrder === 'name-desc') {
    sortedMembers.sort((a, b) => (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' }));
  } else if (sortOrder === 'id_asc' || sortOrder === 'id-asc') {
    sortedMembers.sort((a, b) => (a.id || '').localeCompare(b.id || '', undefined, { numeric: true }));
  } else if (sortOrder === 'section') {
    sortedMembers.sort((a, b) => (a.section || '').localeCompare(b.section || '') || (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
  }

  // 1b. Strict Isolation: Member Ledger only processes transactions belonging to individual members (never groups or general offerings)
  const memberOnlyTransactions = transactions.filter(t => t.donorType !== 'group' && t.donorType !== 'general' && (!t.groupName || t.groupName.trim().length === 0));

  // 2. Strict 1-to-1 transaction allocation across members to eliminate ANY duplicate counting
  const memberTxnsMap = new Map<string, Transaction[]>();
  sortedMembers.forEach(m => memberTxnsMap.set(m.id, []));
  const assignedTxIds = new Set<string>();

  // Pass 1: Exact memberId match (Strict & unambiguous)
  for (const t of memberOnlyTransactions) {
    if (t.memberId) {
      const mem = sortedMembers.find(m => m.id && m.id.toLowerCase().trim() === t.memberId!.toLowerCase().trim());
      if (mem) {
        memberTxnsMap.get(mem.id)!.push(t);
        assignedTxIds.add(t.id);
      }
    }
  }

  // Pass 2: Remark contains exact member.id
  for (const t of memberOnlyTransactions) {
    if (assignedTxIds.has(t.id)) continue;
    if (t.remark) {
      const mem = sortedMembers.find(m => m.id && t.remark!.toLowerCase().includes(m.id.toLowerCase().trim()));
      if (mem) {
        memberTxnsMap.get(mem.id)!.push(t);
        assignedTxIds.add(t.id);
      }
    }
  }

  // Pass 3: Phone number match
  for (const t of memberOnlyTransactions) {
    if (assignedTxIds.has(t.id)) continue;
    if (t.donorPhone) {
      const cleanP = t.donorPhone.replace(/\D/g, '');
      const mem = sortedMembers.find(m => {
        const memP = (m.fullPhone || '').replace(/\D/g, '');
        if (cleanP && memP && cleanP === memP) return true;
        if (cleanP.length >= 4 && m.phoneLast4 && cleanP.endsWith(m.phoneLast4)) return true;
        return false;
      });
      if (mem) {
        memberTxnsMap.get(mem.id)!.push(t);
        assignedTxIds.add(t.id);
      }
    }
  }

  // Pass 4: Exact donorName match (case-insensitive)
  for (const t of memberOnlyTransactions) {
    if (assignedTxIds.has(t.id)) continue;
    if (t.donorName && !t.isAnonymous && t.donorName.toLowerCase().trim() !== 'anonymous') {
      const tClean = t.donorName.trim().toLowerCase();
      const mem = sortedMembers.find(m => m.name && m.name.trim().toLowerCase() === tClean);
      if (mem) {
        memberTxnsMap.get(mem.id)!.push(t);
        assignedTxIds.add(t.id);
      }
    }
  }

  // Pass 5: Normalized alphanumeric name match
  for (const t of memberOnlyTransactions) {
    if (assignedTxIds.has(t.id)) continue;
    if (t.donorName && !t.isAnonymous && t.donorName.toLowerCase().trim() !== 'anonymous') {
      const tNorm = t.donorName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (tNorm.length > 3) {
        const mem = sortedMembers.find(m => {
          if (!m.name) return false;
          const mNorm = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return tNorm === mNorm;
        });
        if (mem) {
          memberTxnsMap.get(mem.id)!.push(t);
          assignedTxIds.add(t.id);
        }
      }
    }
  }

  // If sorting by amount, re-sort members by their allocated transaction total
  if (sortOrder === 'amount_desc' || sortOrder === 'amount-desc') {
    sortedMembers.sort((a, b) => {
      const sumA = (memberTxnsMap.get(a.id) || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      const sumB = (memberTxnsMap.get(b.id) || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      return sumB - sumA;
    });
  }

  // Remaining transactions are unmatched (Direct / Guest / Anonymous)
  const unmatchedTxns = memberOnlyTransactions.filter(t => !assignedTxIds.has(t.id));

  const rowsHtml = sortedMembers.map((member, idx) => {
    const memberTxns = memberTxnsMap.get(member.id) || [];

    let rowTotal = 0;
    const monthCols = months.map(m => {
      const monthTxns = memberTxns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = monthTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
      rowTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += rowTotal;

    const avatarThumbnail = member.avatarUrl
      ? `<img src="${member.avatarUrl}" style="width: 22px; height: 22px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 6px; border: 1px solid #cbd5e1;" />`
      : '';

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-family: monospace; color: #1e3a8a; font-size: 11px;">${member.id}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #0f172a;">${avatarThumbnail}${member.name}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #64748b; font-size: 10px;">${member.section || '-'}</td>
        ${monthCols}
        <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0f2fe; color: #0369a1; font-family: monospace; font-size: 11px;">
          ${rowTotal > 0 ? rowTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  let unmatchedRowHtml = '';
  if (unmatchedTxns.length > 0) {
    let unmatchedTotal = 0;
    const unmatchedMonthCols = months.map(m => {
      const monthTxns = unmatchedTxns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = monthTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
      unmatchedTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #b45309; font-weight: bold;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += unmatchedTotal;

    unmatchedRowHtml = `
      <tr style="background: #fffbeb;">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px; color: #b45309;">*</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-family: monospace; color: #b45309; font-size: 10px;">DIRECT/QR</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #92400e;">Direct / QR / Anonymous Donors (${unmatchedTxns.length} txns)</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #b45309; font-size: 10px;">Direct / QR</td>
        ${unmatchedMonthCols}
        <td style="text-align: right; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #fef3c7; color: #b45309; font-family: monospace; font-size: 11px;">
          ${unmatchedTotal > 0 ? unmatchedTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }

  const monthTotalCols = months.map(m => `
    <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; font-family: monospace; font-size: 11px;">
      ${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-IN') : '-'}
    </td>
  `).join('');

  const logoHeader = logoUrl 
    ? `<img src="${logoUrl}" style="width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 1.5px solid #1e3a8a; margin-right: 12px;" />`
    : '';

  const sortLabel = sortOrder === 'name_asc' || sortOrder === 'name-asc' 
    ? 'Hming A-Z (Alphabetical)'
    : sortOrder === 'name_desc' || sortOrder === 'name-desc'
    ? 'Hming Z-A'
    : sortOrder === 'id_asc' || sortOrder === 'id-asc'
    ? 'Member ID (#)'
    : sortOrder === 'section'
    ? 'Section / Bial'
    : sortOrder === 'amount_desc' || sortOrder === 'amount-desc'
    ? 'Sum Thawh Tam Dan'
    : 'Default';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Master Ledger • ${orgName}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #1e293b; color: white; padding: 8px 6px; font-size: 10px; text-transform: uppercase; border: 1px solid #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 8px; }
          .header-left { display: flex; align-items: center; }
          @media print {
            thead { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${logoHeader}
            <div>
              <h1 style="margin: 0; font-size: 18px; color: #1e3a8a; font-weight: 900; text-transform: uppercase;">${orgName}</h1>
              <h2 style="margin: 2px 0 0 0; font-size: 12.5px; color: #475569;">${campaignTitle} — Master Ledger 12 Months</h2>
              ${location ? `<div style="font-size: 10px; color: #b45309; font-weight: 700; margin-top: 2px;">📍 ${location}</div>` : ''}
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            <div>Printed Date: <b>${formatDateDDMMYYYY(new Date())}</b></div>
            <div>Registered Members: <b>${sortedMembers.length}</b>${unmatchedTxns.length > 0 ? ` • Direct/Guest: <b>${unmatchedTxns.length} txns</b>` : ''}</div>
            <div>Order: <b>${sortLabel}</b></div>
            <div style="color: #047857; font-weight: 900; margin-top: 2px;">Grand Total: ₹${grandTotal.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th style="width: 75px;">ID</th>
              <th>NAME</th>
              <th>${(orgName.toLowerCase().includes('bmp') || campaignTitle.toLowerCase().includes('bmp')) ? 'UNIT' : 'SEC'}</th>
              ${months.map(m => `<th style="width: 45px;">${m.toUpperCase()}</th>`).join('')}
              <th style="width: 65px; background: #0284c7;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${unmatchedRowHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="4" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px; color: #0f172a;">
                G TOTAL (GRAND TOTAL):
              </td>
              ${monthTotalCols}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #0284c7; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportMasterLedgerPrint = (
  members: MemberRecord[],
  transactions: Transaction[],
  campaignTitle: string,
  orgName: string,
  logoUrl?: string,
  location?: string,
  sortOrder: 'name_asc' | 'name_desc' | 'id_asc' | 'section' | 'amount_desc' | string = 'name_asc'
) => {
  const html = generateMasterLedgerPrintHtml(members, transactions, campaignTitle, orgName, logoUrl, location, sortOrder);
  const cleanTarget = (campaignTitle || orgName || 'Master_Ledger')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  printHtmlSafely(html, `Master Ledger • ${orgName}`, `RonPay_Report_${cleanTarget}.pdf`);
};

/**
 * Format 2: Member Category Matrix HTML Generator (Horizontal)
 * Displays Member Photo if uploaded, or clean Initials / Blank card if not.
 */
export const generateMemberCategoryMatrixPrintHtml = (
  member: MemberRecord,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const memberTxns = transactions.filter(t => isTransactionForMember(t, member));

  const monthTotals: { [key: string]: number } = {};
  months.forEach(m => { monthTotals[m] = 0; });
  let grandTotal = 0;

  const rowsHtml = categories.map((cat, idx) => {
    let rowTotal = 0;
    const monthCols = months.map(m => {
      const monthTxns = memberTxns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = monthTxns.reduce((acc, t) => acc + getTransactionCategoryAmount(t, cat), 0);
      rowTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += rowTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #1e3a8a;">${cat}</td>
        ${monthCols}
        <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0f2fe; color: #0369a1; font-family: monospace; font-size: 11px;">
          ${rowTotal > 0 ? rowTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  // Member photo vs blank initials
  const memberPhotoHtml = member.avatarUrl 
    ? `<img src="${member.avatarUrl}" style="width: 72px; height: 72px; border-radius: 12px; object-fit: cover; border: 2px solid #1e3a8a; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);" />`
    : `<div style="width: 72px; height: 72px; border-radius: 12px; background: #e2e8f0; border: 1.5px dashed #94a3b8; display: flex; align-items: center; justify-content: center; color: #64748b; font-weight: 900; font-size: 20px; flex-shrink: 0;">${member.name.charAt(0) || 'M'}</div>`;

  const orgLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 6px; border: 1px solid #cbd5e1;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mimal Record • ${member.name} (${member.id})</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #1e293b; color: white; padding: 8px; font-size: 10.5px; text-transform: uppercase; border: 1px solid #0f172a; }
          .card { border: 1.5px solid #1e3a8a; border-radius: 12px; padding: 12px 16px; margin-bottom: 12px; background: #f8fafc; }
          @media print {
            thead { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${memberPhotoHtml}
              <div>
                <div style="font-size: 10.5px; color: #475569; font-weight: bold; text-transform: uppercase; display: flex; align-items: center;">
                  ${orgLogoHtml} ${orgName} ${location ? `• 📍 ${location}` : ''}
                </div>
                <h1 style="margin: 2px 0 0 0; font-size: 20px; color: #1e3a8a; font-weight: 900;">${member.name}</h1>
                <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">
                  Section: <b>${member.section || 'N/A'}</b> • Phone: <b>${member.fullPhone || `****${member.phoneLast4}`}</b>
                  ${member.dependents && member.dependents.length > 0 ? ` • Dependents: <b>${member.dependents.map(d => `${d.name} (${d.relation})`).join(', ')}</b>` : ''}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 9.5px; color: #64748b; font-weight: bold; text-transform: uppercase;">UNIQUE MEMBER ID</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #047857; background: #dcfce7; padding: 4px 10px; border-radius: 6px; border: 1px solid #86efac; margin-top: 3px;">${member.id}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Statement Date: ${formatDateDDMMYYYY(new Date())}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>HEAD / CATEGORY</th>
              ${months.map(m => `<th style="width: 48px;">${m.toUpperCase()}</th>`).join('')}
              <th style="width: 70px; background: #0284c7;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="2" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px;">G TOTAL:</td>
              ${months.map(m => `
                <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-family: monospace; font-size: 11px;">
                  ${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-IN') : '-'}
                </td>
              `).join('')}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #0284c7; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportMemberCategoryMatrixPrint = (
  member: MemberRecord,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string
) => {
  const html = generateMemberCategoryMatrixPrintHtml(member, categories, transactions, orgName, logoUrl, location);
  const cleanName = (member.name || member.id || 'Member')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  printHtmlSafely(html, `Mimal Record • ${member.name} (${member.id})`, `RonPay_Report_${cleanName}.pdf`);
};

/**
 * Format 3: Member Passbook Vertical Card HTML Generator
 * Displays Member Photo if uploaded, or clean Initials / Blank card if not.
 */
export const generateMemberPassbookVerticalPrintHtml = (
  member: MemberRecord,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const memberTxns = transactions.filter(t => isTransactionForMember(t, member));

  let grandTotal = 0;
  const categoryTotals: { [cat: string]: number } = {};
  categories.forEach(c => { categoryTotals[c] = 0; });

  const rowsHtml = months.map((month, idx) => {
    let monthTotal = 0;
    const monthTxns = memberTxns.filter(t => {
      const info = getTransactionMonthInfo(t);
      return info.shortMonth.toLowerCase() === month.toLowerCase();
    });

    const catCols = categories.map(cat => {
      const sum = monthTxns.reduce((acc, t) => acc + getTransactionCategoryAmount(t, cat), 0);
      monthTotal += sum;
      categoryTotals[cat] += sum;
      return `<td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += monthTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #1e3a8a;">${month}</td>
        ${catCols}
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0f2fe; color: #0369a1; font-family: monospace; font-size: 11px;">
          ${monthTotal > 0 ? monthTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  // Member photo vs blank initials
  const memberPhotoHtml = member.avatarUrl 
    ? `<img src="${member.avatarUrl}" style="width: 74px; height: 74px; border-radius: 12px; object-fit: cover; border: 2px solid #1e3a8a; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.1);" />`
    : `<div style="width: 74px; height: 74px; border-radius: 12px; background: #e2e8f0; border: 1.5px dashed #94a3b8; display: flex; align-items: center; justify-content: center; color: #64748b; font-weight: 900; font-size: 22px; flex-shrink: 0;">${member.name.charAt(0) || 'M'}</div>`;

  const orgLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 6px; border: 1px solid #cbd5e1;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Passbook Card • ${member.name} (${member.id})</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background: #1e293b; color: white; padding: 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
          .card { border: 1.5px solid #1e3a8a; border-radius: 12px; padding: 14px; margin-bottom: 14px; background: #f8fafc; }
          @media print {
            thead { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              ${memberPhotoHtml}
              <div>
                <div style="font-size: 11px; color: #475569; font-weight: bold; text-transform: uppercase; display: flex; align-items: center;">
                  ${orgLogoHtml} ${orgName} ${location ? `• 📍 ${location}` : ''}
                </div>
                <h1 style="margin: 2px 0 0 0; font-size: 20px; color: #1e3a8a; font-weight: 900;">${member.name}</h1>
                <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">
                  Section: <b>${member.section || 'N/A'}</b> • Phone: <b>${member.fullPhone || `****${member.phoneLast4}`}</b>
                  ${member.dependents && member.dependents.length > 0 ? ` • Dependents: <b>${member.dependents.map(d => `${d.name} (${d.relation})`).join(', ')}</b>` : ''}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 9.5px; color: #64748b; font-weight: bold; text-transform: uppercase;">UNIQUE MEMBER ID</div>
              <div style="font-size: 18px; font-weight: 900; font-family: monospace; color: #047857; background: #dcfce7; padding: 4px 10px; border-radius: 6px; border: 1px solid #86efac; margin-top: 3px;">${member.id}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Statement Date: ${formatDateDDMMYYYY(new Date())}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 80px;">MONTH</th>
              ${categories.map(c => `<th>${c.toUpperCase()}</th>`).join('')}
              <th style="width: 85px; background: #0284c7;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="2" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px;">G TOTAL:</td>
              ${categories.map(c => `
                <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-family: monospace; font-size: 11px;">
                  ${categoryTotals[c] > 0 ? categoryTotals[c].toLocaleString('en-IN') : '-'}
                </td>
              `).join('')}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #0284c7; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportMemberPassbookVerticalPrint = (
  member: MemberRecord,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string
) => {
  const html = generateMemberPassbookVerticalPrintHtml(member, categories, transactions, orgName, logoUrl, location);
  const cleanName = (member.name || member.id || 'Passbook')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  printHtmlSafely(html, `Passbook Card • ${member.name} (${member.id})`, `RonPay_Report_${cleanName}.pdf`);
};

/**
 * Helper to determine donor category type: 'member' | 'group' | 'general'
 */
export const getTransactionDonorType = (t: Transaction): 'member' | 'group' | 'general' => {
  if (!t) return 'member';
  if (t.donorType === 'group' || (Boolean(t.groupName) && t.groupName!.trim().length > 0)) {
    return 'group';
  }
  if (t.donorType === 'general') {
    return 'general';
  }
  return 'member';
};

/**
 * Checks if a transaction belongs to a given Group Name
 */
export const isTransactionForGroup = (t: Transaction, groupName: string): boolean => {
  if (!t || !groupName) return false;
  const target = groupName.trim().toLowerCase();
  const isGrp = t.donorType === 'group' || (Boolean(t.groupName) && t.groupName!.trim().length > 0);
  if (!isGrp) return false;

  if (t.groupName && t.groupName.trim().toLowerCase() === target) return true;
  if (t.donorName && t.donorName.trim().toLowerCase() === target) return true;
  if (t.remark && t.remark.toLowerCase().includes(target)) return true;
  return false;
};

/**
 * Checks if a transaction belongs to a General Collection title
 */
export const isTransactionForGeneral = (t: Transaction, generalTitle: string): boolean => {
  if (!t || !generalTitle) return false;
  const target = generalTitle.trim().toLowerCase();
  if (t.donorType !== 'general') return false;

  if (t.donorName && t.donorName.trim().toLowerCase() === target) return true;
  if (t.subCategory && t.subCategory.trim().toLowerCase() === target) return true;
  if (t.remark && t.remark.toLowerCase().includes(target)) return true;
  return false;
};

export interface GroupRecordItem {
  name: string;
  section?: string;
  leader?: string;
  phone?: string;
}

export interface GeneralRecordItem {
  title: string;
  section?: string;
  collector?: string;
  phone?: string;
}

/**
 * Format 2b: Group & Unit Master Ledger (12 Months Landscape Table)
 * Displays all distinct groups/units with monthly contributions. Strictly isolated from individual members.
 */
export const generateGroupMasterLedgerPrintHtml = (
  groups: GroupRecordItem[],
  transactions: Transaction[],
  campaignTitle: string,
  orgName: string,
  logoUrl?: string,
  location?: string,
  sortOrder: 'name_asc' | 'name_desc' | 'amount_desc' | string = 'name_asc'
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthTotals: { [key: string]: number } = {};
  months.forEach(m => { monthTotals[m] = 0; });
  let grandTotal = 0;

  // Strict Isolation: Only group transactions
  const groupTransactions = transactions.filter(t => 
    t.donorType === 'group' || (Boolean(t.groupName) && t.groupName!.trim().length > 0)
  );

  // If no group list provided, dynamically derive unique groups from transactions
  let groupList: GroupRecordItem[] = [...groups];
  if (groupList.length === 0) {
    const groupMap = new Map<string, GroupRecordItem>();
    groupTransactions.forEach(t => {
      const gName = (t.groupName || t.donorName || 'Unnamed Group').trim();
      if (!groupMap.has(gName)) {
        groupMap.set(gName, {
          name: gName,
          section: t.donorVeng,
          phone: t.donorPhone,
          leader: t.donorName !== gName ? t.donorName : undefined
        });
      }
    });
    groupList = Array.from(groupMap.values());
  }

  // Sort groups
  if (sortOrder === 'name_desc') {
    groupList.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
  } else {
    groupList.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  // Allocate transactions to groups
  const groupTxnsMap = new Map<string, Transaction[]>();
  groupList.forEach(g => groupTxnsMap.set(g.name, []));

  for (const t of groupTransactions) {
    const tGName = (t.groupName || t.donorName || '').trim().toLowerCase();
    const matched = groupList.find(g => 
      g.name.toLowerCase() === tGName ||
      (t.groupName && t.groupName.trim().toLowerCase() === g.name.toLowerCase()) ||
      (t.donorName && t.donorName.trim().toLowerCase() === g.name.toLowerCase())
    );
    if (matched) {
      groupTxnsMap.get(matched.name)!.push(t);
    } else {
      if (groupList.length > 0) {
        groupTxnsMap.get(groupList[0].name)!.push(t);
      }
    }
  }

  // Sort by amount if requested
  if (sortOrder === 'amount_desc') {
    groupList.sort((a, b) => {
      const sumA = (groupTxnsMap.get(a.name) || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      const sumB = (groupTxnsMap.get(b.name) || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      return sumB - sumA;
    });
  }

  const rowsHtml = groupList.map((grp, idx) => {
    const txns = groupTxnsMap.get(grp.name) || [];
    let rowTotal = 0;

    const monthCols = months.map(m => {
      const mTxns = txns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = mTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
      rowTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += rowTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 11.5px; color: #1e3a8a;">
          👥 ${grp.name}
          ${grp.leader ? `<div style="font-size: 9.5px; color: #64748b; font-weight: normal;">Leader: ${grp.leader}</div>` : ''}
        </td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; color: #475569; font-size: 10.5px;">${grp.section || grp.phone || '-'}</td>
        ${monthCols}
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0e7ff; color: #3730a3; font-family: monospace; font-size: 11px;">
          ${rowTotal > 0 ? rowTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const monthTotalCols = months.map(m => `
    <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; font-family: monospace; font-size: 11px;">
      ${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-IN') : '-'}
    </td>
  `).join('');

  const logoHeader = logoUrl 
    ? `<img src="${logoUrl}" style="width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 1.5px solid #1e3a8a; margin-right: 12px;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Group & Unit Master Ledger • ${orgName}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #1e1b4b; color: white; padding: 8px 6px; font-size: 10px; text-transform: uppercase; border: 1px solid #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #4338ca; padding-bottom: 8px; }
          .header-left { display: flex; align-items: center; }
          .signatures { margin-top: 28px; display: flex; justify-content: space-between; padding: 0 20px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { border-top: 1px solid #0f172a; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: bold; }
          @media print {
            thead { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${logoHeader}
            <div>
              <h1 style="margin: 0; font-size: 18px; color: #312e81; font-weight: 900; text-transform: uppercase;">${orgName}</h1>
              <h2 style="margin: 2px 0 0 0; font-size: 12.5px; color: #4338ca;">${campaignTitle} — 👥 Group & Unit Master Ledger (Thla 12)</h2>
              ${location ? `<div style="font-size: 10px; color: #b45309; font-weight: 700; margin-top: 2px;">📍 ${location}</div>` : ''}
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            <div>Printed Date: <b>${formatDateDDMMYYYY(new Date())}</b></div>
            <div>Enrolled Groups / Units: <b>${groupList.length}</b> • Transactions: <b>${groupTransactions.length}</b></div>
            <div style="color: #4338ca; font-weight: 900; margin-top: 2px; font-size: 12px;">Grand Total: ₹${grandTotal.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>GROUP / PAWL / UNIT NAME</th>
              <th style="width: 110px;">SECTION / BIAL</th>
              ${months.map(m => `<th style="width: 46px;">${m.toUpperCase()}</th>`).join('')}
              <th style="width: 75px; background: #4338ca;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e0e7ff; font-weight: 900;">
              <td colspan="3" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px; color: #1e1b4b;">
                GROUP COLLECTION GRAND TOTAL:
              </td>
              ${monthTotalCols}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #4338ca; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line">Prepared by (Recorder)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Verified by (Treasurer)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Approved by (Leader / Secretary)</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const exportGroupMasterLedgerPrint = (
  groups: GroupRecordItem[],
  transactions: Transaction[],
  campaignTitle: string,
  orgName: string,
  logoUrl?: string,
  location?: string,
  sortOrder: string = 'name_asc'
) => {
  const html = generateGroupMasterLedgerPrintHtml(groups, transactions, campaignTitle, orgName, logoUrl, location, sortOrder);
  const cleanTarget = (campaignTitle || orgName || 'Group_Ledger')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  printHtmlSafely(html, `Group Master Ledger • ${orgName}`, `RonPay_Group_Ledger_${cleanTarget}.pdf`);
};

/**
 * Format 2c: General & Inkhawm Thawhlawm Ledger (12 Months Landscape Table)
 * Displays general collections (e.g. Inkhawm Thawhlawm, Pathianni Zing, etc.) month by month. Strictly isolated.
 */
export const generateGeneralMasterLedgerPrintHtml = (
  generalItems: GeneralRecordItem[],
  transactions: Transaction[],
  campaignTitle: string,
  orgName: string,
  logoUrl?: string,
  location?: string,
  sortOrder: 'name_asc' | 'name_desc' | 'amount_desc' | string = 'name_asc'
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthTotals: { [key: string]: number } = {};
  months.forEach(m => { monthTotals[m] = 0; });
  let grandTotal = 0;

  // Strict Isolation: Only general transactions
  const generalTransactions = transactions.filter(t => t.donorType === 'general');

  // Derive unique general collection items if not passed
  let itemsList: GeneralRecordItem[] = [...generalItems];
  if (itemsList.length === 0) {
    const itemMap = new Map<string, GeneralRecordItem>();
    generalTransactions.forEach(t => {
      const title = (t.donorName || t.subCategory || 'General Offering').trim();
      if (!itemMap.has(title)) {
        itemMap.set(title, {
          title,
          section: t.donorVeng,
          collector: t.remark?.includes('Collector:') ? t.remark.split('Collector:')[1].trim() : undefined,
          phone: t.donorPhone
        });
      }
    });
    itemsList = Array.from(itemMap.values());
  }

  // Sort general items
  if (sortOrder === 'name_desc') {
    itemsList.sort((a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }));
  } else {
    itemsList.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }

  // Allocate transactions to general items
  const itemTxnsMap = new Map<string, Transaction[]>();
  itemsList.forEach(item => itemTxnsMap.set(item.title, []));

  for (const t of generalTransactions) {
    const tTitle = (t.donorName || t.subCategory || '').trim().toLowerCase();
    const matched = itemsList.find(it => 
      it.title.toLowerCase() === tTitle ||
      (t.donorName && t.donorName.trim().toLowerCase() === it.title.toLowerCase()) ||
      (t.subCategory && t.subCategory.trim().toLowerCase() === it.title.toLowerCase())
    );
    if (matched) {
      itemTxnsMap.get(matched.title)!.push(t);
    } else {
      if (itemsList.length > 0) {
        itemTxnsMap.get(itemsList[0].title)!.push(t);
      }
    }
  }

  // Sort by amount if requested
  if (sortOrder === 'amount_desc') {
    itemsList.sort((a, b) => {
      const sumA = (itemTxnsMap.get(a.title) || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      const sumB = (itemTxnsMap.get(b.title) || []).reduce((acc, t) => acc + (t.amount || 0), 0);
      return sumB - sumA;
    });
  }

  const rowsHtml = itemsList.map((item, idx) => {
    const txns = itemTxnsMap.get(item.title) || [];
    let rowTotal = 0;

    const monthCols = months.map(m => {
      const mTxns = txns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = mTxns.reduce((acc, t) => acc + (t.amount || 0), 0);
      rowTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += rowTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px; color: #64748b;">${idx + 1}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; font-size: 11.5px; color: #047857;">
          🏛️ ${item.title}
          ${item.collector ? `<div style="font-size: 9.5px; color: #64748b; font-weight: normal;">Collector: ${item.collector}</div>` : ''}
        </td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; color: #475569; font-size: 10.5px;">${item.section || item.phone || '-'}</td>
        ${monthCols}
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #dcfce7; color: #065f46; font-family: monospace; font-size: 11px;">
          ${rowTotal > 0 ? rowTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const monthTotalCols = months.map(m => `
    <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; font-family: monospace; font-size: 11px;">
      ${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-IN') : '-'}
    </td>
  `).join('');

  const logoHeader = logoUrl 
    ? `<img src="${logoUrl}" style="width: 52px; height: 52px; border-radius: 10px; object-fit: cover; border: 1.5px solid #047857; margin-right: 12px;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>General & Inkhawm Thawhlawm Ledger • ${orgName}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 landscape; margin: 8mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #064e3b; color: white; padding: 8px 6px; font-size: 10px; text-transform: uppercase; border: 1px solid #0f172a; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #047857; padding-bottom: 8px; }
          .header-left { display: flex; align-items: center; }
          .signatures { margin-top: 28px; display: flex; justify-content: space-between; padding: 0 20px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 180px; }
          .sig-line { border-top: 1px solid #0f172a; margin-top: 40px; padding-top: 4px; font-size: 10px; font-weight: bold; }
          @media print {
            thead { display: table-row-group !important; }
            tr { page-break-inside: avoid !important; break-inside: avoid !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            ${logoHeader}
            <div>
              <h1 style="margin: 0; font-size: 18px; color: #064e3b; font-weight: 900; text-transform: uppercase;">${orgName}</h1>
              <h2 style="margin: 2px 0 0 0; font-size: 12.5px; color: #047857;">${campaignTitle} — 🏛️ General & Inkhawm Thawhlawm Ledger (Thla 12)</h2>
              ${location ? `<div style="font-size: 10px; color: #b45309; font-weight: 700; margin-top: 2px;">📍 ${location}</div>` : ''}
            </div>
          </div>
          <div style="text-align: right; font-size: 10px; color: #64748b;">
            <div>Printed Date: <b>${formatDateDDMMYYYY(new Date())}</b></div>
            <div>Collection Heads: <b>${itemsList.length}</b> • Transactions: <b>${generalTransactions.length}</b></div>
            <div style="color: #047857; font-weight: 900; margin-top: 2px; font-size: 12px;">Grand Total: ₹${grandTotal.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>THAWHLAWM / COLLECTION NAME</th>
              <th style="width: 120px;">LOCATION / SECTION</th>
              ${months.map(m => `<th style="width: 46px;">${m.toUpperCase()}</th>`).join('')}
              <th style="width: 75px; background: #047857;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #dcfce7; font-weight: 900;">
              <td colspan="3" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px; color: #064e3b;">
                GENERAL THAWHLAWM GRAND TOTAL:
              </td>
              ${monthTotalCols}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #047857; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="signatures">
          <div class="sig-box">
            <div class="sig-line">Prepared by (Collector / Recorder)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Verified by (Treasurer)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Approved by (Secretary / Leader)</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const exportGeneralMasterLedgerPrint = (
  generalItems: GeneralRecordItem[],
  transactions: Transaction[],
  campaignTitle: string,
  orgName: string,
  logoUrl?: string,
  location?: string,
  sortOrder: string = 'name_asc'
) => {
  const html = generateGeneralMasterLedgerPrintHtml(generalItems, transactions, campaignTitle, orgName, logoUrl, location, sortOrder);
  const cleanTarget = (campaignTitle || orgName || 'General_Ledger')
    .replace(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  printHtmlSafely(html, `General Thawhlawm Ledger • ${orgName}`, `RonPay_General_Ledger_${cleanTarget}.pdf`);
};

/**
 * Format 3b: Group Category Matrix Print (Horizontal)
 */
export const generateGroupCategoryMatrixPrintHtml = (
  groupName: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  section?: string,
  leader?: string
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const grpTxns = transactions.filter(t => isTransactionForGroup(t, groupName));

  const monthTotals: { [key: string]: number } = {};
  months.forEach(m => { monthTotals[m] = 0; });
  let grandTotal = 0;

  const rowsHtml = categories.map((cat, idx) => {
    let rowTotal = 0;
    const monthCols = months.map(m => {
      const monthTxns = grpTxns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = monthTxns.reduce((acc, t) => acc + getTransactionCategoryAmount(t, cat), 0);
      rowTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += rowTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #312e81;">${cat}</td>
        ${monthCols}
        <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0e7ff; color: #3730a3; font-family: monospace; font-size: 11px;">
          ${rowTotal > 0 ? rowTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const orgLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 8px; border: 1px solid #cbd5e1;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Group Record • ${groupName}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #1e1b4b; color: white; padding: 8px; font-size: 10.5px; text-transform: uppercase; border: 1px solid #0f172a; }
          .card { border: 1.5px solid #4338ca; border-radius: 12px; padding: 14px 18px; margin-bottom: 12px; background: #eef2ff; }
          @media print { thead { display: table-row-group !important; } tr { page-break-inside: avoid !important; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 60px; height: 60px; border-radius: 12px; background: #4338ca; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px;">👥</div>
              <div>
                <div style="font-size: 11px; color: #4338ca; font-weight: bold; text-transform: uppercase;">
                  ${orgLogoHtml} ${orgName} ${location ? `• 📍 ${location}` : ''}
                </div>
                <h1 style="margin: 2px 0 0 0; font-size: 22px; color: #1e1b4b; font-weight: 900;">${groupName}</h1>
                <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">
                  Record Type: <b>GROUP / UNIT</b> ${section ? `• Section: <b>${section}</b>` : ''} ${leader ? `• Leader/In-charge: <b>${leader}</b>` : ''}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 9.5px; color: #4338ca; font-weight: bold; text-transform: uppercase;">CATEGORY MATRIX</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #3730a3; background: #e0e7ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #c7d2fe; margin-top: 3px;">TOTAL: ₹${grandTotal.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Statement Date: ${formatDateDDMMYYYY(new Date())}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>HEAD / CATEGORY</th>
              ${months.map(m => `<th style="width: 48px;">${m.toUpperCase()}</th>`).join('')}
              <th style="width: 70px; background: #4338ca;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="2" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px;">G TOTAL:</td>
              ${months.map(m => `
                <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-family: monospace; font-size: 11px;">
                  ${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-IN') : '-'}
                </td>
              `).join('')}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #4338ca; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportGroupCategoryMatrixPrint = (
  groupName: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  section?: string,
  leader?: string
) => {
  const html = generateGroupCategoryMatrixPrintHtml(groupName, categories, transactions, orgName, logoUrl, location, section, leader);
  const cleanName = groupName.replace(/[/\\?%*:|"<>]/g, '').trim().replace(/\s+/g, '_');
  printHtmlSafely(html, `Group Matrix • ${groupName}`, `RonPay_Group_Matrix_${cleanName}.pdf`);
};

/**
 * Format 4b: Group Passbook Vertical Card Print
 */
export const generateGroupPassbookPrintHtml = (
  groupName: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  section?: string,
  leader?: string
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const grpTxns = transactions.filter(t => isTransactionForGroup(t, groupName));

  let grandTotal = 0;
  const categoryTotals: { [cat: string]: number } = {};
  categories.forEach(c => { categoryTotals[c] = 0; });

  const rowsHtml = months.map((month, idx) => {
    let monthTotal = 0;
    const monthTxns = grpTxns.filter(t => {
      const info = getTransactionMonthInfo(t);
      return info.shortMonth.toLowerCase() === month.toLowerCase();
    });

    const catCols = categories.map(cat => {
      const sum = monthTxns.reduce((acc, t) => acc + getTransactionCategoryAmount(t, cat), 0);
      monthTotal += sum;
      categoryTotals[cat] += sum;
      return `<td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += monthTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #4338ca;">${month}</td>
        ${catCols}
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #e0e7ff; color: #3730a3; font-family: monospace; font-size: 11px;">
          ${monthTotal > 0 ? monthTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const orgLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 8px; border: 1px solid #cbd5e1;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Group Passbook Card • ${groupName}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background: #1e1b4b; color: white; padding: 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
          .card { border: 1.5px solid #4338ca; border-radius: 12px; padding: 14px; margin-bottom: 14px; background: #eef2ff; }
          @media print { thead { display: table-row-group !important; } tr { page-break-inside: avoid !important; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 60px; height: 60px; border-radius: 12px; background: #4338ca; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px;">👥</div>
              <div>
                <div style="font-size: 11px; color: #4338ca; font-weight: bold; text-transform: uppercase;">
                  ${orgLogoHtml} ${orgName} ${location ? `• 📍 ${location}` : ''}
                </div>
                <h1 style="margin: 2px 0 0 0; font-size: 22px; color: #1e1b4b; font-weight: 900;">${groupName}</h1>
                <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">
                  Type: <b>GROUP / UNIT PASSBOOK</b> ${section ? `• Section: <b>${section}</b>` : ''} ${leader ? `• In-charge: <b>${leader}</b>` : ''}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 9.5px; color: #4338ca; font-weight: bold; text-transform: uppercase;">ANNUAL PASSBOOK</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #3730a3; background: #e0e7ff; padding: 4px 10px; border-radius: 6px; border: 1px solid #c7d2fe; margin-top: 3px;">TOTAL: ₹${grandTotal.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Statement Date: ${formatDateDDMMYYYY(new Date())}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 80px;">MONTH</th>
              ${categories.map(c => `<th>${c.toUpperCase()}</th>`).join('')}
              <th style="width: 85px; background: #4338ca;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="2" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px;">G TOTAL:</td>
              ${categories.map(c => `
                <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-family: monospace; font-size: 11px;">
                  ${categoryTotals[c] > 0 ? categoryTotals[c].toLocaleString('en-IN') : '-'}
                </td>
              `).join('')}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #4338ca; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportGroupPassbookPrint = (
  groupName: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  section?: string,
  leader?: string
) => {
  const html = generateGroupPassbookPrintHtml(groupName, categories, transactions, orgName, logoUrl, location, section, leader);
  const cleanName = groupName.replace(/[/\\?%*:|"<>]/g, '').trim().replace(/\s+/g, '_');
  printHtmlSafely(html, `Group Passbook • ${groupName}`, `RonPay_Group_Passbook_${cleanName}.pdf`);
};

/**
 * Format 3c: General Category Matrix Print (Horizontal)
 */
export const generateGeneralCategoryMatrixPrintHtml = (
  generalTitle: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  collector?: string
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const genTxns = transactions.filter(t => isTransactionForGeneral(t, generalTitle));

  const monthTotals: { [key: string]: number } = {};
  months.forEach(m => { monthTotals[m] = 0; });
  let grandTotal = 0;

  const rowsHtml = categories.map((cat, idx) => {
    let rowTotal = 0;
    const monthCols = months.map(m => {
      const monthTxns = genTxns.filter(t => {
        const info = getTransactionMonthInfo(t);
        return info.shortMonth.toLowerCase() === m.toLowerCase();
      });
      const sum = monthTxns.reduce((acc, t) => acc + getTransactionCategoryAmount(t, cat), 0);
      rowTotal += sum;
      monthTotals[m] += sum;
      return `<td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += rowTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #065f46;">${cat}</td>
        ${monthCols}
        <td style="text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #dcfce7; color: #047857; font-family: monospace; font-size: 11px;">
          ${rowTotal > 0 ? rowTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const orgLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 8px; border: 1px solid #cbd5e1;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>General Record • ${generalTitle}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th { background: #064e3b; color: white; padding: 8px; font-size: 10.5px; text-transform: uppercase; border: 1px solid #0f172a; }
          .card { border: 1.5px solid #047857; border-radius: 12px; padding: 14px 18px; margin-bottom: 12px; background: #f0fdf4; }
          @media print { thead { display: table-row-group !important; } tr { page-break-inside: avoid !important; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 60px; height: 60px; border-radius: 12px; background: #047857; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px;">🏛️</div>
              <div>
                <div style="font-size: 11px; color: #047857; font-weight: bold; text-transform: uppercase;">
                  ${orgLogoHtml} ${orgName} ${location ? `• 📍 ${location}` : ''}
                </div>
                <h1 style="margin: 2px 0 0 0; font-size: 22px; color: #064e3b; font-weight: 900;">${generalTitle}</h1>
                <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">
                  Record Type: <b>GENERAL / INKHAWM THAWHLAWM</b> ${collector ? `• Collector / Hriatpuitu: <b>${collector}</b>` : ''}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 9.5px; color: #047857; font-weight: bold; text-transform: uppercase;">COLLECTION MATRIX</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #047857; background: #dcfce7; padding: 4px 10px; border-radius: 6px; border: 1px solid #86efac; margin-top: 3px;">TOTAL: ₹${grandTotal.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Statement Date: ${formatDateDDMMYYYY(new Date())}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">#</th>
              <th>HEAD / CATEGORY</th>
              ${months.map(m => `<th style="width: 48px;">${m.toUpperCase()}</th>`).join('')}
              <th style="width: 70px; background: #047857;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="2" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px;">G TOTAL:</td>
              ${months.map(m => `
                <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-family: monospace; font-size: 11px;">
                  ${monthTotals[m] > 0 ? monthTotals[m].toLocaleString('en-IN') : '-'}
                </td>
              `).join('')}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #047857; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportGeneralCategoryMatrixPrint = (
  generalTitle: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  collector?: string
) => {
  const html = generateGeneralCategoryMatrixPrintHtml(generalTitle, categories, transactions, orgName, logoUrl, location, collector);
  const cleanName = generalTitle.replace(/[/\\?%*:|"<>]/g, '').trim().replace(/\s+/g, '_');
  printHtmlSafely(html, `General Matrix • ${generalTitle}`, `RonPay_General_Matrix_${cleanName}.pdf`);
};

/**
 * Format 4c: General Passbook Vertical Card Print
 */
export const generateGeneralPassbookPrintHtml = (
  generalTitle: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  collector?: string
): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const genTxns = transactions.filter(t => isTransactionForGeneral(t, generalTitle));

  let grandTotal = 0;
  const categoryTotals: { [cat: string]: number } = {};
  categories.forEach(c => { categoryTotals[c] = 0; });

  const rowsHtml = months.map((month, idx) => {
    let monthTotal = 0;
    const monthTxns = genTxns.filter(t => {
      const info = getTransactionMonthInfo(t);
      return info.shortMonth.toLowerCase() === month.toLowerCase();
    });

    const catCols = categories.map(cat => {
      const sum = monthTxns.reduce((acc, t) => acc + getTransactionCategoryAmount(t, cat), 0);
      monthTotal += sum;
      categoryTotals[cat] += sum;
      return `<td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px;">${sum > 0 ? sum.toLocaleString('en-IN') : '-'}</td>`;
    }).join('');

    grandTotal += monthTotal;

    return `
      <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: bold; font-size: 11px; color: #047857;">${month}</td>
        ${catCols}
        <td style="text-align: right; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 900; background: #dcfce7; color: #065f46; font-family: monospace; font-size: 11px;">
          ${monthTotal > 0 ? monthTotal.toLocaleString('en-IN') : '-'}
        </td>
      </tr>
    `;
  }).join('');

  const orgLogoHtml = logoUrl 
    ? `<img src="${logoUrl}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; vertical-align: middle; margin-right: 8px; border: 1px solid #cbd5e1;" />`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>General Passbook Card • ${generalTitle}</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          th { background: #064e3b; color: white; padding: 8px; font-size: 11px; text-transform: uppercase; border: 1px solid #0f172a; }
          .card { border: 1.5px solid #047857; border-radius: 12px; padding: 14px; margin-bottom: 14px; background: #f0fdf4; }
          @media print { thead { display: table-row-group !important; } tr { page-break-inside: avoid !important; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 14px;">
              <div style="width: 60px; height: 60px; border-radius: 12px; background: #047857; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px;">🏛️</div>
              <div>
                <div style="font-size: 11px; color: #047857; font-weight: bold; text-transform: uppercase;">
                  ${orgLogoHtml} ${orgName} ${location ? `• 📍 ${location}` : ''}
                </div>
                <h1 style="margin: 2px 0 0 0; font-size: 22px; color: #064e3b; font-weight: 900;">${generalTitle}</h1>
                <div style="font-size: 11.5px; color: #334155; margin-top: 2px;">
                  Type: <b>GENERAL THAWHLAWM PASSBOOK</b> ${collector ? `• Collector / Hriatpuitu: <b>${collector}</b>` : ''}
                </div>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 9.5px; color: #047857; font-weight: bold; text-transform: uppercase;">ANNUAL PASSBOOK</div>
              <div style="font-size: 16px; font-weight: 900; font-family: monospace; color: #047857; background: #dcfce7; padding: 4px 10px; border-radius: 6px; border: 1px solid #86efac; margin-top: 3px;">TOTAL: ₹${grandTotal.toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Statement Date: ${formatDateDDMMYYYY(new Date())}</div>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px;">#</th>
              <th style="width: 80px;">MONTH</th>
              ${categories.map(c => `<th>${c.toUpperCase()}</th>`).join('')}
              <th style="width: 85px; background: #047857;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr style="background: #e2e8f0; font-weight: 900;">
              <td colspan="2" style="padding: 8px; border: 1px solid #0f172a; text-align: right; font-size: 11px;">G TOTAL:</td>
              ${categories.map(c => `
                <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-family: monospace; font-size: 11px;">
                  ${categoryTotals[c] > 0 ? categoryTotals[c].toLocaleString('en-IN') : '-'}
                </td>
              `).join('')}
              <td style="text-align: right; padding: 8px; border: 1px solid #0f172a; font-weight: 900; background: #047857; color: white; font-family: monospace; font-size: 12px;">
                ₹${grandTotal.toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `;
};

export const exportGeneralPassbookPrint = (
  generalTitle: string,
  categories: string[],
  transactions: Transaction[],
  orgName: string,
  logoUrl?: string,
  location?: string,
  collector?: string
) => {
  const html = generateGeneralPassbookPrintHtml(generalTitle, categories, transactions, orgName, logoUrl, location, collector);
  const cleanName = generalTitle.replace(/[/\\?%*:|"<>]/g, '').trim().replace(/\s+/g, '_');
  printHtmlSafely(html, `General Passbook • ${generalTitle}`, `RonPay_General_Passbook_${cleanName}.pdf`);
};


