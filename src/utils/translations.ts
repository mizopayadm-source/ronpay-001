import { useState, useEffect } from 'react';
import { BawmCategory, Campaign, Transaction } from '../types';

export type Language = 'mizo' | 'english';

/**
 * Universal Bilingual Category Display Name Helper
 */
export function getCategoryDisplayName(category: string, lang?: Language | string): string {
  const isEnglish = lang === 'english' || lang === 'en';
  if (isEnglish) {
    switch (category) {
      case 'ralna': return 'Condolence Bawm';
      case 'khawlsak': return 'Charity & Welfare';
      case 'rikrum': return 'Emergency Relief';
      case 'kumtluang': return 'Permanent NGO / Church';
      case 'others': return 'Bills & Utilities';
      default: return category ? category.toUpperCase() : 'Bawm';
    }
  } else {
    switch (category) {
      case 'ralna': return 'Ralna Bawm';
      case 'khawlsak': return 'Khawlsak Bawm';
      case 'rikrum': return 'Rikrum Bawm';
      case 'kumtluang': return 'Kumtluang Bawm';
      case 'others': return 'Others (Bills)';
      default: return category ? category : 'Bawm';
    }
  }
}

/**
 * Clean, standard category label for receipts and printed documents.
 * Ensures donations are never branded as 'OTHERS (BILLS & RECHARGE)'.
 */
export function formatCategoryBawmLabel(cat?: BawmCategory | string, lang?: Language | string): string {
  const isEnglish = lang === 'english' || lang === 'en';
  const c = String(cat || '').toLowerCase().trim();
  if (c === 'ralna') return isEnglish ? 'RALNA BAWM (CONDOLENCE)' : 'RALNA BAWM';
  if (c === 'khawlsak') return isEnglish ? 'KHAWLSAK BAWM (WELFARE)' : 'KHAWLSAK BAWM';
  if (c === 'rikrum') return isEnglish ? 'RIKRUM BAWM (EMERGENCY)' : 'RIKRUM BAWM';
  if (c === 'kumtluang') return isEnglish ? 'KUMTLUANG BAWM (PERMANENT)' : 'KUMTLUANG BAWM';
  if (c === 'others') return isEnglish ? 'BILLS & RECHARGE' : 'BILLS & RECHARGE';
  return isEnglish ? 'COMMUNITY BAWM' : 'COMMUNITY BAWM';
}

/**
 * Safely deduce the true Bawm category from transaction details,
 * ensuring donations and community Bawms are NEVER mistakenly labeled as 'others' (Bills/Recharge).
 */
export function getEffectiveCategory(
  t?: Partial<Transaction> | null,
  campaignsList?: Campaign[]
): BawmCategory {
  if (!t) return 'khawlsak';

  // 1. Explicit utility / bill transaction check - ONLY genuine bills & recharges are 'others'
  const isExplicitBill = 
    Boolean(t.billServiceType || t.billConsumerNumber || t.billOperator) ||
    String(t.id || '').startsWith('BILL-') || 
    String(t.id || '').startsWith('TXN-BILL-') || 
    String(t.campaignId || '').startsWith('bill-');

  if (isExplicitBill) {
    return 'others';
  }

  // 2. If already set to a valid specific Bawm category, return it
  const cat = t.category;
  if (cat === 'ralna' || cat === 'khawlsak' || cat === 'rikrum' || cat === 'kumtluang') {
    return cat;
  }

  // 3. Search campaigns by ID or Title
  let allCamps: Campaign[] = campaignsList || [];
  if (allCamps.length === 0 && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('RONPAY_CAMPAIGNS_v2') || localStorage.getItem('ronpay_campaigns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) allCamps = parsed;
      }
    } catch (e) {}
  }

  if (t.campaignId && allCamps.length > 0) {
    const matched = allCamps.find(c => c.id === t.campaignId);
    if (matched?.category && matched.category !== 'others') {
      return matched.category;
    }
  }

  const titleLower = String(t.campaignTitle || '').toLowerCase().trim();
  if (titleLower && allCamps.length > 0) {
    const matched = allCamps.find(c => 
      c.title?.toLowerCase().trim() === titleLower ||
      c.titleMizo?.toLowerCase().trim() === titleLower ||
      c.cause?.toLowerCase().trim() === titleLower
    );
    if (matched?.category && matched.category !== 'others') {
      return matched.category;
    }
  }

  // 4. Keyword heuristics for Mizo community causes
  if (titleLower.includes('ralna') || titleLower.includes('mitthi') || titleLower.includes('sunna')) {
    return 'ralna';
  }
  if (
    titleLower.includes('pocket') || 
    titleLower.includes('khawl') || 
    titleLower.includes('saving') || 
    titleLower.includes('hnuchham') || 
    titleLower.includes('damlo') || 
    titleLower.includes('tanpui') || 
    titleLower.includes('welfare') ||
    titleLower.includes('charity') ||
    titleLower.includes('ebenezer')
  ) {
    return 'khawlsak';
  }
  if (
    titleLower.includes('rikrum') || 
    titleLower.includes('emergency') || 
    titleLower.includes('chhiatrupna') || 
    titleLower.includes('kangmei') || 
    titleLower.includes('accident') || 
    titleLower.includes('rescue')
  ) {
    return 'rikrum';
  }
  if (
    titleLower.includes('kumtluang') || 
    titleLower.includes('member') || 
    titleLower.includes('thlatin') || 
    titleLower.includes('lawmman') || 
    titleLower.includes('inkhawmpui') || 
    titleLower.includes('khualthang')
  ) {
    return 'kumtluang';
  }

  // 5. If category was marked 'others' or missing but it's not a bill, correct it to 'khawlsak'
  return 'khawlsak';
}

/**
 * Resolves the Bawm's geographic location, organization, or Veng
 * for receipts and transaction slips.
 */
export function resolveTxCampaignLocation(
  tx?: Partial<Transaction> | null,
  campaignsList?: Campaign[]
): string {
  if (!tx) return '';

  let allCamps: Campaign[] = campaignsList || [];
  if (allCamps.length === 0 && typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('RONPAY_CAMPAIGNS_v2') || localStorage.getItem('ronpay_campaigns');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) allCamps = parsed;
      }
    } catch (e) {}
  }

  // 1. Try matching by campaignId
  if (tx.campaignId && allCamps.length > 0) {
    const matched = allCamps.find(c => c.id === tx.campaignId);
    if (matched) {
      if (matched.location && matched.orgName) {
        return `${matched.location} (${matched.orgName})`;
      }
      if (matched.location) return matched.location;
      if (matched.orgName) return matched.orgName;
    }
  }

  // 2. Try matching by campaignTitle
  const titleLower = String(tx.campaignTitle || '').toLowerCase().trim();
  if (titleLower && allCamps.length > 0) {
    const matched = allCamps.find(c => 
      c.title?.toLowerCase().trim() === titleLower ||
      c.titleMizo?.toLowerCase().trim() === titleLower
    );
    if (matched) {
      if (matched.location && matched.orgName) {
        return `${matched.location} (${matched.orgName})`;
      }
      if (matched.location) return matched.location;
      if (matched.orgName) return matched.orgName;
    }
  }

  // 3. Known campaign locations & titles
  if (titleLower.includes('pocket') || titleLower.includes('ebenezer')) {
    return 'BCM Ebenezer, Aizawl, Mizoram';
  }
  if (titleLower.includes('lalrinpuii') || titleLower.includes('bungkawn')) {
    return 'Bungkawn Vengthar, Aizawl';
  }
  if (titleLower.includes('hnuchham') || titleLower.includes('dawrpui')) {
    return 'Dawrpui, Aizawl, Mizoram';
  }

  // 4. Donor veng if provided
  if (tx.donorVeng) {
    return `${tx.donorVeng}, Mizoram`;
  }

  return '';
}

export const TRANSLATIONS = {
  mizo: {
    appTitle: 'RonPay',
    tagline: 'Mizoram Bawm & Digital Community Pay',
    autoGps: 'GPS Auto-Detected',
    refreshGps: 'GPS Re-detect',
    vengSelector: 'Veng-te',
    allVeng: 'Veng Zawng Zawng',
    searchVeng: 'Veng zawng rawh...',
    searchPlaceholder: 'Bawm, Kohhran, Mitthi, Tanpuina zawng rawh...',
    peknaSulhnu: 'Pekna Sulhnu',
    peknaSulhnuSub: 'I thil thawh & Transaction History',
    createQR: 'QR Siamna',
    createQRSub: 'Ralna, Khawlsak, Rikrum, Kumtluang',
    scanQR: 'Scan Any QR',
    toBank: 'To Bank',
    toBankSub: 'Bank Settlement & Transfer',
    checkBalance: 'RonPay Wallet',
    billServices: 'Bill & Recharges',
    activeCampaigns: 'Bawm Hrang Hrangte',
    viewAll: 'En Veve',
    giveNow: 'Pe Rawh',
    share: 'Share',
    downloadQR: 'Download QR',
    copyLink: 'Link Copy',
    expiredWarning: 'Pek hun a tawp tawh!',
    expiredSub: 'He campaign/QR hi a expire tawh avangin payment tih theih a ni rih lo.',
    reactivate: 'Hun Pawtsei / Reactivate',
    creatorLogin: 'Creator Login',
    adminDashboard: 'Admin Panel',
    adminLogin: 'Admin Login',
    verified: 'Verified',
    totalCollection: 'Pek Tling Khawm Zat',
    target: 'Target',
    expiresOn: 'Pek theih hun tawp',
    status: 'Status',
    active: 'Active',
    expired: 'Expired',
    pending: 'Pending',
    reports: 'Report & Export',
    noAppNeeded: 'RonPay Apps download kher a ngai lo, web & UPI apps dang atangin a pek nghal mai theih e.',
    downloadApp: 'Download RonPay App',
    fetchLiveBill: 'Fetch / Check Live Bill',
    officialPortal: 'Official Department Portal',
    
    // Form & Bawm Field Labels
    nameLabel: 'Hming (Name)',
    vengLabel: 'Veng / Khua (Locality / Town)',
    phoneLabel: 'Phone Number',
    contactLabel: 'Chhungte / Contact',
    deceasedName: 'Mitthi Hming (Deceased Name)',
    ageLabel: 'Kum / Age',
    dateOfDeath: 'Thih Ni (Date of Demise)',
    funeralTime: 'Vui Hun (Funeral Time)',
    officiator: 'Vuitu (Officiator)',
    causeLabel: 'Chhan / Tanpuina Pual (Cause / Purpose)',
    targetAmountLabel: 'Target Amount (₹)',
    validUntil: 'Valid Thleng (Valid Until)',
    donorNameLabel: 'Petu Hming / Chhungkua',
    amountLabel: 'Pek Zat (Amount)',
    customAmount: 'Pek zat dang chhut luhna',
    anonymousLabel: 'Hming thupin pe rawh (Anonymous)',
    receiptTitle: 'Pekna Receipt & Summary',
    paymentMethod: 'Pek Dan (Method)',
    collectorTitle: 'Bawm Khawltute (Organizers)',
    linkVehicle: 'Link Vehicle',
    linkFetch: 'Link & Fetch',
    linking: 'Linking...',
    quickAmount: 'Quick Top-Up Amount (₹)',
    payNow: 'Pay Now',
    electricBoardLabel: 'Electricity Department / Circle *',
    consumerIdLabel: 'Consumer ID / Meter Connection Number *',
    fastagBankLabel: 'FASTag Issuing Bank *',
    vehicleNumberLabel: 'Vehicle Registration Number (RC No.) *',
    waterConnectionLabel: 'PHE Water Connection / Consumer ID *',
    waterVengLabel: 'Veng / Locality / Sub-Division *',

    categories: {
      ralna: 'Ralna Bawm',
      khawlsak: 'Khawlsak Bawm',
      rikrum: 'Rikrum Bawm',
      kumtluang: 'Kumtluang Bawm',
    },
    filterAll: 'Bawm Zawng Zawng',
  },
  english: {
    appTitle: 'RonPay',
    tagline: 'Mizoram Community Bawm & Digital Payment System',
    autoGps: 'GPS Auto-Detected',
    refreshGps: 'Re-detect GPS',
    vengSelector: 'Localities',
    allVeng: 'All Localities',
    searchVeng: 'Search locality...',
    searchPlaceholder: 'Search campaigns, churches, relief funds...',
    peknaSulhnu: 'Donation History',
    peknaSulhnuSub: 'Your past contributions & receipts',
    createQR: 'Create QR',
    createQRSub: 'Condolence, Charity, Relief, Permanent',
    scanQR: 'Scan Any QR',
    toBank: 'To Bank',
    toBankSub: 'Bank Settlement & Transfer',
    checkBalance: 'RonPay Wallet',
    billServices: 'Bill & Utility Payments',
    activeCampaigns: 'Active Community Bawm Collections',
    viewAll: 'View All',
    giveNow: 'Contribute Now',
    share: 'Share',
    downloadQR: 'Download QR',
    copyLink: 'Copy Link',
    expiredWarning: 'Campaign Has Ended / Expired!',
    expiredSub: 'This collection campaign has concluded its active period. New payments are currently paused.',
    reactivate: 'Extend Validity / Reactivate',
    creatorLogin: 'Creator Portal',
    adminDashboard: 'Admin Dashboard',
    adminLogin: 'Admin Login',
    verified: 'Verified',
    totalCollection: 'Total Collected',
    target: 'Target Goal',
    expiresOn: 'Validity Ends',
    status: 'Status',
    active: 'Active',
    expired: 'Expired',
    pending: 'Pending Approval',
    reports: 'Reports & Export',
    noAppNeeded: 'No app download needed. Scan and contribute directly with any UPI app on the web.',
    downloadApp: 'Download RonPay App',
    fetchLiveBill: 'Fetch / Check Live Bill',
    officialPortal: 'Official Department Portal',
    
    // Form & Bawm Field Labels
    nameLabel: 'Name',
    vengLabel: 'Locality / Village / Town',
    phoneLabel: 'Mobile Phone Number',
    contactLabel: 'Family / Contact Person',
    deceasedName: 'Deceased Person Full Name',
    ageLabel: 'Age (Years)',
    dateOfDeath: 'Date & Time of Demise',
    funeralTime: 'Funeral Service Time',
    officiator: 'Officiating Pastor / Elder',
    causeLabel: 'Cause / Support Purpose / Details',
    targetAmountLabel: 'Target Goal Amount (₹)',
    validUntil: 'Valid Until Date',
    donorNameLabel: 'Contributor / Family Name',
    amountLabel: 'Donation Amount (₹)',
    customAmount: 'Enter custom amount',
    anonymousLabel: 'Keep donation anonymous',
    receiptTitle: 'Contribution Receipt & Summary',
    paymentMethod: 'Payment Mode',
    collectorTitle: 'Organizers & Collecting Committee',
    linkVehicle: 'Link Vehicle',
    linkFetch: 'Link & Fetch',
    linking: 'Linking...',
    quickAmount: 'Quick Top-Up Amount (₹)',
    payNow: 'Pay Now',
    electricBoardLabel: 'Electricity Department / Circle *',
    consumerIdLabel: 'Consumer ID / Meter Connection Number *',
    fastagBankLabel: 'FASTag Issuing Bank *',
    vehicleNumberLabel: 'Vehicle Registration Number (RC No.) *',
    waterConnectionLabel: 'PHE Water Connection / Consumer ID *',
    waterVengLabel: 'Village / Locality / Sub-Division *',

    categories: {
      ralna: 'Condolence Bawm',
      khawlsak: 'Charity & Welfare',
      rikrum: 'Emergency Relief',
      kumtluang: 'Permanent / NGO Bawm',
    },
    filterAll: 'All Categories',
  }
};

/**
 * Dynamic Text & Sentence Dictionary for Mizo <-> English translation
 */
const MIZO_TO_EN_DICTIONARY: Record<string, string> = {
  // Common descriptions & causes
  "Tuilian vanga harsatna tawk tu te tan tanpuina vehbur khawn sak a ni": "Relief fundraising appeal for families and victims affected by flood disaster.",
  "Tuilian vanga harsatna tawk tu te tan tanpuina vehbur khawn sak a ni.": "Relief fundraising appeal for families and victims affected by flood disaster.",
  "Zankhuaa ruahtui tla nasa avangin in 4 a chim a, chhungkaw 18 chhiat tawk te tanpui nan.": "Due to heavy rainfall overnight, 4 houses collapsed, raising emergency relief for 18 affected families.",
  "Hnuchham naupang lehkha zirna senso, damdawi leh nitin mamawh chawmna fund vawmchhohna pual a ni e.": "Fundraising dedicated to orphan children's education, medical expenses, and daily living necessities.",
  "Kunga hi amah chauha khawsa, hna thawk thei lo a ni a, tanpui a ngai hle": "Kunga lives alone, is unable to work, and is in great need of help.",
  "Kunga hi amah chauha khawsa, hna thawk thei lo a ni a, tanpui a ngai hle.": "Kunga lives alone, is unable to work, and is in great need of help.",
  "Kunga Tanpuina": "Kunga Welfare & Support Fund",
  "Naupang apute tanpui leh ei & bar chawmna fund vawmchhohna pual a ni e.": "Fundraising for orphan assistance, daily nutrition and basic livelihood support.",
  "Kidney transplant nei tur senso tanpuina pual.": "Financial assistance fund for kidney transplant surgery and medical treatment.",
  "Pawisa khawl sak chhunluh sak nan hman tur a ni a, kan enchhin...": "Dedicated to depositing and building personal savings, created for testing purposes.",
  "Pawisa khawl sak chhunluh sak nan hman tur a ni a, kan enchhin": "Dedicated to depositing and building personal savings, created for testing purposes.",
  "Pawisa khawl sak chhunluh sak nan hman tur a ni a": "Intended for depositing and accumulating personal savings.",
  "Pocket Money": "Pocket Money",
  "Pocket money": "Pocket Money",
  "Pawisa khawl": "Personal Savings",
  "Pawisa khawl sak": "Personal Savings Accumulation",
  "Enchhinna": "Trial Testing",
  "Kan enchhin": "Testing / Trial Run",
  "Kanan Veng In Kang Tanpuina": "Emergency relief support for house fire victims in Kanan Veng.",
  "Kangmei Relief Support": "Emergency Fire Disaster Relief Support",
  "Hnuchham Pual Donation": "Orphan Welfare & Child Support Donation",
  "Zothan Damlo Enkawlna Tanpuina": "Medical Treatment & Care Support Fund",
  "Pi Lalhmingliani Ralna": "Condolence & Funeral Support for Late Pi Lalhmingliani",
  "Pu C. Vanlalruata Ralna": "Condolence & Funeral Support for Late Pu C. Vanlalruata",
  "BCM Ebenezer, Zobawk": "BCM Ebenezer Church, Zobawk",
  "Khatla Presbyterian Kohhran": "Khatla Presbyterian Church, Aizawl",
  
  // Field terms
  "Hming": "Name",
  "Veng / Khua": "Village / Town / Locality",
  "Veng": "Locality",
  "Khua": "Village / Town",
  "Chhan": "Cause / Purpose",
  "Details": "Details",
  "Causes": "Causes & Reasons",
  "Tanpui ngaite": "The Needy",
  "Chhiatni": "Bereavement / Condolence",
  "YMA Pual": "For YMA",
  "Pekna-ah lut rawh": "Proceed to Contribute",
  "Pek theih hun a tawp": "Expired / Concluded",
  
  // Sub-categories & Purposes
  "Pathian Ram Zauna": "General Church Mission Fund",
  "Mission": "Evangelism & Mission",
  "Building Fund": "Church Building Fund",
  "Tualchhung": "Local Church Operations",
  "Biak In Sakna": "Church Sanctuary Construction",
  "Ramthianghlim": "Holy Land Support",
  "Synod Mission": "Synod Mission Board",
  "Kohhran Hmeichhia": "Women Fellowship Fund",
  "KTP Thawhlawm": "Youth Fellowship Offering",
  
  "YMA Vengthar Branch": "YMA Vengthar Branch",
  "Chhiatni & Condolence (YMA Pual)": "Condolences & Bereavement Support (YMA)",
  "Riangvai, Chanhai & Tanpui ngaite": "Underprivileged, Helpless & Needy Welfare",
  "Emergency, Kangmei & Tuilian": "Emergency, Fire & Disaster Relief",
  "Permanent NGO, Kohhran & Pawl": "Churches, NGOs & Permanent Organizations",
  "Dawrpui, Aizawl, Mizoram": "Dawrpui, Aizawl, Mizoram",
  "Chanmari, Aizawl, Mizoram": "Chanmari, Aizawl, Mizoram",
  "Kanan Veng, Aizawl, Mizoram": "Kanan Veng, Aizawl, Mizoram",
  "Bawngkawn, Aizawl, Mizoram": "Bawngkawn, Aizawl, Mizoram",
  "Bungkawn, Aizawl": "Bungkawn, Aizawl",
  "Mission Veng, Aizawl": "Mission Veng, Aizawl",
  "Zobawk, Lunglei, Mizoram": "Zobawk, Lunglei, Mizoram",
  "Khatla, Aizawl, Mizoram": "Khatla, Aizawl, Mizoram",
  
  // Emergency & Disaster phrases
  "Zankhuaa ruahtui tla nasa avangin in 4 a chim a, chhungkaw 18 chhiat tawk te tanpui nan": "Due to heavy rainfall overnight, 4 houses collapsed, raising support for 18 affected families.",
  "Hnuchham naupang lehkha zirna senso, damdawi leh nitin mamawh chawmna fund vawmchhohna pual a ni e": "Fundraising to support education expenses, medicines, and daily basic needs for orphan children.",
  "Zankhuaa kangmei chhuakah in 2 a kangral a, chhungkaw 6 chhiat tawk te tanpui nan.": "Overnight house fire disaster destroyed 2 homes, raising relief support for 6 affected families.",
  "Zankhuaa kangmei chhuak avangin in 2 a kangral a, chhungkaw 6 tanpuina pual a ni e.": "Overnight house fire destroyed 2 homes, raising relief support for 6 affected families.",
  "Zankhuaa kangmei chhuakah in a kangral a, chhungkaw 3 chhiat tawk te tanpui nan.": "Overnight house fire disaster destroyed homes, raising relief support for 3 affected families."
};

// In-Memory & LocalStorage translation cache
const TRANSLATION_CACHE_KEY = 'ronpay_translation_cache_v1';
const TRANSLATION_CACHE: Record<string, string> = (() => {
  try {
    const raw = localStorage.getItem(TRANSLATION_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
})();

function saveToTranslationCache(key: string, value: string) {
  try {
    TRANSLATION_CACHE[key] = value;
    localStorage.setItem(TRANSLATION_CACHE_KEY, JSON.stringify(TRANSLATION_CACHE));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Intelligent rule-based Mizo to English text converter for ANY campaign title or cause
 */
export function formatMizoTextToEnglish(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (MIZO_TO_EN_DICTIONARY[trimmed]) {
    return MIZO_TO_EN_DICTIONARY[trimmed];
  }

  // Ralna Condolence support titles
  if (/\bRalna$/i.test(trimmed)) {
    const person = trimmed.replace(/\s*Ralna$/i, '').trim();
    return `Condolence Support for Late ${person}`;
  }

  // Tanpuina / Support fund titles
  if (/\bTanpuina$/i.test(trimmed)) {
    const subject = trimmed.replace(/\s*Tanpuina$/i, '').trim();
    const translatedSubject = formatMizoKeywords(subject);
    return `${translatedSubject} Support Fund`;
  }

  // Tanpui Nan
  if (/\bTanpui Nan$/i.test(trimmed)) {
    const subject = trimmed.replace(/\s*Tanpui Nan$/i, '').trim();
    const translatedSubject = formatMizoKeywords(subject);
    return `${translatedSubject} Relief Appeal`;
  }

  // Thawhlawm
  if (/\bThawhlawm$/i.test(trimmed)) {
    const subject = trimmed.replace(/\s*Thawhlawm$/i, '').trim();
    const translatedSubject = formatMizoKeywords(subject);
    return `${translatedSubject} Offering & Contributions`;
  }

  // Enkawlna
  if (/\bEnkawlna$/i.test(trimmed)) {
    const subject = trimmed.replace(/\s*Enkawlna$/i, '').trim();
    const translatedSubject = formatMizoKeywords(subject);
    return `${translatedSubject} Care & Treatment Fund`;
  }

  // Pual Donation
  if (/\bPual Donation$/i.test(trimmed)) {
    const subject = trimmed.replace(/\s*Pual Donation$/i, '').trim();
    const translatedSubject = formatMizoKeywords(subject);
    return `${translatedSubject} Welfare Donation`;
  }

  // Pual
  if (/\bPual$/i.test(trimmed)) {
    const subject = trimmed.replace(/\s*Pual$/i, '').trim();
    const translatedSubject = formatMizoKeywords(subject);
    return `Dedicated Fund for ${translatedSubject}`;
  }

  return formatMizoKeywords(trimmed);
}

/**
 * Replace Mizo keywords and sentence structures with natural English
 */
function formatMizoKeywords(str: string): string {
  let res = str;

  // Rain / weather
  res = res.replace(/zankhuaa ruahtui tla nasa avangin/gi, "due to heavy rainfall overnight");
  res = res.replace(/ruahtui tla nasa avangin/gi, "due to torrential rainfall");
  res = res.replace(/zankhuaa/gi, "overnight");

  // Houses / Collapses
  res = res.replace(/in\s+(\d+)\s+a chim a/gi, "$1 houses collapsed and");
  res = res.replace(/in\s+(\d+)\s+a chim/gi, "$1 houses collapsed");
  res = res.replace(/in chim avangin/gi, "due to house collapse");
  res = res.replace(/in a chim/gi, "house collapsed");

  // Fire disasters
  res = res.replace(/in kang tanpuina/gi, "house fire disaster relief");
  res = res.replace(/in kang/gi, "house fire");
  res = res.replace(/kangmei chhuak avangin/gi, "due to fire outbreak");
  res = res.replace(/in\s+(\d+)\s+a kangral a/gi, "$1 houses were burned down and");
  res = res.replace(/in\s+(\d+)\s+a kangral/gi, "$1 houses burned down");
  res = res.replace(/kangral/gi, "burned down");
  res = res.replace(/kangmei chhiatna/gi, "fire disaster");

  // Flood & Landslide
  res = res.replace(/tuilian vanga harsatna tawk tu te tan tanpuina vehbur khawn sak a ni\.?/gi, "Relief fundraising appeal for victims affected by flood disaster.");
  res = res.replace(/tuilian tanpuina/gi, "flood disaster relief");
  res = res.replace(/tuilian avangin/gi, "due to flood");
  res = res.replace(/tuilian/gi, "flood disaster");
  res = res.replace(/leimin tanpuina/gi, "landslide disaster relief");
  res = res.replace(/leimin avangin/gi, "due to landslide");
  res = res.replace(/leimin/gi, "landslide");

  // Families & victims
  res = res.replace(/chhungkaw\s+(\d+)\s+chhiat tawk te/gi, "$1 affected families");
  res = res.replace(/chhungkaw\s+(\d+)/gi, "$1 families");
  res = res.replace(/chhiat tawk te/gi, "disaster victims");
  res = res.replace(/tuartu te/gi, "those affected");
  res = res.replace(/chhungkua/gi, "family");

  // Support & Funds
  res = res.replace(/tanpui nan\.?/gi, "for relief assistance.");
  res = res.replace(/tanpui nan/gi, "for relief assistance");
  res = res.replace(/tanpuina pual a ni e\.?/gi, "dedicated relief fund.");
  res = res.replace(/tanpuina pual/gi, "dedicated support fund");
  res = res.replace(/fund vawmchhohna pual a ni e\.?/gi, "fundraising initiative.");
  res = res.replace(/fund vawmchhohna/gi, "fundraising appeal");

  // Savings, Pocket Money & Testing phrases
  res = res.replace(/pawisa khawl sak chhunluh sak nan hman tur a ni a,?\s*kan enchhin(?:\.|\s)*$/gi, "Dedicated to depositing and building personal savings, created for testing purposes.");
  res = res.replace(/pawisa khawl sak chhunluh sak nan hman tur a ni a/gi, "Intended for depositing and building personal savings,");
  res = res.replace(/pawisa khawl sak chhunluh nan/gi, "for personal savings deposits");
  res = res.replace(/pawisa khawl sak nan/gi, "for saving money");
  res = res.replace(/pawisa khawl sak/gi, "personal savings accumulation");
  res = res.replace(/pawisa khawl/gi, "money savings");
  res = res.replace(/chhunluh sak nan/gi, "for depositing into");
  res = res.replace(/chhunluh nan/gi, "for depositing");
  res = res.replace(/hman tur a ni a/gi, "is intended to be used for,");
  res = res.replace(/hman tur/gi, "to be used for");
  res = res.replace(/kan enchhin(?:\.|\s)*$/gi, "we are conducting a trial test.");
  res = res.replace(/kan enchhin/gi, "trial testing");
  res = res.replace(/enchhin nan/gi, "for trial testing");
  res = res.replace(/enchhin pual/gi, "testing purpose");
  res = res.replace(/pocket money/gi, "Pocket Money");

  // Education / Student Welfare
  res = res.replace(/zirna senso tanpui nan/gi, "for educational assistance and student welfare");
  res = res.replace(/zirna senso pual/gi, "dedicated educational expense fund");
  res = res.replace(/lehkha zirna senso/gi, "educational expenses");
  res = res.replace(/school fee chawina/gi, "school fee assistance");
  res = res.replace(/hostel fee/gi, "hostel fees");

  // Medical & Welfare
  res = res.replace(/damlo enkawlna tur/gi, "for patient medical care");
  res = res.replace(/damdawi senso pual/gi, "dedicated medical expense fund");
  res = res.replace(/damdawi senso tur/gi, "for medical and treatment expenses");
  res = res.replace(/in entirna senso/gi, "medical examination expenses");
  res = res.replace(/in zaina senso/gi, "surgery and medical operation expenses");
  res = res.replace(/damlo enkawlna/gi, "patient medical treatment");
  res = res.replace(/damlo tanpuina/gi, "medical patient support");
  res = res.replace(/damlo/gi, "patient");
  res = res.replace(/damdawi senso/gi, "medical treatment expenses");
  res = res.replace(/damdawi leh nitin mamawh/gi, "medicines and daily necessities");
  res = res.replace(/hnuchham naupang/gi, "orphan children");
  res = res.replace(/hnuchham/gi, "orphan");
  res = res.replace(/naupang/gi, "children");
  res = res.replace(/riangvai/gi, "destitute");
  res = res.replace(/chanhai/gi, "underprivileged");
  res = res.replace(/chhungkaw chanhai/gi, "underprivileged families");
  res = res.replace(/chhungkaw riangvai/gi, "destitute families");
  res = res.replace(/hmeithai/gi, "widowed family");
  res = res.replace(/tar leh chanhai/gi, "elderly and underprivileged");
  res = res.replace(/amah chauha khawsa/gi, "lives alone");
  res = res.replace(/hna thawk thei lo/gi, "unable to work");
  res = res.replace(/tanpui a ngai hle/gi, "is in urgent need of help");
  res = res.replace(/tanpui a ngai/gi, "needs assistance");
  res = res.replace(/ei & bar/gi, "food and nutrition");
  res = res.replace(/chawmna/gi, "care and sustenance");

  // Church / Community
  res = res.replace(/biak in sak tanpui nan/gi, "for church sanctuary building support");
  res = res.replace(/biak in sakna/gi, "church sanctuary construction");
  res = res.replace(/hall sakna tur/gi, "for community hall construction");
  res = res.replace(/rawngbawlna pual/gi, "dedicated church ministry fund");
  res = res.replace(/rawngbawlna/gi, "ministry service");
  res = res.replace(/presbyterian kohhran/gi, "Presbyterian Church");
  res = res.replace(/kohhran/gi, "church");
  res = res.replace(/tualchhung/gi, "local church operations");
  res = res.replace(/ramthianghlim/gi, "Holy Land");

  // Capitalize first character
  if (res.length > 0) {
    res = res.charAt(0).toUpperCase() + res.slice(1);
  }

  return res;
}

/**
 * Call backend AI translation endpoint to translate text between Mizo and English
 */
export async function translateTextViaApi(
  text: string | undefined | null,
  category: string = 'general',
  targetLang: 'english' | 'mizo' = 'english'
): Promise<string> {
  if (!text || !text.trim()) return '';
  const trimmed = text.trim();
  const cacheKey = `${targetLang}:${trimmed}`;

  // Check memory & persistent cache
  if (TRANSLATION_CACHE[cacheKey]) {
    return TRANSLATION_CACHE[cacheKey];
  }

  // Check static dictionary
  if (targetLang === 'english' && MIZO_TO_EN_DICTIONARY[trimmed]) {
    return MIZO_TO_EN_DICTIONARY[trimmed];
  }

  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmed,
        targetLang: targetLang === 'english' ? 'en' : 'mizo',
        category
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.translatedText) {
        saveToTranslationCache(cacheKey, data.translatedText);
        // Also fire update event so active views can react
        window.dispatchEvent(new CustomEvent('ronpay-translation-updated', { 
          detail: { original: trimmed, translated: data.translatedText, targetLang } 
        }));
        return data.translatedText;
      }
    }
  } catch (err) {
    console.warn('Translate API call error:', err);
  }

  // Fallback pattern matching
  return targetLang === 'english' ? formatMizoTextToEnglish(trimmed) : trimmed;
}

/**
 * Helper to get the correct title text for a campaign based on user language preference
 */
export function translateCampaignTitle(
  campaign: { 
    title?: string; 
    titleEn?: string; 
    titleMizo?: string; 
    mitthiHming?: string; 
    category?: string; 
    emergencyTitle?: string;
    emergencyTitleEn?: string;
    orgName?: string;
  } | null | undefined,
  lang?: string | Language
): string {
  if (!campaign) return '';
  const isEnglish = lang === 'english' || lang === 'en';

  if (isEnglish) {
    if (campaign.titleEn && campaign.titleEn.trim()) {
      return campaign.titleEn.trim();
    }
    // Special handling for Ralna
    if (campaign.category === 'ralna') {
      const person = campaign.mitthiHming || campaign.title?.replace(/\s*Ralna$/i, '') || '';
      return `Condolence Support for Late ${person}`;
    }
    // Special handling for Rikrum with emergencyTitle
    if (campaign.category === 'rikrum') {
      if (campaign.emergencyTitleEn && campaign.emergencyTitleEn.trim()) {
        return campaign.emergencyTitleEn.trim();
      }
      if (campaign.emergencyTitle) {
        return formatMizoTextToEnglish(campaign.emergencyTitle);
      }
    }
    return formatMizoTextToEnglish(campaign.title || campaign.orgName || '');
  } else {
    if (campaign.titleMizo && campaign.titleMizo.trim()) {
      return campaign.titleMizo.trim();
    }
    if (campaign.category === 'rikrum' && campaign.emergencyTitle) {
      return campaign.emergencyTitle;
    }
    return campaign.title || campaign.orgName || '';
  }
}

/**
 * Resolves the primary cause / purpose of a campaign for donations, receipts, and history.
 * Strictly prioritizes the actual donation cause/title (e.g. "Lalrinpuii Ralna", "Kangmei Relief Support")
 * rather than creator organization names (e.g. "BCM Ebenezer").
 */
export function getCampaignCauseTitle(
  campaign?: {
    title?: string;
    titleMizo?: string;
    mitthiHming?: string;
    category?: string;
    emergencyTitle?: string;
    orgName?: string;
    cause?: string;
  } | null,
  fallback = 'RonPay Community Bawm'
): string {
  if (!campaign) return fallback;

  // 1. Ralna: dead person's condolence cause
  if (campaign.category === 'ralna') {
    if (campaign.title && campaign.title.trim()) return campaign.title.trim();
    if (campaign.mitthiHming && campaign.mitthiHming.trim()) {
      const hming = campaign.mitthiHming.trim();
      return hming.toLowerCase().includes('ralna') ? hming : `${hming} Ralna`;
    }
    return 'Ralna Bawm';
  }

  // 2. Rikrum: Emergency relief cause
  if (campaign.category === 'rikrum') {
    if (campaign.emergencyTitle && campaign.emergencyTitle.trim()) return campaign.emergencyTitle.trim();
    if (campaign.title && campaign.title.trim()) return campaign.title.trim();
  }

  // 3. General campaign title
  if (campaign.title && campaign.title.trim()) {
    return campaign.title.trim();
  }

  // 4. Emergency title
  if (campaign.emergencyTitle && campaign.emergencyTitle.trim()) {
    return campaign.emergencyTitle.trim();
  }

  // 5. Cause description if short
  if (campaign.cause && campaign.cause.trim() && campaign.cause.length < 60) {
    return campaign.cause.trim();
  }

  // 6. Organization name as last resort
  if (campaign.orgName && campaign.orgName.trim()) {
    return campaign.orgName.trim();
  }

  return fallback;
}

/**
 * Helper to get the correct cause text for a campaign based on user language preference
 */
export function translateCampaignCause(
  campaign: { cause?: string; causeEn?: string; causeMizo?: string; category?: string } | null | undefined,
  lang?: string | Language
): string {
  if (!campaign) return '';
  const isEnglish = lang === 'english' || lang === 'en';

  if (isEnglish) {
    if (campaign.causeEn && campaign.causeEn.trim()) {
      return campaign.causeEn.trim();
    }
    return translateDynamicText(campaign.cause, 'english', campaign);
  } else {
    if (campaign.causeMizo && campaign.causeMizo.trim()) {
      return campaign.causeMizo.trim();
    }
    return campaign.cause || '';
  }
}

/**
 * Smart translator for campaign text based on selected language
 */
export function translateDynamicText(
  text: string | undefined | null, 
  lang?: string | Language,
  campaign?: { titleEn?: string; titleMizo?: string; emergencyTitleEn?: string; causeEn?: string; causeMizo?: string; [key: string]: any }
): string {
  if (!text) return '';
  const isEnglish = lang === 'english' || lang === 'en';
  if (!isEnglish) {
    if (campaign?.titleMizo && (text === campaign.title || text === campaign.titleEn)) return campaign.titleMizo;
    if (campaign?.causeMizo && (text === campaign.cause || text === campaign.causeEn)) return campaign.causeMizo;
    return text;
  }

  // Pre-translated campaign fields
  if (campaign?.titleEn && (text === campaign.title || text === campaign.titleMizo)) {
    return campaign.titleEn.trim();
  }
  if (campaign?.emergencyTitleEn && (text === campaign.emergencyTitle || text === campaign.emergencyTitleMizo)) {
    return campaign.emergencyTitleEn.trim();
  }
  if (campaign?.causeEn && (text === campaign.cause || text === campaign.causeMizo)) {
    return campaign.causeEn.trim();
  }

  const trimmed = text.trim();
  const cacheKey = `english:${trimmed}`;
  if (TRANSLATION_CACHE[cacheKey]) {
    return TRANSLATION_CACHE[cacheKey];
  }

  if (MIZO_TO_EN_DICTIONARY[trimmed]) {
    return MIZO_TO_EN_DICTIONARY[trimmed];
  }

  // Trigger background AI fetch if not already in cache
  if (typeof window !== 'undefined' && trimmed.length > 3) {
    translateTextViaApi(trimmed, campaign?.category || 'general', 'english').catch(() => {});
  }

  return formatMizoTextToEnglish(trimmed);
}

/**
 * React hook to handle real-time cause translation for user/donors
 */
export function useCampaignCauseTranslation(
  campaign: { cause?: string; causeEn?: string; causeMizo?: string; category?: string } | null | undefined,
  language?: Language | string
): { translatedCause: string; isTranslating: boolean } {
  const isEnglish = language === 'english' || language === 'en';
  const initialText = translateCampaignCause(campaign, language);
  const [translatedCause, setTranslatedCause] = useState<string>(initialText);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  useEffect(() => {
    if (!campaign) {
      setTranslatedCause('');
      return;
    }
    if (!isEnglish) {
      setTranslatedCause(campaign.causeMizo || campaign.cause || '');
      return;
    }
    // If pre-existing English translation
    if (campaign.causeEn && campaign.causeEn.trim()) {
      setTranslatedCause(campaign.causeEn.trim());
      return;
    }

    const rawCause = (campaign.cause || '').trim();
    if (!rawCause) {
      setTranslatedCause('');
      return;
    }

    // Check memory cache
    const cacheKey = `english:${rawCause}`;
    if (TRANSLATION_CACHE[cacheKey]) {
      setTranslatedCause(TRANSLATION_CACHE[cacheKey]);
      return;
    }

    // Check dictionary
    if (MIZO_TO_EN_DICTIONARY[rawCause]) {
      setTranslatedCause(MIZO_TO_EN_DICTIONARY[rawCause]);
      return;
    }

    // Instant rule-based translation
    const ruleBased = formatMizoTextToEnglish(rawCause);
    setTranslatedCause(ruleBased);

    // Fetch dynamic AI translation in background
    let isMounted = true;
    setIsTranslating(true);
    translateTextViaApi(rawCause, campaign.category || 'general', 'english')
      .then((res) => {
        if (isMounted && res) {
          setTranslatedCause(res);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsTranslating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [campaign?.cause, campaign?.causeEn, campaign?.causeMizo, campaign?.category, isEnglish]);

  // Listen to translation broadcast events
  useEffect(() => {
    const handleTranslationUpdate = (e: any) => {
      if (isEnglish && e.detail && campaign?.cause && e.detail.original === campaign.cause.trim()) {
        setTranslatedCause(e.detail.translated);
      }
    };
    window.addEventListener('ronpay-translation-updated', handleTranslationUpdate);
    return () => {
      window.removeEventListener('ronpay-translation-updated', handleTranslationUpdate);
    };
  }, [campaign?.cause, isEnglish]);

  return { 
    translatedCause: translatedCause || campaign?.cause || '', 
    isTranslating 
  };
}

/**
 * React hook to handle real-time title translation for campaigns
 */
export function useCampaignTitleTranslation(
  campaign: { 
    title?: string; 
    titleEn?: string; 
    titleMizo?: string; 
    mitthiHming?: string; 
    category?: string; 
    emergencyTitle?: string;
    emergencyTitleEn?: string;
    orgName?: string;
  } | null | undefined,
  language?: Language | string
): string {
  const isEnglish = language === 'english' || language === 'en';
  const initialTitle = translateCampaignTitle(campaign, language);
  const [translatedTitle, setTranslatedTitle] = useState<string>(initialTitle);

  useEffect(() => {
    setTranslatedTitle(translateCampaignTitle(campaign, language));
  }, [campaign?.title, campaign?.titleEn, campaign?.titleMizo, campaign?.emergencyTitle, campaign?.emergencyTitleEn, campaign?.mitthiHming, language]);

  return translatedTitle || campaign?.title || '';
}
