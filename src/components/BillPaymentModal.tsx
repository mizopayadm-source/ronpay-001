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
  Building2,
  Landmark,
  Ticket,
  Search,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Calendar,
  User,
  Phone,
  MapPin,
  ExternalLink,
  Info,
  Receipt,
  GraduationCap,
  Shield
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
  'State Bank of India (SBI FASTag)',
  'HDFC Bank FASTag',
  'ICICI Bank FASTag',
  'Paytm / Airtel Payments Bank FASTag',
  'Axis Bank FASTag',
  'IDFC First Bank FASTag',
  'Kotak Mahindra Bank FASTag'
];

const ELECTRICITY_BOARDS = [
  'P&ED Mizoram (Power & Electricity Department)',
  'P&ED Aizawl Circle (Urban & Rural)',
  'P&ED Lunglei Circle (Urban & Rural)',
  'P&ED Champhai Circle',
  'P&ED Kolasib Circle',
  'P&ED Serchhip Circle',
  'P&ED Siaha / Lawngtlai Circle'
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

  const t = TRANSLATIONS[language];

  // Specific form states
  const [phone, setPhone] = useState<string>('');
  const [operator, setOperator] = useState<string>('Jio');
  const [circle, setCircle] = useState<string>('Mizoram / North East');
  const [selectedPlan, setSelectedPlan] = useState<RechargePlan | null>(null);

  // Electricity states
  const [electricBoard, setElectricBoard] = useState<string>(ELECTRICITY_BOARDS[0]);
  const [consumerNumber, setConsumerNumber] = useState<string>('');
  const [subDivision, setSubDivision] = useState<string>('');

  // FASTag states
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [fastagBank, setFastagBank] = useState<string>(FASTAG_BANKS[0]);

  // DTH states
  const [dthOperator, setDthOperator] = useState<string>(DTH_OPERATORS[0]);
  const [subscriberId, setSubscriberId] = useState<string>('');

  // Water Bill states
  const [waterConsumerId, setWaterConsumerId] = useState<string>('');
  const [waterVeng, setWaterVeng] = useState<string>('');

  // Municipal Tax states
  const [municipalAuthority, setMunicipalAuthority] = useState<string>(MUNICIPAL_AUTHORITIES[0]);
  const [taxType, setTaxType] = useState<string>(TAX_TYPES[0]);
  const [holdingNo, setHoldingNo] = useState<string>('');
  const [taxpayerName, setTaxpayerName] = useState<string>('');

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
    breakdown?: { label: string; amount: number }[];
  } | null>(null);

  // Reset state on service change without forcing hardcoded amounts
  useEffect(() => {
    if (service) {
      setIsSuccess(false);
      setIsPaying(false);
      setSelectedPlan(null);
      setAmount('');
      setLinkedBillData(null);
      setIsFetchingBill(false);

      // Auto link defaults for Electric, Water, FASTag on open for convenience
      if (service.id === 'electricity') {
        handleFetchLiveBill('electricity', '1002948201');
      } else if (service.id === 'water') {
        handleFetchLiveBill('water', 'PHED/AIZ/2024/0981');
      } else if (service.id === 'fastag') {
        handleFetchLiveBill('fastag', 'MZ-01-T-5432');
      }
    }
  }, [service?.id]);

  // Live Bill Fetch Simulation connecting to Department Server
  const handleFetchLiveBill = (type: string, idVal: string) => {
    if (!idVal.trim() || idVal.length < 3) {
      alert(language === 'english' ? 'Please enter a valid ID / Registration Number.' : 'Khawngaihin Consumer ID / Vehicle No a dik chhu lut rawh le.');
      return;
    }

    setIsFetchingBill(true);
    setTimeout(() => {
      setIsFetchingBill(false);
      if (type === 'electricity') {
        const liveBill = idVal.startsWith('2') ? 1480 : 940;
        setAmount(liveBill.toString());
        if (idVal.startsWith('2')) {
          setSubDivision('Lunglei Power Division');
          setElectricBoard(ELECTRICITY_BOARDS[2]);
        } else {
          setSubDivision('Aizawl Power Division I');
        }
        setLinkedBillData({
          consumerName: idVal.startsWith('2') ? 'Rohlupuia Sailo' : 'Lalmuanpuia Ralte',
          accountNo: idVal,
          dueDate: '05/09/2026',
          billAmount: liveBill,
          subDivisionOrLocality: idVal.startsWith('2') ? 'Lunglei Power Division (Bazar/Venglai)' : 'Aizawl Power Division I (Chanmari/Bawngkawn)',
          portalUrl: 'https://power.mizoram.gov.in',
          status: language === 'english' ? 'Live Bill Fetched & Linked (P&ED Mizoram Server)' : 'Bill Generated & Linked (P&ED Server)',
          breakdown: [
            { label: 'Energy Charges (Units: 145 kWh)', amount: liveBill - 140 },
            { label: 'Fixed Monthly Charges', amount: 100 },
            { label: 'Electricity Duty & Cess (5%)', amount: 40 }
          ]
        });
      } else if (type === 'water') {
        const liveBill = idVal.includes('LGL') ? 650 : 420;
        setAmount(liveBill.toString());
        if (idVal.includes('LGL')) {
          setWaterVeng('Bazar Veng, Lunglei');
        } else {
          setWaterVeng('Mission Veng, Aizawl');
        }
        setLinkedBillData({
          consumerName: idVal.includes('LGL') ? 'K. Vanlalhruaia' : 'Zohmangaiha',
          accountNo: idVal,
          dueDate: '10/09/2026',
          billAmount: liveBill,
          subDivisionOrLocality: idVal.includes('LGL') ? 'Bazar Veng, Lunglei PHED Division' : 'Mission Veng, Aizawl Division',
          portalUrl: 'https://phed.mizoram.gov.in',
          status: language === 'english' ? 'Active Water Connection Verified (PHED Mizoram)' : 'Active Connection Verified (PHED Server)',
          breakdown: [
            { label: 'Water Usage Charge (18,000 Liters)', amount: liveBill - 70 },
            { label: 'Meter Rent & Maintenance', amount: 50 },
            { label: 'Sanitation Cess', amount: 20 }
          ]
        });
      } else if (type === 'fastag') {
        const liveBill = 500;
        setAmount(liveBill.toString());
        setLinkedBillData({
          consumerName: 'Lalremruata (Tag Verified)',
          accountNo: idVal,
          dueDate: 'Valid Active Fastag Tag',
          billAmount: liveBill,
          subDivisionOrLocality: 'NETC National Electronic Toll Collection (NPCI)',
          portalUrl: 'https://www.ihmcl.co.in',
          status: language === 'english' ? 'FASTag Tag ID Active / NPCI Linked' : 'FASTag Tag ID Active / NPCI Linked'
        });
      } else if (type === 'municipal_tax') {
        const liveBill = 1200;
        setAmount(liveBill.toString());
        if (!taxpayerName) setTaxpayerName('Lalthakimi');
        setLinkedBillData({
          consumerName: 'Lalthakimi (Property Owner)',
          accountNo: idVal,
          dueDate: '30/09/2026',
          billAmount: liveBill,
          subDivisionOrLocality: 'AMC Ward 12, Aizawl',
          portalUrl: 'https://amcmizoram.com',
          status: 'Holding Tax Assessment Live (AMC Server)'
        });
      } else if (type === 'school_fees') {
        const liveBill = 3500;
        setAmount(liveBill.toString());
        setLinkedBillData({
          consumerName: studentName || 'Lalremruata Ralte',
          accountNo: idVal,
          dueDate: '15/09/2026',
          billAmount: liveBill,
          subDivisionOrLocality: institution || 'Mizoram University (MZU)',
          portalUrl: 'https://mzu.edu.in',
          status: language === 'english' ? 'Student Enrollment Verified' : 'Zirlai Record Hmuh A Ni (School/College)',
          breakdown: [
            { label: 'Tuition Fee (Semester)', amount: 2800 },
            { label: 'Library & Laboratory Fee', amount: 450 },
            { label: 'Examination & Student Welfare', amount: 250 }
          ]
        });
      } else if (type === 'insurance') {
        const liveBill = 4500;
        setAmount(liveBill.toString());
        setLinkedBillData({
          consumerName: 'Lalmuankima (Policyholder)',
          accountNo: idVal,
          dueDate: '28/09/2026',
          billAmount: liveBill,
          subDivisionOrLocality: insuranceProvider || 'LIC of India (Aizawl Branch)',
          portalUrl: 'https://licindia.in',
          status: language === 'english' ? 'Active Policy Verified' : 'Policy Nung Lai (Verified)',
          breakdown: [
            { label: 'Base Insurance Premium', amount: 4100 },
            { label: 'GST (18% on applicable premium)', amount: 400 }
          ]
        });
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

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);

    const enteredAmount = parseFloat(amount || (linkedBillData ? linkedBillData.billAmount.toString() : '500'));

    setTimeout(() => {
      setIsPaying(false);
      setIsSuccess(true);
      onPaymentComplete(enteredAmount, service.name);
    }, 850);
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
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-sm sm:max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-5 space-y-4 shadow-2xl border border-indigo-100 relative text-slate-800">
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
                <p className="text-[10px] text-slate-400 font-medium truncate">{service.category} • Instant Bharat BillPay (BBPS)</p>
              </div>
            </div>

            {/* 1. MOBILE RECHARGE */}
            {service.id === 'mobile' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Mobile Number (10 Digits) *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={phone}
                      onChange={handlePhoneChange}
                      placeholder="e.g. 9862300000 / 7005123456"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                    />
                    {phone.length >= 4 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9.5px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {operator} • {circle}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Operator</label>
                    <select
                      value={operator}
                      onChange={(e) => setOperator(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                    >
                      <option value="Jio">Jio Prepaid</option>
                      <option value="Airtel">Airtel Prepaid</option>
                      <option value="BSNL">BSNL Prepaid</option>
                      <option value="Vi">Vodafone Idea (Vi)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Circle</label>
                    <select
                      value={circle}
                      onChange={(e) => setCircle(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                    >
                      <option value="Mizoram / North East">Mizoram (NE)</option>
                      <option value="Assam">Assam</option>
                      <option value="Kolkata">Kolkata</option>
                      <option value="National">All India</option>
                    </select>
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

            {/* 2. ELECTRICITY BILL */}
            {service.id === 'electricity' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    {t.electricBoardLabel || 'Electricity Department / Circle *'}
                  </label>
                  <select
                    value={electricBoard}
                    onChange={(e) => setElectricBoard(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-amber-600"
                  >
                    {ELECTRICITY_BOARDS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">
                      {t.consumerIdLabel || 'Consumer ID / Meter Connection Number *'}
                    </label>
                    <span className="text-[9px] text-amber-700 font-bold">Quick sample</span>
                  </div>
                  
                  {/* Quick Sample IDs */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConsumerNumber('1002948201');
                        handleFetchLiveBill('electricity', '1002948201');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        consumerNumber === '1002948201' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
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
                        consumerNumber === '2004819203' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ⚡ 2004819203 (Lunglei - ₹1,480)
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={consumerNumber}
                      onChange={(e) => setConsumerNumber(e.target.value)}
                      placeholder="Enter Consumer ID (e.g. 1002948201)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-amber-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('electricity', consumerNumber || '1002948201')}
                      disabled={isFetchingBill}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isFetchingBill ? (t.linking || 'Linking...') : (t.linkFetch || 'Link & Fetch')}</span>
                    </button>
                  </div>
                </div>

                {/* Verified Live Bill Card with Details Breakdown */}
                {linkedBillData && (
                  <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3 space-y-2 text-amber-950">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-600">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">Live Due Amount</span>
                        <span className="text-sm font-black text-amber-700">₹{linkedBillData.billAmount}</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    {linkedBillData.breakdown && (
                      <div className="bg-white/80 rounded-xl p-2 border border-amber-200/80 space-y-1 text-[10px]">
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
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Sub-Division / Town
                  </label>
                  <input
                    type="text"
                    value={subDivision}
                    onChange={(e) => setSubDivision(e.target.value)}
                    placeholder="e.g. Aizawl Power Division I / Lunglei"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {language === 'english' ? 'Bill Amount to Pay (₹)' : 'Pek tur zat (₹)'}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {['500', '940', '1500', '2500'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`py-1.5 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                          amount === amt
                            ? 'bg-amber-500 text-slate-950 border-amber-600'
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
                    placeholder="e.g. 940"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-amber-600"
                  />
                </div>
              </div>
            )}

            {/* 3. FASTAG RECHARGE */}
            {service.id === 'fastag' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    {t.fastagBankLabel || 'FASTag Issuing Bank *'}
                  </label>
                  <select
                    value={fastagBank}
                    onChange={(e) => setFastagBank(e.target.value)}
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
                      {t.vehicleNumberLabel || 'Vehicle Registration Number (RC No.) *'}
                    </label>
                    <span className="text-[9px] text-orange-700 font-bold">Quick vehicle</span>
                  </div>

                  {/* Quick Sample Vehicles */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleNumber('MZ-01-T-5432');
                        handleFetchLiveBill('fastag', 'MZ-01-T-5432');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        vehicleNumber === 'MZ-01-T-5432' ? 'bg-orange-100 text-orange-900 border-orange-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚗 MZ-01-T-5432 (Taxi)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleNumber('MZ-01-A-1234');
                        handleFetchLiveBill('fastag', 'MZ-01-A-1234');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        vehicleNumber === 'MZ-01-A-1234' ? 'bg-orange-100 text-orange-900 border-orange-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚘 MZ-01-A-1234 (Sedan)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleNumber('MZ-02-B-9911');
                        handleFetchLiveBill('fastag', 'MZ-02-B-9911');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        vehicleNumber === 'MZ-02-B-9911' ? 'bg-orange-100 text-orange-900 border-orange-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      🚙 MZ-02-B-9911 (Lunglei)
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                      placeholder="e.g. MZ-01-T-5432 / MZ-02-B-1122"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs uppercase focus:outline-none focus:bg-white focus:border-orange-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('fastag', vehicleNumber || 'MZ-01-T-5432')}
                      disabled={isFetchingBill}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-black px-3 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isFetchingBill ? (t.linking || 'Linking...') : (t.linkVehicle || 'Link Vehicle')}</span>
                    </button>
                  </div>
                </div>

                {/* Verified FASTag Card */}
                {linkedBillData && (
                  <div className="bg-orange-50/90 border border-orange-200 rounded-2xl p-3 space-y-1.5 text-orange-950">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <span className="text-[9.5px] font-bold text-slate-500">NETC / NPCI Live</span>
                    </div>
                    <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                    <p className="text-[10px] text-slate-600">{linkedBillData.subDivisionOrLocality}</p>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {t.quickAmount || 'Quick Top-Up Amount (₹)'}
                  </label>
                  <div className="grid grid-cols-5 gap-1 mb-2">
                    {['300', '500', '1000', '2000', '3000'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`py-1.5 rounded-lg text-[10.5px] font-black border transition cursor-pointer ${
                          amount === amt
                            ? 'bg-orange-500 text-white border-orange-600'
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
                    placeholder="e.g. 500"
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
                    Subscriber ID / Smart Card VC Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={subscriberId}
                    onChange={(e) => setSubscriberId(e.target.value)}
                    placeholder="Enter 10-11 digit Subscriber ID / VC Number"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-purple-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Recharge Amount (₹)</label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {['250', '350', '500', '800'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`py-1.5 rounded-lg text-[11px] font-black border transition cursor-pointer ${
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
                    placeholder="e.g. 350"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-purple-600"
                  />
                </div>
              </div>
            )}

            {/* 5. WATER BILL (PHE MIZORAM) */}
            {service.id === 'water' && (
              <div className="space-y-3">
                <div className="bg-cyan-50/70 p-2.5 rounded-xl border border-cyan-200 flex items-center gap-2 text-cyan-900">
                  <Droplet className="w-4 h-4 text-cyan-600 shrink-0" />
                  <p className="text-[10.5px] font-bold">Public Health Engineering Department (PHED Mizoram)</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">
                      {t.waterConnectionLabel || 'PHE Water Connection / Consumer ID *'}
                    </label>
                    <span className="text-[9px] text-cyan-700 font-bold">Quick sample</span>
                  </div>

                  {/* Quick Sample IDs */}
                  <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setWaterConsumerId('PHED/AIZ/2024/0981');
                        handleFetchLiveBill('water', 'PHED/AIZ/2024/0981');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        waterConsumerId === 'PHED/AIZ/2024/0981' ? 'bg-cyan-100 text-cyan-900 border-cyan-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      💧 Mission Veng (₹420)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWaterConsumerId('PHED/LGL/2024/1102');
                        handleFetchLiveBill('water', 'PHED/LGL/2024/1102');
                      }}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer shrink-0 ${
                        waterConsumerId === 'PHED/LGL/2024/1102' ? 'bg-cyan-100 text-cyan-900 border-cyan-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      💧 Lunglei Bazar (₹650)
                    </button>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={waterConsumerId}
                      onChange={(e) => setWaterConsumerId(e.target.value)}
                      placeholder="e.g. PHED/AIZ/2024/0981"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-cyan-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('water', waterConsumerId || 'PHED/AIZ/2024/0981')}
                      disabled={isFetchingBill}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-black px-3 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isFetchingBill ? (t.linking || 'Linking...') : (t.linkFetch || 'Link & Fetch')}</span>
                    </button>
                  </div>
                </div>

                {/* Verified PHED Card */}
                {linkedBillData && (
                  <div className="bg-cyan-50/90 border border-cyan-300 rounded-2xl p-3 space-y-2 text-cyan-950">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-600">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">Live Due Amount</span>
                        <span className="text-sm font-black text-cyan-700">₹{linkedBillData.billAmount}</span>
                      </div>
                    </div>

                    {/* Breakdown */}
                    {linkedBillData.breakdown && (
                      <div className="bg-white/80 rounded-xl p-2 border border-cyan-200 space-y-1 text-[10px]">
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
                      className="text-[10px] font-bold text-cyan-800 hover:underline flex items-center gap-1 pt-1 border-t border-cyan-200"
                    >
                      <ExternalLink className="w-2.5 h-2.5" /> Open Official PHED Department Portal
                    </a>
                  </div>
                )}

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    {t.waterVengLabel || 'Veng / Locality / Sub-Division *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={waterVeng}
                    onChange={(e) => setWaterVeng(e.target.value)}
                    placeholder="e.g. Mission Veng, Aizawl / Bazar Veng, Lunglei"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-cyan-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {language === 'english' ? 'Water Bill Amount (₹)' : 'Tui bill pek tur zat (₹)'}
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {['300', '420', '850', '1200'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmount(amt)}
                        className={`py-1.5 rounded-lg text-[11px] font-black border transition cursor-pointer ${
                          amount === amt
                            ? 'bg-cyan-600 text-white border-cyan-700'
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
                    placeholder="e.g. 420"
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
                    Municipal Corporation / Local Body *
                  </label>
                  <select
                    value={municipalAuthority}
                    onChange={(e) => setMunicipalAuthority(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-emerald-600"
                  >
                    {MUNICIPAL_AUTHORITIES.map((auth) => (
                      <option key={auth} value={auth}>{auth}</option>
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
                    Holding Number / Assessment ID *
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
                      onClick={() => handleFetchLiveBill('municipal_tax', holdingNo || 'AMC/H-4820/2026')}
                      disabled={isFetchingBill}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-black px-3 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isFetchingBill ? 'Linking...' : 'Link & Fetch'}</span>
                    </button>
                  </div>
                </div>

                {linkedBillData && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3 space-y-1.5 text-emerald-950">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-500">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                    <p className="text-[10px] text-slate-600">{linkedBillData.subDivisionOrLocality}</p>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Assessment Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1200"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* 7. GAS CYLINDER REFILL */}
            {service.id === 'gas' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    LPG Distributor / Agency *
                  </label>
                  <select
                    value={gasAgency}
                    onChange={(e) => setGasAgency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-red-600"
                  >
                    <option value="Aizawl Indane Gas Agency (Chanmari)">Aizawl Indane Gas Agency (Chanmari)</option>
                    <option value="Zoram Gas Agency (Dawrpui)">Zoram Gas Agency (Dawrpui)</option>
                    <option value="Lunglei Indane Agency">Lunglei Indane Agency</option>
                    <option value="Champhai Bharatgas">Champhai Bharatgas</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    LPG Consumer Number / Registered Mobile *
                  </label>
                  <input
                    type="text"
                    required
                    value={gasConsumerNo}
                    onChange={(e) => setGasConsumerNo(e.target.value)}
                    placeholder="e.g. GX-994821"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-red-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">14.2kg Refill Rate (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '1050'}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-red-600"
                  />
                </div>
              </div>
            )}

            {/* 8. BROADBAND / FIBER */}
            {service.id === 'broadband' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Fiber / Broadband Provider *
                  </label>
                  <select
                    value={broadbandProvider}
                    onChange={(e) => setBroadbandProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-teal-600"
                  >
                    <option value="JioFiber Mizoram">JioFiber Mizoram</option>
                    <option value="Airtel Xstream Fiber">Airtel Xstream Fiber</option>
                    <option value="BSNL Bharat Fiber (FTTH)">BSNL Bharat Fiber (FTTH)</option>
                    <option value="Skylink / Local Cable Broadband">Skylink Broadband</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Broadband Account Number / Landline *
                  </label>
                  <input
                    type="text"
                    required
                    value={broadbandAccNo}
                    onChange={(e) => setBroadbandAccNo(e.target.value)}
                    placeholder="e.g. JF-9862-4411"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Monthly Plan Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '799'}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 799"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-teal-600"
                  />
                </div>
              </div>
            )}

            {/* 9. LOAN EMI REPAYMENT */}
            {service.id === 'loan' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Bank / Financial Institution *
                  </label>
                  <select
                    value={lenderName}
                    onChange={(e) => setLenderName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-slate-700"
                  >
                    <option value="Mizoram Rural Bank (MRB)">Mizoram Rural Bank (MRB)</option>
                    <option value="State Bank of India (SBI)">State Bank of India (SBI)</option>
                    <option value="MCAB (Mizoram Apex Bank)">MCAB (Mizoram Apex Bank)</option>
                    <option value="Bajaj Finserv">Bajaj Finserv</option>
                    <option value="HDFC Bank">HDFC Bank</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Loan Account Number / Agreement ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={loanAccountNo}
                    onChange={(e) => setLoanAccountNo(e.target.value)}
                    placeholder="e.g. MRB-LOAN-984021"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">EMI Installment Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '4500'}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 4500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-slate-700"
                  />
                </div>
              </div>
            )}

            {/* 10. MST BUS & HELICOPTER TICKETS */}
            {service.id === 'tickets' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Transport Route (MST / Helicopter) *
                  </label>
                  <select
                    value={busRoute}
                    onChange={(e) => setBusRoute(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-rose-600"
                  >
                    <option value="Aizawl -> Lunglei (MST Night Service)">Aizawl → Lunglei (MST Night Service - ₹550)</option>
                    <option value="Aizawl -> Champhai (MST Bus)">Aizawl → Champhai (MST Bus - ₹450)</option>
                    <option value="Aizawl -> Siaha (MST Luxury)">Aizawl → Siaha (MST Luxury - ₹850)</option>
                    <option value="Aizawl -> Lengpui Heli Service">Aizawl → Lengpui Helicopter (Pawan Hans - ₹2400)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Passenger Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={passengerName}
                    onChange={(e) => setPassengerName(e.target.value)}
                    placeholder="e.g. C. Lalrindika"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-rose-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Ticket Fare Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '550'}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 550"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-rose-600"
                  />
                </div>
              </div>
            )}

            {/* 11. SCHOOL & COLLEGE FEES */}
            {service.id === 'school_fees' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Educational Institution (School / College) *
                  </label>
                  <select
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    {SCHOOL_COLLEGES.map((sc) => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Student Roll Number / Enrollment ID *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      placeholder="e.g. MZU-2024-8192"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('school_fees', studentId || 'MZU-2024-8192')}
                      disabled={isFetchingBill}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isFetchingBill ? 'Checking...' : 'Check Dues'}</span>
                    </button>
                  </div>
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
                    placeholder="Student full name"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Fee Head / Category *
                  </label>
                  <select
                    value={feeCategory}
                    onChange={(e) => setFeeCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-indigo-600"
                  >
                    <option value="Semester Tuition & Exam Fee">Semester Tuition & Exam Fee</option>
                    <option value="Monthly School Fee">Monthly School Fee</option>
                    <option value="Hostel & Mess Charges">Hostel & Mess Charges</option>
                    <option value="Admission & Registration Fee">Admission & Registration Fee</option>
                  </select>
                </div>

                {linkedBillData && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 space-y-1.5 text-indigo-950">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-indigo-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-500">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">Assessed Fee</span>
                        <span className="text-sm font-black text-indigo-700">₹{linkedBillData.billAmount}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Fee Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '3500'}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 3500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-indigo-600"
                  />
                </div>
              </div>
            )}

            {/* 12. INSURANCE & LIC PREMIUM */}
            {service.id === 'insurance' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Insurance Corporation / Provider *
                  </label>
                  <select
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                  >
                    {INSURANCE_PROVIDERS.map((ins) => (
                      <option key={ins} value={ins}>{ins}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Policy Number *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={policyNo}
                      onChange={(e) => setPolicyNo(e.target.value)}
                      placeholder="Enter 9-10 digit Policy Number"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchLiveBill('insurance', policyNo || 'LIC-984210384')}
                      disabled={isFetchingBill}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-black px-3 py-2 rounded-xl text-[11px] whitespace-nowrap transition cursor-pointer flex items-center gap-1 shadow-xs shrink-0"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isFetchingBill ? 'Validating...' : 'Fetch Premium'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Policyholder Date of Birth (DD/MM/YYYY) *
                  </label>
                  <input
                    type="text"
                    required
                    value={policyHolderDob}
                    onChange={(e) => setPolicyHolderDob(e.target.value)}
                    placeholder="DD/MM/YYYY"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                {linkedBillData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 space-y-1.5 text-blue-950">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-extrabold flex items-center gap-1 text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                        <CheckCircle2 className="w-3 h-3 text-blue-600" /> {linkedBillData.status}
                      </span>
                      <span className="font-bold text-slate-500">Due: {linkedBillData.dueDate}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-black text-xs text-slate-900">{linkedBillData.consumerName}</h4>
                        <p className="text-[10px] text-slate-600">{linkedBillData.subDivisionOrLocality}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9.5px] text-slate-500 font-bold block">Due Premium</span>
                        <span className="text-sm font-black text-blue-700">₹{linkedBillData.billAmount}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">Premium Amount (₹)</label>
                  <input
                    type="number"
                    required
                    value={amount || '4500'}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 4500"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-black text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>
              </div>
            )}

            {/* Direct Official Portals & Direct UPI Payment Links (Real Working Links) */}
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-extrabold text-slate-800 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-600" /> Official Portal & App Direct Links:
                </span>
                <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                  Live External
                </span>
              </div>

              {/* Service specific real direct links */}
              {service.id === 'electricity' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://power.mizoram.gov.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-amber-50 border border-amber-200 p-2 rounded-xl text-center font-bold text-amber-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>P&ED Mizoram Portal</span>
                    </a>
                    <a
                      href="https://mizorampower.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-amber-50 border border-amber-200 p-2 rounded-xl text-center font-bold text-amber-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <ExternalLink className="w-3 h-3 text-amber-600" />
                      <span>Online Consumer Portal</span>
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://paytm.com/electricity-bill-payment/mizoram/power-electricity-department-mizoram"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-50 hover:bg-sky-100 border border-sky-200 p-1.5 rounded-xl text-center font-bold text-sky-900 text-[10px] flex items-center justify-center gap-1 transition"
                    >
                      <span>⚡ Paytm P&ED Mizoram</span>
                    </a>
                    <a
                      href="https://www.phonepe.com/recharge-bill-payment/electricity-bill-payment/mizoram/power-and-electricity-department-mizoram"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-purple-50 hover:bg-purple-100 border border-purple-200 p-1.5 rounded-xl text-center font-bold text-purple-900 text-[10px] flex items-center justify-center gap-1 transition"
                    >
                      <span>⚡ PhonePe P&ED Mizoram</span>
                    </a>
                  </div>
                </div>
              )}

              {service.id === 'fastag' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://www.ihmcl.co.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-orange-50 border border-orange-200 p-2 rounded-xl text-center font-bold text-orange-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <Car className="w-3.5 h-3.5 text-orange-600" />
                      <span>IHMCL FASTag Portal</span>
                    </a>
                    <a
                      href="https://netc.org.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-orange-50 border border-orange-200 p-2 rounded-xl text-center font-bold text-orange-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <ExternalLink className="w-3 h-3 text-orange-600" />
                      <span>NETC / NPCI Portal</span>
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://paytm.com/fastag-recharge"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-50 hover:bg-sky-100 border border-sky-200 p-1.5 rounded-xl text-center font-bold text-sky-900 text-[10px] flex items-center justify-center gap-1 transition"
                    >
                      <span>🚗 Paytm FASTag Recharge</span>
                    </a>
                    <a
                      href="https://www.phonepe.com/recharge-bill-payment/fastag-recharge"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-purple-50 hover:bg-purple-100 border border-purple-200 p-1.5 rounded-xl text-center font-bold text-purple-900 text-[10px] flex items-center justify-center gap-1 transition"
                    >
                      <span>🚗 PhonePe FASTag Top-Up</span>
                    </a>
                  </div>
                </div>
              )}

              {service.id === 'water' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://phed.mizoram.gov.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-cyan-50 border border-cyan-200 p-2 rounded-xl text-center font-bold text-cyan-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <Droplet className="w-3.5 h-3.5 text-cyan-600" />
                      <span>PHED Mizoram Portal</span>
                    </a>
                    <a
                      href="https://phedwater.mizoram.gov.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-cyan-50 border border-cyan-200 p-2 rounded-xl text-center font-bold text-cyan-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <ExternalLink className="w-3 h-3 text-cyan-600" />
                      <span>PHE Online Bill Desk</span>
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://paytm.com/water-bill-payment"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-sky-50 hover:bg-sky-100 border border-sky-200 p-1.5 rounded-xl text-center font-bold text-sky-900 text-[10px] flex items-center justify-center gap-1 transition"
                    >
                      <span>💧 Paytm Water Bill</span>
                    </a>
                    <a
                      href="https://www.phonepe.com/recharge-bill-payment/water-bill-payment"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-purple-50 hover:bg-purple-100 border border-purple-200 p-1.5 rounded-xl text-center font-bold text-purple-900 text-[10px] flex items-center justify-center gap-1 transition"
                    >
                      <span>💧 PhonePe Water Bill</span>
                    </a>
                  </div>
                </div>
              )}

              {service.id === 'municipal_tax' && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    <a
                      href="https://amcmizoram.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center font-bold text-emerald-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                      <span>AMC Official Portal</span>
                    </a>
                    <a
                      href="https://amcmizoram.com/tax-payment"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white hover:bg-emerald-50 border border-emerald-200 p-2 rounded-xl text-center font-bold text-emerald-900 text-[10.5px] flex items-center justify-center gap-1 transition shadow-2xs"
                    >
                      <ExternalLink className="w-3 h-3 text-emerald-600" />
                      <span>AMC Property Tax Desk</span>
                    </a>
                  </div>
                </div>
              )}

              {service.id === 'mobile' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <a
                    href="https://paytm.com/recharge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-sky-50 hover:bg-sky-100 border border-sky-200 p-1.5 rounded-xl text-center font-bold text-sky-900 text-[10px] flex items-center justify-center gap-1 transition"
                  >
                    <span>📱 Paytm Mobile Recharge</span>
                  </a>
                  <a
                    href="https://www.phonepe.com/recharge-bill-payment/mobile-recharge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-50 hover:bg-purple-100 border border-purple-200 p-1.5 rounded-xl text-center font-bold text-purple-900 text-[10px] flex items-center justify-center gap-1 transition"
                  >
                    <span>📱 PhonePe Mobile Recharge</span>
                  </a>
                </div>
              )}

              {service.id === 'dth' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <a
                    href="https://paytm.com/dth-recharge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-sky-50 hover:bg-sky-100 border border-sky-200 p-1.5 rounded-xl text-center font-bold text-sky-900 text-[10px] flex items-center justify-center gap-1 transition"
                  >
                    <span>📺 Paytm DTH Recharge</span>
                  </a>
                  <a
                    href="https://www.phonepe.com/recharge-bill-payment/dth-recharge"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-50 hover:bg-purple-100 border border-purple-200 p-1.5 rounded-xl text-center font-bold text-purple-900 text-[10px] flex items-center justify-center gap-1 transition"
                  >
                    <span>📺 PhonePe DTH Recharge</span>
                  </a>
                </div>
              )}

              {/* Direct UPI Apps Quick Option */}
              <div className="pt-1 border-t border-slate-200">
                <span className="text-[9.5px] font-bold text-slate-600 block mb-1">
                  Emaw UPI App hmangin pe tlang nghal rawh:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const payAmt = amount || (linkedBillData ? linkedBillData.billAmount.toString() : '500');
                      const upiString = `upi://pay?pa=ronpay.bbps@axl&pn=${encodeURIComponent(service.name)}&am=${payAmt}&cu=INR&tn=${encodeURIComponent(`Bill:${service.id}`)}`;
                      window.location.href = upiString;
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <span>PhonePe UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const payAmt = amount || (linkedBillData ? linkedBillData.billAmount.toString() : '500');
                      const upiString = `upi://pay?pa=ronpay.bbps@axl&pn=${encodeURIComponent(service.name)}&am=${payAmt}&cu=INR&tn=${encodeURIComponent(`Bill:${service.id}`)}`;
                      window.location.href = upiString;
                    }}
                    className="bg-sky-500 hover:bg-sky-600 text-white font-bold text-[10px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <span>Paytm UPI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const payAmt = amount || (linkedBillData ? linkedBillData.billAmount.toString() : '500');
                      const upiString = `upi://pay?pa=ronpay.bbps@axl&pn=${encodeURIComponent(service.name)}&am=${payAmt}&cu=INR&tn=${encodeURIComponent(`Bill:${service.id}`)}`;
                      window.location.href = upiString;
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-2 rounded-xl flex items-center justify-center gap-1 transition cursor-pointer shadow-xs"
                  >
                    <span>GPay UPI</span>
                  </button>
                </div>
              </div>
            </div>

            {/* BBPS Assurance Strip */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> BBPS Verified Portal
              </span>
              <span className="font-mono text-[9.5px]">0% Surcharge</span>
            </div>

            {/* Pay Button */}
            <button
              type="submit"
              disabled={isPaying}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 rounded-2xl text-xs shadow-md hover:shadow-lg transition cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {isPaying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing BBPS Settlement...</span>
                </>
              ) : (
                <>
                  <span>
                    {t.payNow || 'Pay Now'} • ₹{amount || (linkedBillData ? linkedBillData.billAmount : '500')}
                  </span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          /* Payment Success & Formal Receipt Screen */
          <div className="text-center py-4 space-y-4 animate-scaleUp">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase border border-emerald-200">
                BBPS Payment Successful
              </span>
              <h3 className="font-black text-slate-900 text-lg">
                ₹{amount || (linkedBillData ? linkedBillData.billAmount : '500')}
              </h3>
              <p className="text-xs font-bold text-slate-700">{service.name} Settled</p>
              <p className="text-[10px] text-slate-400 font-mono">
                BBPS Ref: BBPS-MZ-{Date.now().toString().slice(-8)}
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-[10.5px]">Service:</span>
                <span className="font-black text-slate-900">{service.name}</span>
              </div>

              {service.id === 'mobile' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[10.5px]">Mobile & Plan:</span>
                  <span className="font-bold text-slate-900">{phone} ({operator})</span>
                </div>
              )}

              {service.id === 'electricity' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[10.5px]">Consumer & Circle:</span>
                  <span className="font-bold text-slate-900">{consumerNumber} ({subDivision})</span>
                </div>
              )}

              {service.id === 'fastag' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[10.5px]">Vehicle Registration:</span>
                  <span className="font-bold text-slate-900">{vehicleNumber}</span>
                </div>
              )}

              {service.id === 'water' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[10.5px]">PHE Connection:</span>
                  <span className="font-bold text-slate-900">{waterConsumerId}</span>
                </div>
              )}

              {service.id === 'school_fees' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[10.5px]">Student & School:</span>
                  <span className="font-bold text-slate-900">{studentName} ({institution})</span>
                </div>
              )}

              {service.id === 'insurance' && (
                <div className="flex justify-between items-center text-slate-600">
                  <span className="text-[10.5px]">Policy & Provider:</span>
                  <span className="font-bold text-slate-900">{policyNo} ({insuranceProvider})</span>
                </div>
              )}

              <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/80 pt-1.5">
                <span className="text-[10.5px]">Timestamp:</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="text-[10.5px]">Payment Status:</span>
                <span className="font-black text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Instant Credit Verified
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-2.5 rounded-2xl text-xs shadow-md transition cursor-pointer active:scale-98"
              >
                Close & Finish
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
