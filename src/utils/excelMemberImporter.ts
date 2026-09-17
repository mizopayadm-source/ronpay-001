import * as XLSX from 'xlsx';
import { MemberRecord, MemberDependent } from '../types';

export interface ParsedMemberRow {
  name: string;
  fatherName?: string;
  phone?: string;
  section?: string;
  dependentsRaw?: string;
  pledgeAmount?: number;
  rowNumber: number;
}

export interface ImportValidationResult {
  success: boolean;
  errorMessage?: string;
  rows: ParsedMemberRow[];
  detectedColumns: string[];
  totalParsed: number;
}

/**
 * Downloads a pre-formatted Excel (.xlsx) template with sample Mizo member records.
 */
export function downloadSampleExcelTemplate(prefix = 'BET'): void {
  const sampleData = [
    {
      'Hming (Name) *': 'Lalrintluanga',
      'Pa Hming (Father Name)': 'C. Lalthanga',
      'Phone Number': '9862300001',
      'Bial / Section': 'Bethel Section',
      'Chhungkua (Dependents)': 'Lalthanpuii (Nupui), Lalruatfela (Fa)',
      'Thla Tin Tum Zat (₹)': 500
    },
    {
      'Hming (Name) *': 'Pi Zodingliani',
      'Pa Hming (Father Name)': 'R. Kapmawia',
      'Phone Number': '9436100002',
      'Bial / Section': 'Hmar Bial',
      'Chhungkua (Dependents)': 'Lalbiakdiki (Fa)',
      'Thla Tin Tum Zat (₹)': 1000
    },
    {
      'Hming (Name) *': 'Pu C. Laldinpuia',
      'Pa Hming (Father Name)': 'Chhawnkima',
      'Phone Number': '9862500003',
      'Bial / Section': 'Venglao Section',
      'Chhungkua (Dependents)': '',
      'Thla Tin Tum Zat (₹)': ''
    },
    {
      'Hming (Name) *': 'Vanlalruata',
      'Pa Hming (Father Name)': 'Lalzawmliana',
      'Phone Number': '9862112233',
      'Bial / Section': 'Kanan Section',
      'Chhungkua (Dependents)': 'Zothanpuii (Nupui), Emanuel-a (Fa)',
      'Thla Tin Tum Zat (₹)': 300
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set friendly column widths
  worksheet['!cols'] = [
    { wch: 22 }, // Hming
    { wch: 20 }, // Pa Hming
    { wch: 16 }, // Phone
    { wch: 20 }, // Bial / Section
    { wch: 38 }, // Chhungkua
    { wch: 20 }  // Thla tin tum zat
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kumtluang_Members');

  const fileName = `RonPay_Kumtluang_Sample_Template_${prefix.toUpperCase()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Downloads a CSV template version
 */
export function downloadSampleCsvTemplate(prefix = 'BET'): void {
  const csvContent = 
    `Hming (Name) *,Pa Hming (Father Name),Phone Number,Bial / Section,Chhungkua (Dependents),Thla Tin Tum Zat (₹)\n` +
    `Lalrintluanga,C. Lalthanga,9862300001,Bethel Section,"Lalthanpuii (Nupui), Lalruatfela (Fa)",500\n` +
    `Pi Zodingliani,R. Kapmawia,9436100002,Hmar Bial,Lalbiakdiki (Fa),1000\n` +
    `Pu C. Laldinpuia,Chhawnkima,9862500003,Venglao Section,,,\n` +
    `Vanlalruata,Lalzawmliana,9862112233,Kanan Section,"Zothanpuii (Nupui), Emanuel-a (Fa)",300\n`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `RonPay_Kumtluang_Sample_Template_${prefix.toUpperCase()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Normalizes header string to match standard fields
 */
function normalizeHeaderKey(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Smartly finds which column corresponds to our required & optional fields
 */
function identifyColumns(headers: string[]): {
  nameCol?: string;
  fatherNameCol?: string;
  phoneCol?: string;
  sectionCol?: string;
  dependentsCol?: string;
  targetCol?: string;
} {
  const result: {
    nameCol?: string;
    fatherNameCol?: string;
    phoneCol?: string;
    sectionCol?: string;
    dependentsCol?: string;
    targetCol?: string;
  } = {};

  for (const h of headers) {
    const norm = normalizeHeaderKey(h);
    if (!norm) continue;

    // Hming / Name
    if (!result.nameCol) {
      if (
        norm === 'hming' ||
        norm === 'name' ||
        norm === 'membername' ||
        norm === 'fullname' ||
        norm === 'hmingpum' ||
        norm.startsWith('hmingname') ||
        norm === 'member'
      ) {
        result.nameCol = h;
        continue;
      }
    }

    // Pa Hming / Father's Name
    if (!result.fatherNameCol) {
      if (
        norm.includes('pahming') ||
        norm.includes('father') ||
        norm === 'pa' ||
        norm.includes('guardian') ||
        norm.includes('nupahming')
      ) {
        result.fatherNameCol = h;
        continue;
      }
    }

    // Phone / Mobile
    if (!result.phoneCol) {
      if (
        norm.includes('phone') ||
        norm.includes('mobile') ||
        norm.includes('contact') ||
        norm === 'ph' ||
        norm === 'phno' ||
        norm === 'cell'
      ) {
        result.phoneCol = h;
        continue;
      }
    }

    // Section / Bial / Veng
    if (!result.sectionCol) {
      if (
        norm.includes('section') ||
        norm.includes('bial') ||
        norm.includes('veng') ||
        norm.includes('branch') ||
        norm.includes('unit')
      ) {
        result.sectionCol = h;
        continue;
      }
    }

    // Dependents / Chhungkua
    if (!result.dependentsCol) {
      if (
        norm.includes('chhungkua') ||
        norm.includes('dependent') ||
        norm.includes('family') ||
        norm.includes('chhungte')
      ) {
        result.dependentsCol = h;
        continue;
      }
    }

    // Thla tin tum zat / Target
    if (!result.targetCol) {
      if (
        norm.includes('target') ||
        norm.includes('thlatin') ||
        norm.includes('pledge') ||
        norm.includes('tumzat') ||
        norm.includes('pekzat') ||
        norm.includes('amount')
      ) {
        result.targetCol = h;
        continue;
      }
    }
  }

  return result;
}

/**
 * Parses an Excel (.xlsx, .xls) or .csv file into clean member objects
 */
export async function parseExcelOrCsvFile(file: File): Promise<ImportValidationResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          resolve({
            success: false,
            errorMessage: 'File chhiar theih a ni lo. Khawngaihin file dang rawn thlang rawh.',
            rows: [],
            detectedColumns: [],
            totalParsed: 0
          });
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          resolve({
            success: false,
            errorMessage: 'Excel sheet ruak a ni tlat mai. Worksheet a awm lo.',
            rows: [],
            detectedColumns: [],
            totalParsed: 0
          });
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          resolve({
            success: false,
            errorMessage: 'Excel file chhungah data hmuh a ni lo. Worksheet a ruak a ni thei e.',
            rows: [],
            detectedColumns: [],
            totalParsed: 0
          });
          return;
        }

        // Get header keys from first row
        const headers = Object.keys(rawJson[0]);
        const matched = identifyColumns(headers);

        // Strict validation: Hming / Name MUST be detected
        if (!matched.nameCol) {
          resolve({
            success: false,
            errorMessage: 'Format a inmil lo tlat mai! Excel-ah "Hming" (Member Name) column hmuh a ni lo. Khawngaihin Sample Format hi download la, a column angin i data dah lut rawh le.',
            rows: [],
            detectedColumns: headers,
            totalParsed: 0
          });
          return;
        }

        const parsedRows: ParsedMemberRow[] = [];

        rawJson.forEach((row, index) => {
          const rawName = String(row[matched.nameCol!] || '').trim();
          if (!rawName) return; // Skip completely empty name rows

          const rawFather = matched.fatherNameCol ? String(row[matched.fatherNameCol] || '').trim() : '';
          const rawPhone = matched.phoneCol ? String(row[matched.phoneCol] || '').trim() : '';
          const rawSection = matched.sectionCol ? String(row[matched.sectionCol] || '').trim() : '';
          const rawDep = matched.dependentsCol ? String(row[matched.dependentsCol] || '').trim() : '';
          const rawTarget = matched.targetCol ? parseFloat(String(row[matched.targetCol]).replace(/[^0-9.]/g, '')) : undefined;

          parsedRows.push({
            name: rawName,
            fatherName: rawFather || undefined,
            phone: rawPhone || undefined,
            section: rawSection || undefined,
            dependentsRaw: rawDep || undefined,
            pledgeAmount: isNaN(rawTarget as number) ? undefined : rawTarget,
            rowNumber: index + 2 // 1-based, row 1 is header
          });
        });

        if (parsedRows.length === 0) {
          resolve({
            success: false,
            errorMessage: 'Member hming pakhat mah hmuh a ni lo. Row zawng zawng a ruak vek a ni thei e.',
            rows: [],
            detectedColumns: headers,
            totalParsed: 0
          });
          return;
        }

        resolve({
          success: true,
          rows: parsedRows,
          detectedColumns: headers,
          totalParsed: parsedRows.length
        });
      } catch (err: any) {
        console.error('Failed to parse Excel file:', err);
        resolve({
          success: false,
          errorMessage: `Excel file chhiar a theih loh: ${err?.message || 'File format a dik lo a ni thei e.'}`,
          rows: [],
          detectedColumns: [],
          totalParsed: 0
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        errorMessage: 'File upload laia buaina a awm. Khawngaihin file hi thlang ṭha leh rawh.',
        rows: [],
        detectedColumns: [],
        totalParsed: 0
      });
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Parses free text pasted by user (e.g. copied from WhatsApp, Notes or CSV text)
 */
export function parsePastedText(text: string): ImportValidationResult {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return {
      success: false,
      errorMessage: 'Text chhut luh a ruak tlat mai.',
      rows: [],
      detectedColumns: [],
      totalParsed: 0
    };
  }

  // Check if first line is a header
  let startIndex = 0;
  const firstLower = lines[0].toLowerCase();
  if (firstLower.includes('hming') || firstLower.includes('name')) {
    startIndex = 1;
  }

  const parsedRows: ParsedMemberRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    // Split by comma or tab
    const delimiter = line.includes('\t') ? '\t' : (line.includes(',') ? ',' : '|');
    const parts = line.split(delimiter).map(p => p.trim());

    if (parts.length === 0 || !parts[0]) continue;

    const name = parts[0];
    const fatherName = parts[1] || undefined;
    const phone = parts[2] || undefined;
    const section = parts[3] || undefined;
    const dependentsRaw = parts[4] || undefined;
    const rawTarget = parts[5] ? parseFloat(parts[5].replace(/[^0-9.]/g, '')) : undefined;

    parsedRows.push({
      name,
      fatherName: fatherName || undefined,
      phone: phone || undefined,
      section: section || undefined,
      dependentsRaw: dependentsRaw || undefined,
      pledgeAmount: isNaN(rawTarget as number) ? undefined : rawTarget,
      rowNumber: i + 1
    });
  }

  if (parsedRows.length === 0) {
    return {
      success: false,
      errorMessage: 'Text aṭangin member hming hmuh a ni lo. Format hi: Hming, Pa Hming, Phone, Section tiin dah rawh le.',
      rows: [],
      detectedColumns: ['Text List'],
      totalParsed: 0
    };
  }

  return {
    success: true,
    rows: parsedRows,
    detectedColumns: ['Pasted Text'],
    totalParsed: parsedRows.length
  };
}

/**
 * Converts parsed member rows into full MemberRecord items with auto-assigned roll numbers.
 */
export function convertToMemberRecords(
  rows: ParsedMemberRow[],
  campaignId: string,
  prefixCode: string,
  existingMembers: MemberRecord[]
): MemberRecord[] {
  const cleanPrefix = (prefixCode || 'MEM').toUpperCase().trim();
  const campMembers = existingMembers.filter(m => m.campaignId === campaignId);

  // Find highest existing numeric sequence for this prefix
  let maxSeq = 0;
  for (const m of campMembers) {
    if (m.id && m.id.toUpperCase().startsWith(cleanPrefix)) {
      const parts = m.id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  const now = new Date().toISOString();

  return rows.map((r) => {
    // Generate sequential ID: e.g. BET-001, BET-002, or BET-105
    const idNum = String(nextSeq++).padStart(3, '0');
    const memberId = `${cleanPrefix}-${idNum}`;

    // Clean phone number
    const cleanPhone = (r.phone || '').replace(/[^0-9]/g, '');
    const phoneLast4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : (cleanPhone || undefined);

    // Parse dependents if provided: "Lalthanpuii (Nupui), Lalruatfela (Fa)"
    const deps: MemberDependent[] = [];
    if (r.dependentsRaw) {
      const rawList = r.dependentsRaw.split(/[,;]/).map(d => d.trim()).filter(d => d.length > 0);
      rawList.forEach((rawDepStr, idx) => {
        let depName = rawDepStr;
        let depRel = 'Chhungkua';

        // Check if relation is in brackets, e.g. "Lalthanpuii (Nupui)"
        const match = rawDepStr.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) {
          depName = match[1].trim();
          depRel = match[2].trim();
        }

        deps.push({
          subId: `${memberId}-${idx + 1}`,
          name: depName,
          relation: depRel
        });
      });
    }

    const member: MemberRecord = {
      id: memberId,
      campaignId,
      name: r.name.trim(),
      fatherName: r.fatherName?.trim() || undefined,
      orgCode: cleanPrefix,
      phoneLast4,
      fullPhone: cleanPhone || undefined,
      section: r.section?.trim() || undefined,
      isFamilyHead: true,
      dependents: deps.length > 0 ? deps : undefined,
      pledgeAmount: r.pledgeAmount,
      createdAt: now
    };

    return member;
  });
}
