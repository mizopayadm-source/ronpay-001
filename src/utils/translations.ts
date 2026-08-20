export type Language = 'mizo' | 'english';

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
    checkBalance: 'Balance',
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
    noAppNeeded: 'RonPay Apps download kher a ngai lo, web & UPI apps dang atanga pe mai theih e.',
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
    checkBalance: 'Balance',
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
  "Kunga hi amah chauha khawsa, hna thawk thei lo a ni a, tanpui a ngai hle": "Kunga lives alone, is unable to work, and is in great need of help.",
  "Kunga hi amah chauha khawsa, hna thawk thei lo a ni a, tanpui a ngai hle.": "Kunga lives alone, is unable to work, and is in great need of help.",
  "Kunga Tanpuina": "Kunga Welfare & Support Fund",
  "Naupang apute tanpui leh ei & bar chawmna fund vawmchhohna pual a ni e.": "Fundraising for orphan assistance, daily nutrition and basic livelihood support.",
  "Kidney transplant nei tur senso tanpuina pual.": "Financial assistance fund for kidney transplant surgery and medical treatment.",
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
  
  // Short phrases
  "Chhiatni & Condolence (YMA Pual)": "Condolences & Bereavement Support (YMA)",
  "Riangvai, Chanhai & Tanpui ngaite": "Underprivileged, Helpless & Needy Welfare",
  "Emergency, Kangmei & Tuilian": "Emergency, Fire & Disaster Relief",
  "Permanent NGO, Kohhran & Pawl": "Churches, NGOs & Permanent Organizations",
  "Dawrpui, Aizawl, Mizoram": "Dawrpui, Aizawl, Mizoram",
  "Chanmari, Aizawl, Mizoram": "Chanmari, Aizawl, Mizoram",
  "Kanan Veng, Aizawl, Mizoram": "Kanan Veng, Aizawl, Mizoram",
  "Bungkawn, Aizawl": "Bungkawn, Aizawl",
  "Mission Veng, Aizawl": "Mission Veng, Aizawl",
  "Zobawk, Lunglei, Mizoram": "Zobawk, Lunglei, Mizoram",
  "Khatla, Aizawl, Mizoram": "Khatla, Aizawl, Mizoram"
};

/**
 * Smart translator for campaign text based on selected language
 */
export function translateDynamicText(text: string | undefined | null, lang?: string | Language): string {
  if (!text) return '';
  if (!lang || lang === 'mizo') return text;

  const trimmed = text.trim();
  if (MIZO_TO_EN_DICTIONARY[trimmed]) {
    return MIZO_TO_EN_DICTIONARY[trimmed];
  }

  // Check substring matches for Ralna titles
  if (trimmed.endsWith('Ralna')) {
    const person = trimmed.replace(/\s*Ralna$/, '');
    return `Condolence Support for Late ${person}`;
  }

  if (trimmed.endsWith('Tanpuina')) {
    const subject = trimmed.replace(/\s*Tanpuina$/, '');
    return `Support Fund for ${subject}`;
  }

  if (trimmed.includes('amah chauha khawsa') || trimmed.includes('tanpui a ngai')) {
    return "Kunga lives alone, is unable to work, and is in great need of help.";
  }

  return text;
}
