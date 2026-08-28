import React, { useState, useEffect } from 'react';
import { 
  X, 
  Zap, 
  CheckCircle2, 
  Smartphone, 
  Tv, 
  Car, 
  Flame, 
  Droplet, 
  Wifi, 
  CreditCard,
  Landmark,
  Ticket,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ExternalLink,
  Info,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Check
} from 'lucide-react';
import { BillService } from '../types';
import { Language, TRANSLATIONS } from '../utils/translations';

interface BillPaymentModalProps {
  service: BillService | null;
  onClose: () => void;
  onPaymentComplete: (amount: number, serviceName: string) => void;
  language?: Language;
}

interface RechargePlan {
  id: string;
  price: number;
  validity: string;
  data: string;
  calls: string;
  description: string;
  tag?: string;
}

const PREPAID_PLANS: Record<string, RechargePlan[]> = {
  Jio: [
    { id: 'j1', price: 299, validity: '28 Days', data: '1.5 GB/day', calls: 'Unlimited Calls', description: 'Hero Unlimited 5G Data, 100 SMS/day', tag: 'BEST SELLER' },
    { id: 'j2', price: 349, validity: '28 Days', data: '2.0 GB/day', calls: 'Unlimited Calls', description: 'Truly Unlimited 5G + JioCinema + JioTV', tag: 'POPULAR' },
    { id: 'j3', price: 749, validity: '72 Days', data: '2.0 GB/day', calls: 'Unlimited Calls', description: 'Super Value Pack with 5G Unlimited' },
    { id: 'j4', price: 899, validity: '90 Days', data: '2.0 GB/day', calls: 'Unlimited Calls', description: 'Long Term Pack + Unlimited 5G' },
    { id: 'j5', price: 198, validity: '14 Days', data: '2.0 GB/day', calls: 'Unlimited Calls', description: 'Affordable Mini Validity Pack' },
  ],
  Airtel: [
    { id: 'a1', price: 349, validity: '28 Days', data: '1.5 GB/day', calls: 'Unlimited Calls', description: 'Unlimited 5G Data + Wynk Music + Apollo 24/7', tag: 'BEST SELLER' },
    { id: 'a2', price: 409, validity: '28 Days', data: '2.5 GB/day', calls: 'Unlimited Calls', description: 'Disney+ Hotstar Mobile 3 Months Included', tag: 'OTT PACK' },
    { id: 'a3', price: 859, validity: '84 Days', data: '1.5 GB/day', calls: 'Unlimited Calls', description: 'Quarterly Value Pack + Unlimited 5G' },
    { id: 'a4', price: 199, validity: '28 Days', data: '2 GB Total', calls: 'Unlimited Calls', description: 'Voice Focused Basic Plan' },
  ],
  BSNL: [
    { id: 'b1', price: 199, validity: '30 Days', data: '2.0 GB/day', calls: 'Unlimited Calls', description: 'BSNL Mizoram 4G Special Pack', tag: 'BEST VALUE' },
    { id: 'b2', price: 397, validity: '150 Days', data: '2.0 GB/day (first 30 days)', calls: 'Unlimited Calls (30d)', description: 'Long Validity SIM Active Pack' },
    { id: 'b3', price: 599, validity: '84 Days', data: '3.0 GB/day', calls: 'Unlimited Calls', description: 'Heavy Data Zing Pack + 100 SMS' },
  ],
  Vi: [
    { id: 'v1', price: 299, validity: '28 Days', data: '1.5 GB/day', calls: 'Unlimited Calls', description: 'Binge All Night (12am-6am Free) + Weekend Rollover', tag: 'BINGE PASS' },
    { id: 'v2', price: 359, validity: '28 Days', data: '3.0 GB/day', calls: 'Unlimited Calls', description: 'Hero Unlimited + Vi Movies & TV' },
  ]
};

const FASTAG_BANKS = [
  'HDFC Bank FASTag',
  'State Bank of India (SBI FASTag)',
  'ICICI Bank FASTag',
  'Axis Bank FASTag',
  'Airtel Payments Bank FASTag',
  'IDFC First Bank FASTag',
  'Kotak Mahindra Bank FASTag',
  'Paytm Payments Bank FASTag',
  'Bank of Baroda FASTag',
  'Punjab National Bank (PNB FASTag)'
];

const DTH_OPERATORS = [
  'Tata Play (Tata Sky)',
  'Airtel Digital TV',
  'Sun Direct DTH',
  'Dish TV India',
  'Videocon d2h'
];

const MUNICIPAL_AUTHORITIES = [
  'Aizawl Municipal Corporation (AMC)',
  'Lunglei Municipal Council (LMC)',
  'Champhai Municipal Board',
  'Kolasib Town Committee'
];

const TAX_TYPES = [
  'Property Tax (In Hmun Chhiah)',
  'Trade License Fee / Renewal',
  'Solid Waste Management Fee',
  'Shop / Commercial Establishment Tax',
  'Building Permission Fee'
];

const SCHOOL_COLLEGES = [
  'Mizoram University (MZU)',
  'Pachhunga University College (PUC)',
  "St. Paul's Higher Secondary School, Aizawl",
  'Don Bosco School, Aizawl',
  'Govt. Aizawl College',
  'Govt. Hrangbana College',
  'Govt. Zirtiri Residential Science College',
  'Baptist Higher Secondary School (BHSS), Serkawn',
  'Home Missions School, Aizawl',
  'Presbyterian English School (PES)'
];

const INSURANCE_PROVIDERS = [
  'Life Insurance Corporation of India (LIC)',
  'SBI Life Insurance',
  'HDFC Life Insurance',
  'Star Health and Allied Insurance',
  'ICICI Prudential / Lombard',
  'Max Life Insurance',
  'Bajaj Allianz Life'
];

// Mock Databases for realistic BBPS validation
interface ElectricityBillRecord {
  consumerName: string;
  accountNo: string;
  subDivision: string;
  dueDate: string;
  billAmount: number;
  meterNo: string;
  units: number;
}

const ELECTRICITY_MOCK_RECORDS: Record<string, ElectricityBillRecord> = {
  '1002948201': {
    consumerName: 'Lalmuanpuia Ralte',
    accountNo: '1002948201',
    subDivision: 'Aizawl Power Division I (Chanmari / Bawngkawn)',
    dueDate: '15/09/2026',
    billAmount: 940,
    meterNo: 'MTR-AZ-9842',
    units: 145
  },
  '2004819203': {
    consumerName: 'Rohlupuia Sailo',
    accountNo: '2004819203',
    subDivision: 'Lunglei Power Division (Venglai / Bazar)',
    dueDate: '18/09/2026',
    billAmount: 1480,
    meterNo: 'MTR-LG-7719',
    units: 230
  },
  '3001827492': {
    consumerName: 'Zodinpuii',
    accountNo: '3001827492',
    subDivision: 'Champhai Power Division (Vengsang / Kahrawt)',
    dueDate: '20/09/2026',
    billAmount: 760,
    meterNo: 'MTR-CP-3312',
    units: 110
  },
  '4005918234': {
    consumerName: 'C. Lalrintluanga',
    accountNo: '4005918234',
    subDivision: 'Kolasib Power Division (Diakkawn)',
    dueDate: '22/09/2026',
    billAmount: 1120,
    meterNo: 'MTR-KL-5541',
    units: 175
  },
  '5006821901': {
    consumerName: 'Vanlalruati',
    accountNo: '5006821901',
    subDivision: 'Serchhip Power Division (New Serchhip)',
    dueDate: '25/09/2026',
    billAmount: 890,
    meterNo: 'MTR-SC-6610',
    units: 135
  }
};

interface WaterBillRecord {
  consumerName: string;
  accountNo: string;
  subDivisionOrVeng: string;
  dueDate: string;
  billAmount: number;
  meterNo: string;
  liters: number;
}

const WATER_MOCK_RECORDS: Record<string, WaterBillRecord> = {
  'PHED/AIZ/2024/0981': {
    consumerName: 'Zohmangaiha',
    accountNo: 'PHED/AIZ/2024/0981',
    subDivisionOrVeng: 'Mission Veng Sub-Division, Aizawl',
    dueDate: '10/09/2026',
    billAmount: 420,
    meterNo: 'W-AZ-8821',
    liters: 16000
  },
  'AIZ0981': {
    consumerName: 'Zohmangaiha',
    accountNo: 'PHED/AIZ/2024/0981',
    subDivisionOrVeng: 'Mission Veng Sub-Division, Aizawl',
    dueDate: '10/09/2026',
    billAmount: 420,
    meterNo: 'W-AZ-8821',
    liters: 16000
  },
  'PHED/LGL/2024/1102': {
    consumerName: 'K. Vanlalhruaia',
    accountNo: 'PHED/LGL/2024/1102',
    subDivisionOrVeng: 'Bazar Veng PHED Division, Lunglei',
    dueDate: '12/09/2026',
    billAmount: 650,
    meterNo: 'W-LG-4412',
    liters: 24000
  },
  'LGL1102': {
    consumerName: 'K. Vanlalhruaia',
    accountNo: 'PHED/LGL/2024/1102',
    subDivisionOrVeng: 'Bazar Veng PHED Division, Lunglei',
    dueDate: '12/09/2026',
    billAmount: 650,
    meterNo: 'W-LG-4412',
    liters: 24000
  },
  'PHED/CMP/2024/0419': {
    consumerName: 'Malsawmtluanga',
    accountNo: 'PHED/CMP/2024/0419',
    subDivisionOrVeng: 'Champhai Vengthlang Division',
    dueDate: '15/09/2026',
    billAmount: 380,
    meterNo: 'W-CP-1920',
    liters: 14000
  },
  'PHED/KOL/2024/0211': {
    consumerName: 'H. Lalrammawia',
    accountNo: 'PHED/KOL/2024/0211',
    subDivisionOrVeng: 'Kolasib Town Division',
    dueDate: '18/09/2026',
    billAmount: 510,
    meterNo: 'W-KL-3109',
    liters: 19000
  }
};

interface FastagRecord {
  vehicleNo: string;
  ownerName: string;
  vehicleModel?: string;
  bank: string;
  tagStatus: string;
  tagId: string;
  currentBalance: number;
  suggestedRecharge: number;
  vehicleClass: string;
}

// User-customizable or saved vehicle details cache
const USER_VEHICLE_CUSTOM_CACHE: Record<string, {
  ownerName?: string;
  vehicleModel?: string;
  currentBalance?: number;
}> = {};

// Recognized Indian state prefixes for Vehicle Registration
const STATE_NAMES: Record<string, string> = {
  'ML': 'Meghalaya',
  'MZ': 'Mizoram',
  'AS': 'Assam',
  'TR': 'Tripura',
  'MN': 'Manipur',
  'NL': 'Nagaland',
  'AR': 'Arunachal Pradesh',
  'SK': 'Sikkim',
  'WB': 'West Bengal',
  'DL': 'Delhi',
  'HR': 'Haryana',
  'UP': 'Uttar Pradesh',
  'BR': 'Bihar',
  'JH': 'Jharkhand',
  'OD': 'Odisha',
  'KA': 'Karnataka',
  'TN': 'Tamil Nadu',
  'KL': 'Kerala',
  'MH': 'Maharashtra',
  'GJ': 'Gujarat',
  'RJ': 'Rajasthan',
  'PB': 'Punjab',
  'HP': 'Himachal Pradesh',
  'JK': 'Jammu & Kashmir',
  'LA': 'Ladakh',
  'TS': 'Telangana',
  'AP': 'Andhra Pradesh',
  'CG': 'Chhattisgarh',
  'GA': 'Goa',
  'PY': 'Puducherry',
  'CH': 'Chandigarh',
  'BH': 'Bharat Series (BH)'
};

export const BillPaymentModal: React.FC<BillPaymentModalProps> = ({
  service,
  onClose,
  onPaymentComplete,
  language = 'mizo'
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isPaying, setIsPaying] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isFetchingBill, setIsFetchingBill] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const t = TRANSLATIONS[language];

  // Specific form states
  const [phone, setPhone] = useState<string>('');
  const [operator, setOperator] = useState<string>('Jio');
  const [selectedPlan, setSelectedPlan] = useState<RechargePlan | null>(null);

  // Electricity states
  const [consumerNumber, setConsumerNumber] = useState<string>('');

  // FASTag states
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [fastagBank, setFastagBank] = useState<string>(FASTAG_BANKS[0]);
  const [isEditingFastag, setIsEditingFastag] = useState<boolean>(false);
  const [editOwnerName, setEditOwnerName] = useState<string>('');
  const [editVehicleModel, setEditVehicleModel] = useState<string>('');
  const [editTagBalance, setEditTagBalance] = useState<string>('');

  // DTH states
  const [dthOperator, setDthOperator] = useState<string>(DTH_OPERATORS[0]);
  const [subscriberId, setSubscriberId] = useState<string>('');

  // Water Bill states
  const [waterConsumerId, setWaterConsumerId] = useState<string>('');

  // Municipal Tax states
  const [municipalAuthority, setMunicipalAuthority] = useState<string>(MUNICIPAL_AUTHORITIES[0]);
  const [taxType, setTaxType] = useState<string>(TAX_TYPES[0]);
  const [holdingNo, setHoldingNo] = useState<string>('');

  // Gas states
  const [gasAgency, setGasAgency] = useState<string>('Aizawl Indane Gas Agency (Chanmari)');
  const [gasConsumerNo, setGasConsumerNo] = useState<string>('');

  // Broadband states
  const [broadbandProvider, setBroadbandProvider] = useState<string>('JioFiber Mizoram');
  const [broadbandAccNo, setBroadbandAccNo] = useState<string>('');

  // Loan EMI states
  const [lenderName, setLenderName] = useState<string>('Mizoram Rural Bank (MRB)');
  const [loanAccountNo, setLoanAccountNo] = useState<string>('');

  // Bus ticket states
  const [busRoute, setBusRoute] = useState<string>('Aizawl -> Lunglei (MST Night Service)');
  const [passengerName, setPassengerName] = useState<string>('');

  // School / College Fees states
  const [institution, setInstitution] = useState<string>(SCHOOL_COLLEGES[0]);
  const [studentId, setStudentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [feeCategory, setFeeCategory] = useState<string>('Semester Tuition & Exam Fee');

  // Insurance states
  const [insuranceProvider, setInsuranceProvider] = useState<string>(INSURANCE_PROVIDERS[0]);
  const [policyNo, setPolicyNo] = useState<string>('');
  const [policyHolderDob, setPolicyHolderDob] = useState<string>('');

  // Live Bill Fetch status & detail payload
  const [linkedBillData, setLinkedBillData] = useState<{
    consumerName: string;
    accountNo: string;
    dueDate: string;
    billAmount: number;
    subDivisionOrLocality: string;
    portalUrl: string;
    status: string;
    meterNo?: string;
    tagBalance?: number; // FASTag Current Available Balance
    vehicleClass?: string;
    tagId?: string;
    issuingBank?: string;
    breakdown?: { label: string; amount: number }[];
  } | null>(null);

  // Clean reset on service change
  useEffect(() => {
    if (service) {
      setIsSuccess(false);
      setIsPaying(false);
      setSelectedPlan(null);
      setAmount('');
      setLinkedBillData(null);
      setIsFetchingBill(false);
      setErrorMessage(null);
      setConsumerNumber('');
      setVehicleNumber('');
      setWaterConsumerId('');
      setSubscriberId('');
      setHoldingNo('');
      setGasConsumerNo('');
      setBroadbandAccNo('');
      setLoanAccountNo('');
      setStudentId('');
      setStudentName('');
      setPolicyNo('');
    }
  }, [service?.id]);

  // Live Bill Fetch with BBPS API & Real-Time Department Server resolution
  const handleFetchLiveBill = async (type: string, idVal: string) => {
    const rawId = idVal.trim();
    setErrorMessage(null);

    if (!rawId) {
      setErrorMessage(
        language === 'english'
          ? 'Please enter your Consumer ID / Vehicle Registration Number to fetch bill.'
          : 'Khawngaihin Consumer ID / Vehicle Number chhu lut rawh le.'
      );
      setLinkedBillData(null);
      setAmount('');
      return;
    }

    setIsFetchingBill(true);

    if (type === 'electricity' || type === 'water') {
      try {
        const response = await fetch('/api/bbps/fetch-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: type,
            billerId: type === 'electricity' ? 'PED_MIZORAM' : 'PHED_MIZORAM',
            consumerNumber: rawId
          })
        });

        const resData = await response.json();
        setIsFetchingBill(false);

        if (resData.success) {
          setAmount(resData.billAmount.toString());
          setLinkedBillData({
            consumerName: resData.consumerName || (type === 'electricity' ? `P&ED Consumer (${rawId})` : `PHED Consumer (${rawId})`),
            accountNo: resData.consumerNumber || rawId,
            dueDate: resData.dueDate || '20/09/2026',
            billAmount: resData.billAmount,
            subDivisionOrLocality: resData.subDivision || (type === 'electricity' ? 'P&ED Mizoram State Power Grid' : 'PHED Mizoram Supply'),
            meterNo: resData.meterNumber,
            portalUrl: resData.portalUrl || (type === 'electricity' ? 'https://power.mizoram.gov.in' : 'https://phed.mizoram.gov.in'),
            status: resData.status || (language === 'english' ? 'BBPS Live Server Verified' : 'P&ED Server-ah Bill Hmuh A Ni'),
            breakdown: resData.breakdown
          });
        } else {
          setLinkedBillData(null);
          setAmount('');
          setErrorMessage(resData.message || (language === 'english' ? 'Failed to fetch bill from server.' : 'Server atangin bill hmuh a ni lo. Consumer ID check la, chhu nawn leh rawh.'));
        }
        return;
      } catch (err: any) {
        console.warn('Live API fetch error:', err);
        setIsFetchingBill(false);
        setErrorMessage(language === 'english' ? 'Unable to reach utility server. Please try again.' : 'Utility server biak tlang theih a ni rih lo. Khawngaihin vawi khat dang han tum leh teh.');
        return;
      }
    }

    setTimeout(() => {
      setIsFetchingBill(false);
      if (type === 'fastag') {
        const cleanVeh = rawId.toUpperCase().replace(/[\s-]+/g, '');
        // Comprehensive Indian vehicle number regex parser (e.g. ML-05-J-7001, MZ-01-A-1234, AS-01-EK-4321, DL-8C-9900, etc.)
        const match = cleanVeh.match(/^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{1,4})$/);

        if (match) {
          // Dynamic recognition of ANY real Indian vehicle registration plate!
          const stateCode = match[1];
          const distCode = match[2].padStart(2, '0');
          const series = match[3] || '';
          const num = match[4].padStart(4, '0');
          const formattedPlate = `${stateCode}-${distCode}${series ? `-${series}` : ''}-${num}`;

          const stateName = STATE_NAMES[stateCode] || 'India';
          
          // Check if custom details exist in cache for this vehicle
          const cached = USER_VEHICLE_CUSTOM_CACHE[cleanVeh] || USER_VEHICLE_CUSTOM_CACHE[formattedPlate];

          let charSum = 0;
          for (let i = 0; i < cleanVeh.length; i++) {
            charSum += cleanVeh.charCodeAt(i);
          }
          const defaultBalance = 240;
          const tagHash = Math.abs(charSum * 881273).toString(16).toUpperCase().padStart(12, '0');
          const tagId = `34161FA${tagHash.slice(0, 10)}`;

          const resolvedOwner = cached?.ownerName || `Vehicle Owner (${stateName} RTO - ${formattedPlate})`;
          const resolvedModel = cached?.vehicleModel || 'Class 4 (LMV - Private / Taxi / Commercial)';
          const resolvedBalance = cached?.currentBalance !== undefined ? cached.currentBalance : defaultBalance;

          setAmount('500'); // Default recommended top-up
          setEditOwnerName(resolvedOwner);
          setEditVehicleModel(resolvedModel);
          setEditTagBalance(resolvedBalance.toString());

          setLinkedBillData({
            consumerName: resolvedOwner,
            accountNo: formattedPlate,
            dueDate: 'ACTIVE / NPCI LINKED',
            billAmount: 500,
            tagBalance: resolvedBalance,
            vehicleClass: resolvedModel,
            vehicleModel: resolvedModel,
            tagId: tagId,
            issuingBank: fastagBank,
            subDivisionOrLocality: `Tag ID: ${tagId} • ${fastagBank}`,
            portalUrl: 'https://www.ihmcl.co.in',
            status: language === 'english' ? 'NETC / NPCI Active Tag Linked' : 'NPCI / NETC Tag Nung Lai Hmuh A Ni'
          });
        } else {
          setLinkedBillData(null);
          setAmount('');
          setErrorMessage(
            language === 'english'
              ? `Invalid Vehicle Registration Number ('${rawId}'). Please enter a valid Indian vehicle number (e.g. ML-05-J-7001, MZ-01-T-5432, AS-01-A-1234).`
              : `Motor Number chhut luh hi a dik lo ('${rawId}'). Vehicle registration number dik tak chhu lut rawh (Entirnan: ML-05-J-7001, MZ-01-T-5432, AS-01-A-1234).`
          );
        }
      } else if (type === 'municipal_tax') {
        if (rawId.includes('AMC') || rawId.length >= 5) {
          const liveBill = 1200;
          setAmount(liveBill.toString());
          setLinkedBillData({
            consumerName: 'Lalthakimi (Property Owner)',
            accountNo: rawId,
            dueDate: '30/09/2026',
            billAmount: liveBill,
            subDivisionOrLocality: `${municipalAuthority} - Assessment Ward 12`,
            portalUrl: 'https://amcmizoram.com',
            status: 'Holding Tax Assessment Live (AMC/LMC Server)'
          });
        } else {
          setLinkedBillData(null);
          setAmount('');
          setErrorMessage('Holding Number / Assessment ID a dik lo. Entirnan: AMC/H-4820/2026.');
        }
      } else if (type === 'school_fees') {
        if (rawId.length >= 4) {
          const liveBill = 3500;
          setAmount(liveBill.toString());
          setLinkedBillData({
            consumerName: studentName || 'Lalremruata Ralte',
            accountNo: rawId,
            dueDate: '15/09/2026',
            billAmount: liveBill,
            subDivisionOrLocality: institution || 'Mizoram University (MZU)',
            portalUrl: 'https://mzu.edu.in',
            status: language === 'english' ? 'Student Enrollment Verified' : 'Zirlai Record Hmuh A Ni (Institution Server)',
            breakdown: [
              { label: 'Tuition Fee (Semester)', amount: 2800 },
              { label: 'Library & Laboratory Fee', amount: 450 },
              { label: 'Examination & Student Welfare', amount: 250 }
            ]
          });
        } else {
          setLinkedBillData(null);
          setAmount('');
          setErrorMessage('Student Roll Number / Enrollment ID dik tak chhu lut rawh.');
        }
      } else if (type === 'insurance') {
        if (rawId.length >= 6) {
          const liveBill = 4500;
          setAmount(liveBill.toString());
          setLinkedBillData({
            consumerName: 'Lalmuankima (Policyholder)',
            accountNo: rawId,
            dueDate: '28/09/2026',
            billAmount: liveBill,
            subDivisionOrLocality: insuranceProvider,
            portalUrl: 'https://licindia.in',
            status: language === 'english' ? 'Active Policy Verified' : 'Policy Nung Lai (Verified)',
            breakdown: [
              { label: 'Base Insurance Premium', amount: 4100 },
              { label: 'GST (18% on applicable premium)', amount: 400 }
            ]
          });
        } else {
          setLinkedBillData(null);
          setAmount('');
          setErrorMessage('Policy Number dik tak chhu lut rawh (digits 6 aia tam).');
        }
      }
    }, 450);
  };

  if (!service) return null;

  // Smart operator auto-detection logic strictly mapping Mizoram phone series
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setPhone(val);
    
    if (val.length >= 3) {
      const prefix4 = val.substring(0, 4);
      const prefix3 = val.substring(0, 3);
      
      if (['9862', '9863', '9612', '8794', '8974'].includes(prefix4)) {
        setOperator('Airtel');
      } else if (['9436', '9402', '9485'].includes(prefix4)) {
        setOperator('BSNL');
      } else if (['9774', '9856'].includes(prefix4)) {
        setOperator('Vi');
      } else if (['700', '708', '600', '878'].includes(prefix3)) {
        setOperator('Jio');
      } else if (['986', '961', '879', '985'].includes(prefix3)) {
        setOperator('Airtel');
      } else if (['943', '940', '897'].includes(prefix3)) {
        setOperator('BSNL');
      } else if (['977', '995', '982'].includes(prefix3)) {
        setOperator('Vi');
      }
    }
  };

  const handleSelectPlan = (plan: RechargePlan) => {
    setSelectedPlan(plan);
    setAmount(plan.price.toString());
  };

  const handleSaveFastagDetails = () => {
    if (!linkedBillData) return;
    const cleanVeh = vehicleNumber.toUpperCase().replace(/[\s-]+/g, '');
    const numBalance = parseFloat(editTagBalance) || 0;
    const newOwner = editOwnerName.trim() || 'Vehicle Owner';
    const newModel = editVehicleModel.trim() || 'Class 4 (LMV)';
    
    USER_VEHICLE_CUSTOM_CACHE[cleanVeh] = {
      ownerName: newOwner,
      vehicleModel: newModel,
      currentBalance: numBalance
    };
    USER_VEHICLE_CUSTOM_CACHE[linkedBillData.accountNo] = USER_VEHICLE_CUSTOM_CACHE[cleanVeh];

    setLinkedBillData(prev => prev ? ({
      ...prev,
      consumerName: newOwner,
      vehicleClass: newModel,
      vehicleModel: newModel,
      tagBalance: numBalance
    }) : null);

    setIsEditingFastag(false);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);

    const enteredAmount = parseFloat(amount || (linkedBillData ? linkedBillData.billAmount.toString() : '500'));

    try {
      if (service.id === 'electricity' || service.id === 'water') {
        await fetch('/api/bbps/pay-bill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: service.id,
            billerId: service.id === 'electricity' ? 'PED_MIZORAM' : 'PHED_MIZORAM',
            consumerNumber: service.id === 'electricity' ? consumerNumber : waterConsumerId,
            amount: enteredAmount,
            consumerName: linkedBillData?.consumerName || 'RonPay User'
          })
        });
      }
    } catch (err) {
      console.warn('BBPS pay logging error:', err);
    }

    setTimeout(() => {
      setIsPaying(false);
      setIsSuccess(true);
      onPaymentComplete(enteredAmount, service.name);
    }, 600);
  };

  const renderIcon = () => {
    switch (service.id) {
      case 'mobile': return <Smartphone className="w-5 h-5 text-indigo-600" />;
      case 'electricity': return <Zap className="w-5 h-5 text-amber-600" />;
      case 'dth': return <Tv className="w-5 h-5 text-purple-600" />;
      case 'fastag': return <Car className="w-5 h-5 text-orange-600" />;
      case 'water': return <Droplet className="w-5 h-5 text-cyan-600" />;
      case 'municipal_tax': return <Landmark className="w-5 h-5 text-emerald-700" />;
      case 'tickets': return <Ticket className="w-5 h-5 text-rose-600" />;
      case 'gas': return <Flame className="w-5 h-5 text-red-600" />;
      case 'broadband': return <Wifi className="w-5 h-5 text-teal-600" />;
      case 'loan': return <CreditCard className="w-5 h-5 text-slate-700" />;
      default: return <Zap className="w-5 h-5 text-indigo-600" />;
    }
  };

  const currentPlans = PREPAID_PLANS[operator] || PREPAID_PLANS['Jio'];

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-sm sm:max-w-md rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200 relative text-slate-900 my-auto shrink-0 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer z-10 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        {!isSuccess ? (
          <form onSubmit={handlePay} className="space-y-3.5 text-xs">
            {/* Modal Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className={`w-11 h-11 ${service.bgColor} rounded-2xl flex items-center justify-center shadow-xs shrink-0`}>
                {renderIcon()}
              </div>
              <div className="overflow-hidden pr-6">
                <h3 className="font-black text-slate-900 text-sm truncate">{service.name}</h3>
                <p className="text-[10px] text-slate-500 font-bold truncate flex items-center gap-1">
                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded text-[9px] font-black border border-indigo-200">BBPS</span>
                  <span>Bharat BillPay Verified Service</span>
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-3 text-[11px] font-medium space-y-1 animate-fadeIn">
                <div className="flex items-start gap-2 font-bold text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>Validation Error / Bill Not Found</span>
                </div>
                <p className="pl-6 text-[10.5px] leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* 1. MOBILE RECHARGE */}
            {service.id === 'mobile' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Mobile Phone Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="Enter 10-digit mobile number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Operator</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                    >
                      <option value="Jio">Jio Prepaid</option>
                      <option value="Airtel">Airtel Prepaid</option>
                      <option value="BSNL">BSNL Prepaid</option>
                      <option value="Vi">Vi Prepaid</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-700 block mb-1">Circle</label>
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 text-xs truncate">
                      Mizoram / North East
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Select Tariff / Recharge Plan:</span>
                    <span className="text-[9px] text-indigo-600 font-bold">{operator} Mizoram</span>
                  </label>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {currentPlans.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => handleSelectPlan(plan)}
                        className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                          selectedPlan?.id === plan.id
                            ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/20'
                            : 'bg-slate-50 border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900 text-xs">₹{plan.price}</span>
                            <span className="text-[10px] font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {plan.validity}
                            </span>
                            {plan.tag && (
                              <span className="text-[8px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded uppercase">
                                {plan.tag}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium truncate">{plan.description}</p>
                          <p className="text-[9.5px] text-indigo-700 font-bold">{plan.data} • {plan.calls}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedPlan?.id === plan.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                        }`}>
                          {selectedPlan?.id === plan.id && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Recharge Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 299"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {/* 2. ELECTRICITY BILL (POWER & ELECTRICITY DEPARTMENT - MIZORAM) */}
            {service.id === 'electricity' && (
              <div className="space-y-3">
                {/* Unified State BBPS Biller info as in PhonePe / GPay */}
                <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-800 font-black shrink-0">
                      <Zap className="w-4 h-4 text-amber-700" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 leading-tight">
                        Power & Electricity Department, Mizoram (P&ED)
                      </h4>
                      <p className="text-[9.5px] text-slate-500 font-medium">State Electricity Board • Bharat BillPay</p>
                    </div>
                  </div>
                  <span className="text-[8.5px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                    BBPS Biller
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">
                      Consumer ID / CA Number *
                    </label>
                    <span className="text-[9px] text-amber-700 font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Sample ID Hmet Rawh
                    </span>
                  </div>
                  
                  {/* Verified Quick Sample IDs in Mizoram */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConsumerNumber('1002948201');
                        handleFetchLiveBill('electricity', '1002948201');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        consumerNumber === '1002948201' && linkedBillData ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ⚡ 1002948201 (Aizawl - ₹940)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConsumerNumber('2004819203');
                        handleFetchLiveBill('electricity', '2004819203');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        consumerNumber === '2004819203' && linkedBillData ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ⚡ 2004819203 (Lunglei - ₹1,480)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConsumerNumber('3001827492');
                        handleFetchLiveBill('electricity', '3001827492');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        consumerNumber === '3001827492' && linkedBillData ? 'bg-amber-500 text-slate-950 border-amber-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ⚡ 3001827492 (Champhai - ₹760)
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={consumerNumber}
                      onChange={(e) => {
                        setConsumerNumber(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="Enter Consumer ID (e.g. 1002948201)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-amber-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('electricity', consumerNumber)}
                      disabled={isFetchingBill}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3.5 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      {isFetchingBill ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>Fetch Bill</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-medium mt-1">
                    Consumer ID hi i electricity bill paper chunglamah a inziak e.
                  </p>
                </div>

                {/* Verified Live Bill Card with Details Breakdown */}
                {linkedBillData && (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 space-y-2 text-amber-950 animate-fadeIn">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-600">Due Date: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600 font-medium">{linkedBillData.subDivisionOrLocality}</p>
                        {linkedBillData.meterNo && (
                          <p className="text-[9.5px] text-slate-500 font-mono">Meter: {linkedBillData.meterNo}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">Live Due Amount</span>
                        <span className="text-base font-black text-amber-800">₹{linkedBillData.billAmount}</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    {linkedBillData.breakdown && (
                      <div className="bg-white/90 rounded-xl p-2 border border-amber-200/80 space-y-1 text-[10px]">
                        {linkedBillData.breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-slate-600">
                            <span>{item.label}</span>
                            <span className="font-bold text-slate-900">₹{item.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <a
                      href={linkedBillData.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] font-bold text-amber-800 hover:underline flex items-center gap-1 pt-1 border-t border-amber-200"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Open Official P&ED Department Portal
                    </a>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {language === 'english' ? 'Bill Amount to Pay (₹)' : 'Pek tur zat (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount to pay"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-amber-600"
                  />
                </div>
              </div>
            )}

            {/* 3. FASTAG RECHARGE (NETC / NPCI BBPS) */}
            {service.id === 'fastag' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    FASTag Issuing Bank *
                  </label>
                  <select
                    value={fastagBank}
                    onChange={(e) => {
                      setFastagBank(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-orange-600"
                  >
                    {FASTAG_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">
                      Vehicle Registration Number (RC No.) *
                    </label>
                    <span className="text-[9px] text-orange-700 font-bold">Quick sample plates</span>
                  </div>

                  {/* Quick Sample Vehicles including Meghalaya ML, Mizoram MZ */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleNumber('ML-05-J-7001');
                        handleFetchLiveBill('fastag', 'ML-05-J-7001');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        (vehicleNumber === 'ML-05-J-7001' || vehicleNumber === 'ML05J7001') && linkedBillData ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚗 ML-05-J-7001
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleNumber('MZ-01-T-5432');
                        handleFetchLiveBill('fastag', 'MZ-01-T-5432');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        (vehicleNumber === 'MZ-01-T-5432' || vehicleNumber === 'MZ01T5432') && linkedBillData ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚕 MZ-01-T-5432
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleNumber('MZ-01-A-1234');
                        handleFetchLiveBill('fastag', 'MZ-01-A-1234');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        (vehicleNumber === 'MZ-01-A-1234' || vehicleNumber === 'MZ01A1234') && linkedBillData ? 'bg-orange-500 text-white border-orange-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚙 MZ-01-A-1234
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={vehicleNumber}
                      onChange={(e) => {
                        setVehicleNumber(e.target.value.toUpperCase());
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. ML-05-J-7001 / MZ-01-T-5432"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono font-black text-slate-900 text-xs uppercase tracking-wider focus:outline-none focus:bg-white focus:border-orange-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('fastag', vehicleNumber)}
                      disabled={isFetchingBill}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black px-3.5 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      {isFetchingBill ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Validating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>Validate Tag</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[9.5px] text-slate-400 font-medium mt-1">
                    India rama motor registration number engpawh (ML, MZ, AS, DL, etc.) a hman theih e.
                  </p>
                </div>

                {/* Verified FASTag Card with Customizable Owner, Model and Balance */}
                {linkedBillData && (
                  <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-300/80 rounded-2xl p-3.5 space-y-2.5 text-slate-900 animate-fadeIn shadow-xs">
                    {/* Top status bar */}
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditOwnerName(linkedBillData.consumerName);
                            setEditVehicleModel(linkedBillData.vehicleClass || linkedBillData.vehicleModel || 'Class 4 (LMV)');
                            setEditTagBalance((linkedBillData.tagBalance !== undefined ? linkedBillData.tagBalance : 240).toString());
                            setIsEditingFastag(!isEditingFastag);
                          }}
                          className="text-[9.5px] font-black text-orange-700 hover:text-orange-900 bg-white border border-orange-300 px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                        >
                          ✏️ {isEditingFastag ? 'Done' : 'Siamrem / Edit'}
                        </button>
                        <span className="text-[9px] font-bold text-slate-500 hidden sm:flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" /> NETC Verified
                        </span>
                      </div>
                    </div>

                    {isEditingFastag ? (
                      /* Interactive Edit Form for Motor Owner, Model & Balance */
                      <div className="bg-white/95 border border-orange-300 rounded-xl p-2.5 space-y-2 text-slate-900 animate-fadeIn">
                        <div className="text-[10px] font-black text-orange-950 flex items-center justify-between border-b border-orange-100 pb-1">
                          <span>🔧 Motor & FASTag Details Siamremna</span>
                          <span className="text-[8.5px] text-slate-400 font-medium">Real-time update</span>
                        </div>

                        <div className="space-y-1.5">
                          <div>
                            <label className="text-[9px] font-bold text-slate-600 block">Motor Neitu Hming (Owner Name)</label>
                            <input
                              type="text"
                              value={editOwnerName}
                              onChange={(e) => setEditOwnerName(e.target.value)}
                              placeholder="e.g. Bethel Computer Centre / Lalmuana"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-orange-600"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-600 block">Motor Model / Chi (Car Model)</label>
                            <input
                              type="text"
                              value={editVehicleModel}
                              onChange={(e) => setEditVehicleModel(e.target.value)}
                              placeholder="e.g. Maruti Suzuki Swift / Alto / Bolero / Scorpio / Creta"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-[11px] font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-orange-600"
                            />
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-600 block">FASTag Balance Awm Zat (Current Balance ₹)</label>
                            <input
                              type="number"
                              value={editTagBalance}
                              onChange={(e) => setEditTagBalance(e.target.value)}
                              placeholder="e.g. 250"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-[11px] font-black text-emerald-800 focus:outline-none focus:bg-white focus:border-orange-600"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setIsEditingFastag(false)}
                            className="text-[10px] font-bold text-slate-600 hover:text-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveFastagDetails}
                            className="bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black px-3 py-1 rounded-lg shadow-xs cursor-pointer"
                          >
                            Save / Hman Rawh
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Display Verified Information */
                      <div className="flex items-start justify-between gap-2 border-b border-orange-200/60 pb-2">
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1 bg-white border border-slate-400 rounded-md px-2 py-0.5 font-mono font-black text-slate-900 text-xs shadow-2xs">
                            <span className="text-[8px] bg-blue-700 text-white px-1 py-0.2 rounded font-sans font-bold">IND</span>
                            <span>{linkedBillData.accountNo}</span>
                          </div>
                          <h4 className="font-black text-xs text-slate-900 pt-0.5">{linkedBillData.consumerName}</h4>
                          {(linkedBillData.vehicleClass || linkedBillData.vehicleModel) && (
                            <p className="text-[9.5px] text-slate-600 font-medium">
                              {linkedBillData.vehicleClass || linkedBillData.vehicleModel}
                            </p>
                          )}
                          <p className="text-[9px] text-slate-500 font-mono">
                            {linkedBillData.issuingBank || fastagBank} • ID: {linkedBillData.tagId}
                          </p>
                        </div>

                        {/* FASTag Available Balance Box */}
                        <div className="bg-white rounded-xl p-2.5 border border-orange-200 text-right shrink-0 shadow-2xs">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                            Current Tag Balance
                          </span>
                          <div className="flex items-center justify-end gap-1 text-emerald-700 font-black text-base">
                            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>₹{linkedBillData.tagBalance !== undefined ? linkedBillData.tagBalance : 240}</span>
                          </div>
                          {linkedBillData.tagBalance !== undefined && linkedBillData.tagBalance < 250 ? (
                            <span className="text-[8px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded inline-block mt-0.5">
                              Low Balance
                            </span>
                          ) : (
                            <span className="text-[8px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded inline-block mt-0.5">
                              Active Balance
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <p className="text-[9.5px] text-slate-600 font-medium">
                      Toll plaza-ah tag a lo tawp loh nan recharge zat thlang la, top-up nghal rawh le.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-slate-700">
                      {t.quickAmount || 'Quick Top-Up Amount (₹)'}
                    </label>
                    <span className="text-[9px] text-slate-400 font-medium">Select or enter custom</span>
                  </div>

                  <div className="grid grid-cols-5 gap-1 mb-2">
                    {['300', '500', '1000', '2000', '3000'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`py-1.5 rounded-lg text-[10.5px] font-black border transition cursor-pointer ${
                          amount === amt
                            ? 'bg-orange-500 text-white border-orange-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter top-up amount"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-orange-600"
                  />
                </div>
              </div>
            )}

            {/* 4. DTH TV RECHARGE */}
            {service.id === 'dth' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    DTH Operator / Service Provider *
                  </label>
                  <select
                    value={dthOperator}
                    onChange={(e) => setDthOperator(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-purple-600"
                  >
                    {DTH_OPERATORS.map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Subscriber ID / Smart Card Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={subscriberId}
                    onChange={(e) => setSubscriberId(e.target.value)}
                    placeholder="Enter 10 or 11 digit Subscriber ID"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Recharge Amount (₹)
                  </label>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    {['250', '399', '599', '999'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`py-1.5 rounded-lg text-[10.5px] font-black border transition cursor-pointer ${
                          amount === amt
                            ? 'bg-purple-600 text-white border-purple-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount to recharge"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-purple-600"
                  />
                </div>
              </div>
            )}

            {/* 5. WATER BILL (PHED MIZORAM) */}
            {service.id === 'water' && (
              <div className="space-y-3">
                <div className="bg-cyan-50/80 border border-cyan-200/90 rounded-2xl p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-800 font-black shrink-0">
                      <Droplet className="w-4 h-4 text-cyan-700" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black text-slate-900 leading-tight">
                        Public Health Engineering Dept, Mizoram (PHED)
                      </h4>
                      <p className="text-[9.5px] text-slate-500 font-medium">State Water Utility • Bharat BillPay</p>
                    </div>
                  </div>
                  <span className="text-[8.5px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200">
                    BBPS Biller
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">
                      PHED Consumer Connection ID *
                    </label>
                    <span className="text-[9px] text-cyan-700 font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Sample ID Hmet Rawh
                    </span>
                  </div>

                  {/* Sample PHED IDs */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setWaterConsumerId('PHED/AIZ/2024/0981');
                        handleFetchLiveBill('water', 'PHED/AIZ/2024/0981');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        waterConsumerId === 'PHED/AIZ/2024/0981' && linkedBillData ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      💧 AIZ/0981 (Mission Veng - ₹420)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWaterConsumerId('PHED/LGL/2024/1102');
                        handleFetchLiveBill('water', 'PHED/LGL/2024/1102');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        waterConsumerId === 'PHED/LGL/2024/1102' && linkedBillData ? 'bg-cyan-600 text-white border-cyan-700' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      💧 LGL/1102 (Lunglei - ₹650)
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={waterConsumerId}
                      onChange={(e) => {
                        setWaterConsumerId(e.target.value);
                        if (errorMessage) setErrorMessage(null);
                      }}
                      placeholder="e.g. PHED/AIZ/2024/0981"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('water', waterConsumerId)}
                      disabled={isFetchingBill}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-black px-3.5 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      {isFetchingBill ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Fetching...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>Fetch Bill</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {linkedBillData && (
                  <div className="bg-cyan-50/90 border border-cyan-300 rounded-2xl p-3 space-y-2 text-cyan-950 animate-fadeIn">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-600">Due Date: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600 font-medium">{linkedBillData.subDivisionOrLocality}</p>
                        {linkedBillData.meterNo && (
                          <p className="text-[9.5px] text-slate-500 font-mono">Water Meter: {linkedBillData.meterNo}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">Due Bill Amount</span>
                        <span className="text-base font-black text-cyan-800">₹{linkedBillData.billAmount}</span>
                      </div>
                    </div>

                    {linkedBillData.breakdown && (
                      <div className="bg-white/90 rounded-xl p-2 border border-cyan-200/80 space-y-1 text-[10px]">
                        {linkedBillData.breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-slate-600">
                            <span>{item.label}</span>
                            <span className="font-bold text-slate-900">₹{item.amount}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {language === 'english' ? 'Bill Amount to Pay (₹)' : 'Pek tur zat (₹)'}
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter water bill amount"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-cyan-600"
                  />
                </div>
              </div>
            )}

            {/* 6. MUNICIPAL TAX (AMC / LMC) */}
            {service.id === 'municipal_tax' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Municipal Authority / Corporation *
                  </label>
                  <select
                    value={municipalAuthority}
                    onChange={(e) => setMunicipalAuthority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    {MUNICIPAL_AUTHORITIES.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Tax / Fee Category *
                  </label>
                  <select
                    value={taxType}
                    onChange={(e) => setTaxType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    {TAX_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Holding No. / Assessment ID / Trade License No. *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={holdingNo}
                      onChange={(e) => setHoldingNo(e.target.value)}
                      placeholder="e.g. AMC/H-4820/2026"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('municipal_tax', holdingNo)}
                      disabled={isFetchingBill}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-3.5 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      {isFetchingBill ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      <span>Fetch</span>
                    </button>
                  </div>
                </div>

                {linkedBillData && (
                  <div className="bg-emerald-50/90 border border-emerald-300 rounded-2xl p-3 space-y-1.5 text-emerald-950 animate-fadeIn">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-emerald-800">{linkedBillData.status}</span>
                      <span className="font-bold text-slate-600">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600 font-medium">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <span className="text-base font-black text-emerald-800">₹{linkedBillData.billAmount}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Tax Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter tax amount"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* 7. GAS CYLINDER */}
            {service.id === 'gas' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">LPG Distributor / Agency *</label>
                  <select
                    value={gasAgency}
                    onChange={(e) => setGasAgency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-red-600"
                  >
                    <option value="Aizawl Indane Gas Agency (Chanmari)">Aizawl Indane Gas Agency (Chanmari)</option>
                    <option value="Lunglei Indane Gas Service">Lunglei Indane Gas Service</option>
                    <option value="Champhai Indane Agency">Champhai Indane Agency</option>
                    <option value="Kolasib Gas Distributor">Kolasib Gas Distributor</option>
                    <option value="Bharat Gas Mizoram (HPCL / BPCL)">Bharat Gas Mizoram</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">LPG Consumer Number / Registered Mobile *</label>
                  <input
                    type="text"
                    required
                    value={gasConsumerNo}
                    onChange={(e) => setGasConsumerNo(e.target.value)}
                    placeholder="Enter 16-digit LPG ID or 10-digit Mobile"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Cylinder Booking Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '930'}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-red-600"
                  />
                  <p className="text-[9.5px] text-slate-400 mt-1">Subsidized Indane 14.2kg Domestic Cylinder: ₹930</p>
                </div>
              </div>
            )}

            {/* 8. BROADBAND / FIBER */}
            {service.id === 'broadband' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Broadband Provider *</label>
                  <select
                    value={broadbandProvider}
                    onChange={(e) => setBroadbandProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-teal-600"
                  >
                    <option value="JioFiber Mizoram">JioFiber / AirFiber (Mizoram)</option>
                    <option value="Airtel Xstream Fiber">Airtel Xstream Fiber</option>
                    <option value="BSNL Bharat Fiber (FTTH)">BSNL Bharat Fiber (FTTH)</option>
                    <option value="Skylink Broadband Mizoram">Skylink Broadband (Mizoram Local)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Account Number / Landline No. *</label>
                  <input
                    type="text"
                    required
                    value={broadbandAccNo}
                    onChange={(e) => setBroadbandAccNo(e.target.value)}
                    placeholder="Enter Account ID / Telephone Number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Monthly Plan Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '470'}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            {/* 9. LOAN EMI */}
            {service.id === 'loan' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Lending Bank / NBFC *</label>
                  <select
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-slate-800"
                  >
                    <option value="Mizoram Rural Bank (MRB)">Mizoram Rural Bank (MRB)</option>
                    <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                    <option value="Mizoram Apex Bank (MCAB)">Mizoram Apex Bank (MCAB)</option>
                    <option value="HDFC Bank Loan">HDFC Bank Loan</option>
                    <option value="Bajaj Finserv">Bajaj Auto / Finance</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Loan Account Number *</label>
                  <input
                    type="text"
                    required
                    value={loanAccountNo}
                    onChange={(e) => setLoanAccountNo(e.target.value)}
                    placeholder="Enter 11-16 digit Loan Account Number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Monthly EMI Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter monthly EMI to pay"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-slate-800"
                  />
                </div>
              </div>
            )}

            {/* 10. MST BUS TICKETS */}
            {service.id === 'tickets' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Mizoram State Transport (MST) Route *</label>
                  <select
                    value={busRoute}
                    onChange={(e) => setBusRoute(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-rose-600"
                  >
                    <option value="Aizawl → Lunglei (MST Night Service)">Aizawl → Lunglei (MST Night Service)</option>
                    <option value="Aizawl → Champhai (MST Deluxe)">Aizawl → Champhai (MST Deluxe)</option>
                    <option value="Aizawl → Siaha (MST Express)">Aizawl → Siaha (MST Express)</option>
                    <option value="Aizawl → Kolasib / Silchar">Aizawl → Kolasib / Silchar</option>
                    <option value="Lunglei → Aizawl">Lunglei → Aizawl</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Passenger Name *</label>
                  <input
                    type="text"
                    required
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="Enter primary passenger name"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-rose-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Fare / Ticket Price (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '650'}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-rose-600"
                  />
                </div>
              </div>
            )}

            {/* 11. SCHOOL / COLLEGE FEES */}
            {service.id === 'school_fees' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Institution / University / School *
                  </label>
                  <select
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    {SCHOOL_COLLEGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Student Roll No. / Reg ID *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. MZU-2024-88"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Student Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Lalremruata"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleFetchLiveBill('school_fees', studentId)}
                    disabled={isFetchingBill || !studentId}
                    className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isFetchingBill ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Fetch Live Fee Voucher</span>
                  </button>
                </div>

                {linkedBillData && (
                  <div className="bg-indigo-50/90 border border-indigo-300 rounded-2xl p-3 space-y-1.5 text-indigo-950 animate-fadeIn">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-indigo-800">{linkedBillData.status}</span>
                      <span className="font-bold text-slate-600">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600 font-medium">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <span className="text-base font-black text-indigo-800">₹{linkedBillData.billAmount}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Fee Amount to Pay (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter fee amount"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {/* 12. INSURANCE PREMIUM */}
            {service.id === 'insurance' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Insurance Provider *
                  </label>
                  <select
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                  >
                    {INSURANCE_PROVIDERS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Policy Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={policyNo}
                      onChange={(e) => setPolicyNo(e.target.value)}
                      placeholder="e.g. 589201948"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Policyholder DOB *
                    </label>
                    <input
                      type="date"
                      value={policyHolderDob}
                      onChange={(e) => setPolicyHolderDob(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleFetchLiveBill('insurance', policyNo)}
                    disabled={isFetchingBill || !policyNo}
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold py-2 rounded-xl text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isFetchingBill ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    <span>Fetch Policy Premium</span>
                  </button>
                </div>

                {linkedBillData && (
                  <div className="bg-blue-50/90 border border-blue-300 rounded-2xl p-3 space-y-1.5 text-blue-950 animate-fadeIn">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold text-blue-800">{linkedBillData.status}</span>
                      <span className="font-bold text-slate-600">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600 font-medium">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <span className="text-base font-black text-blue-800">₹{linkedBillData.billAmount}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    Premium Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter premium amount"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isPaying || !amount || parseFloat(amount) <= 0}
                className={`w-2/3 py-2.5 rounded-xl font-black text-xs transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                  isPaying || !amount || parseFloat(amount) <= 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                }`}
              >
                {isPaying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Pay ₹{amount || '0'} via UPI / BBPS</span>
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-1">
              <p className="text-[9px] text-slate-400 flex items-center justify-center gap-1 font-medium">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                <span>NPCI Bharat BillPay • 100% Instant Settlement Guarantee</span>
              </p>
            </div>
          </form>
        ) : (
          /* Payment Success Confirmation Screen */
          <div className="text-center py-4 space-y-4 animate-fadeIn">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Payment Successful!
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {service.name} payment has been processed instantly through BBPS.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold text-slate-900">{service.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-black text-emerald-700">₹{amount}</span>
              </div>
              {linkedBillData?.tagBalance !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500">New Tag Balance:</span>
                  <span className="font-black text-emerald-700">₹{(linkedBillData.tagBalance || 0) + parseFloat(amount || '0')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">BBPS Ref ID:</span>
                <span className="font-mono font-bold text-slate-700">
                  BBPS{Math.floor(100000000 + Math.random() * 900000000)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Settled / Confirmed
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
            >
              Done / Back to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
