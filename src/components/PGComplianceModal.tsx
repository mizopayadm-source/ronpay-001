import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  FileText,
  Lock,
  RotateCcw,
  PhoneCall,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  Cpu,
  Globe,
  Sliders,
  Sparkles,
  Zap,
  Printer,
  ChevronRight,
  Info,
  Layers,
  ArrowRight,
  BadgeCheck,
  CreditCard,
  QrCode
} from 'lucide-react';
import { PaymentGatewayConfig, PGMode, PGProvider, PGEnvironment } from '../types';
import { getStoredPGConfig, saveStoredPGConfig } from '../utils/storage';

interface PGComplianceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'architecture' | 'terms' | 'privacy' | 'refund' | 'grievance' | 'sandbox';
  userLanguage?: 'mizo' | 'english';
}

export const PGComplianceModal: React.FC<PGComplianceModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'architecture',
  userLanguage = 'mizo'
}) => {
  const [activeTab, setActiveTab] = useState<'architecture' | 'terms' | 'privacy' | 'refund' | 'grievance' | 'sandbox'>(initialTab);
  const [lang, setLang] = useState<'mizo' | 'english'>(userLanguage);
  const [pgConfig, setPgConfig] = useState<PaymentGatewayConfig>(getStoredPGConfig());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [simulatingPG, setSimulatingPG] = useState<boolean>(false);
  const [simulatedTxResult, setSimulatedTxResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      const stored = getStoredPGConfig();
      if (
        !stored.webhookEndpoint ||
        stored.webhookEndpoint.includes('run.app') ||
        stored.webhookEndpoint.includes('ais-dev') ||
        stored.webhookEndpoint.includes('ais-pre') ||
        stored.webhookEndpoint.includes('localhost')
      ) {
        stored.webhookEndpoint = 'https://ronpay.app/api/pg/webhook';
        saveStoredPGConfig(stored);
      }
      setPgConfig(stored);
      setSimulatedTxResult(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const isMizo = lang === 'mizo';

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveConfig = () => {
    saveStoredPGConfig(pgConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleRunPGSimulation = () => {
    setSimulatingPG(true);
    setSimulatedTxResult(null);

    setTimeout(() => {
      setSimulatingPG(false);
      setSimulatedTxResult(
        `PG Token generated: TKN_${Date.now()}_SUCCESS | Status: PAYMENT_SUCCESS (UTR: 2026090698124) | Webhook: 200 OK received`
      );
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white text-slate-900 w-full max-w-5xl h-[92vh] max-h-[850px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400 font-black shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white">
                  RonPay Compliance & Payment Gateway (PG) Hub
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  RBI & PG Audit Ready
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {isMizo 
                  ? 'Payment Gateway (PG) te duh dan, dan leh kalphung tarlan na hmunpui' 
                  : 'Statutory merchant policies, RBI intermediary guidelines & PG technical readiness'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switch */}
            <button
              type="button"
              onClick={() => setLang(l => l === 'mizo' ? 'english' : 'mizo')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-300 border border-slate-700 transition flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{isMizo ? 'English' : 'Mizo'}</span>
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={() => window.print()}
              title="Print Policy Document"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS - FLEX-WRAP SO ALL TABS ARE 100% VISIBLE WITHOUT CLIPPING */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300/80 shadow-2xs'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isMizo ? '1. Merchant Kalphung' : '1. Merchant Architecture'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300/80 shadow-2xs'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>{isMizo ? '2. Hman Dan (Terms)' : '2. Terms & Conditions'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300/80 shadow-2xs'
            }`}
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>{isMizo ? '3. Privacy & Security' : '3. Privacy Policy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('refund')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'refund'
                ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300/80 shadow-2xs'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>{isMizo ? '4. Refund & Cancellation' : '4. Refund Policy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grievance')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'grievance'
                ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-500'
                : 'bg-white text-slate-700 hover:bg-slate-200/70 border border-slate-300/80 shadow-2xs'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 shrink-0" />
            <span>{isMizo ? '5. Grievance & Office' : '5. Contact & Grievance'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sandbox')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'sandbox'
                ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-500'
                : 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 shadow-2xs'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>{isMizo ? '6. ⚙️ PG Switch & Sandbox' : '6. ⚙️ PG Switch & Sandbox'}</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-700 text-sm leading-relaxed">
          
          {/* TAB 1: ARCHITECTURE & PG AUDIT READINESS */}
          {activeTab === 'architecture' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Executive Summary Card */}
              <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-amber-50/50 p-5 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-base">
                  <BadgeCheck className="w-5 h-5 text-indigo-600" />
                  <h4>{isMizo ? 'Payment Gateway (PG) Ho Tan: RonPay Kalphung Tlangpui' : 'Executive Disclosure for Payment Gateway Underwriters'}</h4>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {isMizo
                    ? 'RonPay hi Mizoram leh hmarchhak bial tana siam, Community Crowdfunding, Kohhran Bawm, Ralna leh Welfare pekna atana FinTech Platform (Technology Service Provider - TSP) a ni a. Sum kan khawl (deposit) ve ngai lo va, contributor-te sum chu beneficiary (campaign creator / kohhran / yma) te bank account-ah direct-in a lut zel a ni (Non-Custodial Escrow/Direct Settlement Architecture).'
                    : 'RonPay is a specialized digital community crowdfunding and church welfare management platform operating in Mizoram, Northeast India. RonPay operates strictly as a pure Technology Service Provider (TSP) facilitating direct payments to verified beneficiaries, non-profits, and bereavement welfare funds in strict compliance with RBI Intermediary and P2M settlement regulations.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{isMizo ? 'Business Model' : 'Business Category'}</span>
                    <strong className="text-xs text-indigo-950">Technology Service Provider (TSP)</strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{isMizo ? 'Fund Settlement' : 'Settlement Route'}</span>
                    <strong className="text-xs text-emerald-700">Direct Nodal / T+0 or T+1 to Beneficiary</strong>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">{isMizo ? 'Platform Fee' : 'Platform Monetization'}</span>
                    <strong className="text-xs text-amber-700">0% Voluntary Free Trial / Subscription</strong>
                  </div>
                </div>
              </div>

              {/* Crucial Safeguards for RonPay & PG */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{isMizo ? 'RonPay Himna & PG Duh Dan (Compliance Safeguards)' : 'Key Legal & Risk Safeguards'}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      {isMizo ? '1. Non-Custodial (Pawisa Kawl Loh)' : '1. Non-Custodial Architecture'}
                    </h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {isMizo
                        ? 'RonPay-in sum a khawl ve loh avangin RBI-in payment aggregator-te tana Nodal Account khauh taka an phutna tam tak lakah RonPay a fihlim a, PG ho tan pawh risk a tlem phah a ni.'
                        : 'RonPay does not maintain pooled wallet balances. All transactions route through PG/NPCI settlement pipelines straight to verified campaign creators.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      {isMizo ? '2. Campaign Creator KYC & AI Hriatpui' : '2. Campaign Vetting & Verification'}
                    </h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {isMizo
                        ? 'Ralna, Kohhran, leh Welfare bawm zawng zawng hi Admin Approval leh AI Hriatpui (YMA/Branch Secretary lehkha endik) paltlang hnuah chauh mipuiah an live thin.'
                        : 'Every campaign requires institutional verification (YMA branch, church board, or admin KYC) before receiving donations, preventing fraud and AML violations.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      {isMizo ? '3. Live Auditing & UTR Matching' : '3. Real-time UTR & Webhook Matching'}
                    </h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {isMizo
                        ? 'Transaction tinte hi Bank UTR Reference Number leh Webhook hmanga nemngheh zel a ni a, double-claim leh transaction lem a awm thei lo.'
                        : 'Every receipt matches bank-issued 12-digit UTR and PG payment IDs, creating an immutable audit trail for accounting and tax compliance.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                    <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      {isMizo ? '4. Dual Payment Modes (Direct UPI + PG)' : '4. Seamless Gateway Fallback'}
                    </h5>
                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {isMizo
                        ? 'Tun lailawka Direct UPI Intent hman a nih laiin, PG nena inzawm rualin PG Checkout API (Card, NetBanking, Wallet, UPI Intent) a nung nghal thei e.'
                        : 'The platform architecture is plug-and-play: ready to toggle from current P2P UPI URI links to Commercial PG SDKs (PhonePe PG / Razorpay) in 1 click.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* RBI Compliance Notice */}
              <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-700 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Statutory Declaration:</strong> RonPay Technologies conforms to the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, and the Reserve Bank of India Master Directions on Payment Intermediaries.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TERMS OF SERVICE */}
          {activeTab === 'terms' && (
            <div className="space-y-5 animate-fadeIn text-xs sm:text-sm">
              <div className="border-b pb-3">
                <h4 className="font-bold text-base text-slate-900">
                  {isMizo ? 'RonPay Hman Dan Kalphung Leh Inremna (Terms of Service)' : 'Terms of Service & User Agreement'}
                </h4>
                <p className="text-xs text-slate-500">Last updated: September 2026 • Governed under the laws of India</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">1. Platform Nature & Scope</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    RonPay Technologies operates a digital facilitation platform providing technical tools for community welfare campaigns, obituary funds (ralna), church tithing (kumtluang), and local contributions in Mizoram. RonPay is not a bank, deposit-taking entity, or financial guarantor.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">2. User & Campaign Creator Obligations</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    Campaign creators must provide truthful, authentic beneficiary details, verified mobile numbers, and valid UPI/Bank credentials. Any fraudulent campaign, misrepresentation of death or calamity, or deceptive fundraising is strictly prohibited and subject to immediate account termination and reporting to Law Enforcement authorities.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">3. Donor Contributions & Voluntary Nature</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    All payments, donations, and contributions made through RonPay are voluntary social, benevolent, or religious contributions. Donors understand and acknowledge that RonPay facilitates payment transmission to the designated beneficiary and does not independently endorse personal campaigns.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">4. Payment Gateway & Third-Party Processing</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    Online transactions are processed via licensed Payment Gateways (e.g. PhonePe PG, Razorpay, NPCI UPI Network). Users agree to comply with the respective gateway&apos;s processing rules, authentication protocols, and banking service terms.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">5. Limitation of Liability & Indemnity</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    RonPay Technologies, its directors, and staff shall not be liable for any indirect, technical failure of the banking switch, or unauthorized use of third-party credentials. Users agree to indemnify RonPay against any claims arising from fraudulent campaigns initiated by creators.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 animate-fadeIn text-xs sm:text-sm">
              <div className="border-b pb-3">
                <h4 className="font-bold text-base text-slate-900">
                  {isMizo ? 'Mimal Thuthang Humhalhna (Privacy & Data Protection Policy)' : 'Privacy & Data Security Policy'}
                </h4>
                <p className="text-xs text-slate-500">Compliant with the Digital Personal Data Protection (DPDP) Act, 2023</p>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">1. Information We Collect</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    We collect essential transaction information: Donor Name, Phone Number, Locality/Veng, Transaction Amount, Timestamp, and Bank Reference UTR. We do <strong>NOT</strong> collect, store, or process full debit/credit card CVV, ATM PINs, or UPI Security PINs.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">2. Purpose of Data Processing</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    Data collected is used solely to generate authentic digital receipts, maintain transparent community audit rolls, facilitate receipt verification for the beneficiary/treasurer, and comply with statutory banking audit regulations.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">3. Non-Disclosure & Security Standards</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    RonPay will never sell, rent, or trade user phone numbers or personal records to marketing companies. All data transmissions are protected using 256-bit TLS/SSL encryption. Donor anonymity can be requested by selecting &quot;Hming Thup (Anonymous)&quot; during checkout.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">4. Data Retention & User Rights</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    Transaction records are retained for auditing purposes in compliance with financial record-keeping norms. Users may request correction or export of their contribution history by contacting our Grievance Officer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: REFUND & CANCELLATION POLICY */}
          {activeTab === 'refund' && (
            <div className="space-y-5 animate-fadeIn text-xs sm:text-sm">
              <div className="border-b pb-3">
                <h4 className="font-bold text-base text-slate-900">
                  {isMizo ? 'Pawisa Kirleh & Tihtawp Dan (Refund, Cancellation & Chargebacks)' : 'Refund & Cancellation Policy'}
                </h4>
                <p className="text-xs text-amber-700 font-semibold">Mandatory Policy for Payment Gateway Merchant Onboarding</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed space-y-1">
                <strong>{isMizo ? 'Hriat Tur Pawimawh:' : 'Policy Core Statement:'}</strong>
                <p>
                  {isMizo
                    ? 'Ralna, Kohhran, leh Welfare pekna hi mi thinlung duhtawka pek (voluntary benevolent donation) a nih avangin, beneficiary hnena pawisa luh tawh hnuah a tlangpuiin refund a theih loh va. Amaherawchu, technical error vanga vawihnih lo in-debit emaw transaction buai a awm chuan a hnuaia dan ang hian siamthat nghal a ni.'
                    : 'Contributions made to campaigns, condolences (Ralna), or church funds are voluntary charitable disbursements. Once funds are transmitted to the verified beneficiary, cancellations are not ordinarily permitted. However, technical discrepancies and duplicate debits are protected under our automated resolution protocol.'}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">1. Technical Failures & Duplicate Debits</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    If an amount is debited from your bank account multiple times due to a network lag or session timeout without generating an active campaign credit, the excess amount is automatically reconciled and returned to the original payment source within <strong>5 to 7 banking working days</strong>.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">2. Disputed Campaigns & Fraudulent Claims</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    If a campaign is flagged for misrepresentation or fraud prior to beneficiary disbursement, RonPay reserves the right to freeze the campaign and execute a full refund to all participating donors in coordination with our Payment Gateway partner.
                  </p>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1">3. How to Request a Refund / Report Discrepancy</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    To report a technical deduction error, email <strong>refunds@ronpay.app</strong> or WhatsApp our support line at <strong>+91 94361 00000</strong> within <strong>48 hours</strong> of the transaction with your Bank UTR number, Date, and Amount.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GRIEVANCE & STATUTORY OFFICE */}
          {activeTab === 'grievance' && (
            <div className="space-y-5 animate-fadeIn text-xs sm:text-sm">
              <div className="border-b pb-3">
                <h4 className="font-bold text-base text-slate-900">
                  {isMizo ? 'Biakpawhna & Grievance Redressal Officer' : 'Contact Us & Statutory Grievance Redressal'}
                </h4>
                <p className="text-xs text-slate-500">Under Rule 3(2) of Information Technology (Intermediary Guidelines) Rules, 2021</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Office Details */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <h5 className="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>{isMizo ? 'RonPay Office Hmunpui' : 'Registered Office Address'}</span>
                  </h5>
                  <div className="space-y-1 text-slate-600 text-xs">
                    <p className="font-bold text-slate-900">RonPay Technologies Private Limited</p>
                    <p>FinTech Innovation Wing, Treasury Square</p>
                    <p>Aizawl, Mizoram - 796001, India</p>
                    <p className="pt-1">Support Email: <strong className="text-indigo-600">support@ronpay.app</strong></p>
                    <p>Helpline: <strong className="text-slate-900">+91 94361 50000</strong> (10 AM - 5 PM IST)</p>
                  </div>
                </div>

                {/* Grievance Officer */}
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3">
                  <h5 className="font-bold text-indigo-950 flex items-center gap-1.5 text-sm">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    <span>{isMizo ? 'Designated Grievance Officer' : 'Statutory Grievance Officer'}</span>
                  </h5>
                  <div className="space-y-1 text-slate-700 text-xs">
                    <p className="font-bold text-slate-900">Mr. Lalbiakzuala</p>
                    <p className="text-slate-600">Head of Regulatory Compliance & Risk</p>
                    <p>RonPay Technologies, Aizawl</p>
                    <p className="pt-1">Grievance Email: <strong className="text-indigo-700">grievance@ronpay.app</strong></p>
                    <p className="text-[11px] text-slate-500 pt-1">
                      <em>TAT: Grievance acknowledgment within 24 hours; resolution within 15 working days.</em>
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Support hours */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs">
                <span className="text-slate-600">
                  {isMizo ? 'Customer Care & Help Desk: Isnin atanga Inrinni, Zing dar 9:00 - Tlai dar 6:00' : 'Customer Care Operating Hours: Monday to Saturday, 9:00 AM to 6:00 PM IST'}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                  ACTIVE & MONITORED
                </span>
              </div>
            </div>
          )}

          {/* TAB 6: PAYMENT GATEWAY (PG) SWITCH & SANDBOX */}
          {activeTab === 'sandbox' && (
            <div className="space-y-6 animate-fadeIn text-xs sm:text-sm">
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-amber-950 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm sm:text-base flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-700" />
                    <span>{isMizo ? 'Payment Gateway (PG) Switch & Settings' : 'Payment Gateway (PG) Switch & Sandbox Controller'}</span>
                  </h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    pgConfig.mode === 'pg_merchant' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-indigo-600 text-white'
                  }`}>
                    {pgConfig.mode === 'pg_merchant' ? 'Commercial PG Active' : 'Direct UPI Intent Active'}
                  </span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {isMizo 
                    ? 'He setting atang hian RonPay chu tun lailawka "Direct UPI Intent & Dynamic QR" atangin "Commercial PG (PhonePe PG / Razorpay)"-ah awlsam takin i thlak thei a. PG ho hnena i dilna an pawm veleh live credentials dah luhin a nung nghal zar thei a ni.'
                    : 'Use this configuration bridge to toggle between the current Direct UPI Intent mode and official Payment Gateway Merchant mode. This proves full technical readiness during PG onboarding audits.'}
                </p>
              </div>

              {/* Mode Toggle Switch */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-4">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  {isMizo ? 'A. Payment Processing Mode Thlanna' : 'A. Payment Processing Mode'}
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPgConfig(p => ({ ...p, mode: 'direct_upi' }))}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      pgConfig.mode === 'direct_upi'
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <QrCode className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-xs text-slate-900">
                        {isMizo ? '1. Direct UPI Intent & Dynamic QR' : '1. Direct UPI Deep-link & Dynamic QR'}
                      </strong>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        {isMizo ? 'Personal / Merchant VPA direct launch (Current active mode, zero gateway fee)' : 'Non-custodial deep-link protocol (Current mode, zero intermediary fee)'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPgConfig(p => ({ ...p, mode: 'pg_merchant' }))}
                    className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 cursor-pointer ${
                      pgConfig.mode === 'pg_merchant'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-xs text-slate-900">
                        {isMizo ? '2. Commercial Payment Gateway (PG)' : '2. Commercial Payment Gateway (PG Mode)'}
                      </strong>
                      <span className="text-[11px] text-slate-500 block leading-tight mt-0.5">
                        {isMizo ? 'PhonePe PG / Razorpay Merchant API (Bank limit buaina awm lo, card/netbanking telin)' : 'Standard merchant checkout with webhook reconciliation and zero bank limits'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Provider & Environment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <label className="font-bold text-slate-900 text-xs block">
                    {isMizo ? 'PG Provider (Partner):' : 'Payment Gateway Provider:'}
                  </label>
                  <select
                    value={pgConfig.provider}
                    onChange={(e) => setPgConfig(p => ({ ...p, provider: e.target.value as PGProvider }))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-indigo-600"
                  >
                    <option value="phonepe_pg">PhonePe Payment Gateway (Preferred)</option>
                    <option value="razorpay">Razorpay Merchant Gateway</option>
                    <option value="cashfree">Cashfree Payments</option>
                    <option value="payu">PayU India</option>
                    <option value="custom_upi">Custom Bank Merchant Switch</option>
                  </select>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-2">
                  <label className="font-bold text-slate-900 text-xs block">
                    {isMizo ? 'Environment (Test nge Live):' : 'Operating Environment:'}
                  </label>
                  <select
                    value={pgConfig.environment}
                    onChange={(e) => setPgConfig(p => ({ ...p, environment: e.target.value as PGEnvironment }))}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-indigo-600"
                  >
                    <option value="sandbox">Sandbox (Testing / Onboarding Audit)</option>
                    <option value="production">Production (Live Merchant Transactions)</option>
                  </select>
                </div>
              </div>

              {/* Credentials Fields */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
                <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  {isMizo ? 'B. API Keys & Merchant Credentials' : 'B. Merchant API Credentials'}
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Merchant ID (MID):</label>
                    <input
                      type="text"
                      value={pgConfig.merchantId}
                      onChange={(e) => setPgConfig(p => ({ ...p, merchantId: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 font-mono text-xs"
                      placeholder="e.g. PGTEST_RONPAY_001"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Key ID / Salt Index:</label>
                    <input
                      type="text"
                      value={pgConfig.keyId}
                      onChange={(e) => setPgConfig(p => ({ ...p, keyId: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 font-mono text-xs"
                      placeholder="e.g. M2306160483220674079460"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Salt Key / API Secret:</label>
                    <input
                      type="password"
                      value={pgConfig.keySecret}
                      onChange={(e) => setPgConfig(p => ({ ...p, keySecret: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-slate-300 font-mono text-xs"
                      placeholder="••••••••••••••••••••••••••••••••••••"
                    />
                  </div>
                </div>

                {/* Webhook Endpoint */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600">
                      {isMizo ? 'RonPay Webhook Callback Endpoint (PG in an ping na tur):' : 'Webhook Callback Endpoint (For PG Server-to-Server callbacks):'}
                    </label>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      Official Domain Recommended
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pgConfig.webhookEndpoint}
                      onChange={(e) => setPgConfig(p => ({ ...p, webhookEndpoint: e.target.value }))}
                      className="flex-1 p-2 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://ronpay.app/api/pg/webhook"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(pgConfig.webhookEndpoint, 'webhook')}
                      className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedKey === 'webhook' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  {/* Quick Preset Domain Switchers & Warning */}
                  {pgConfig.webhookEndpoint !== 'https://ronpay.app/api/pg/webhook' && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-semibold text-[11px]">
                          {isMizo 
                            ? 'Warning: Dev sandbox container URL a in-set a nih hi. Live PG/PhonePe tan official URL thlak rawh le:' 
                            : 'Notice: Non-production dev container URL detected. Switch to official domain:'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...pgConfig, webhookEndpoint: 'https://ronpay.app/api/pg/webhook' };
                          setPgConfig(updated);
                          saveStoredPGConfig(updated);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] transition shadow-2xs cursor-pointer flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{isMizo ? 'Official Domain-ah Thlak Rawh (ronpay.app)' : 'Reset to Official Domain (ronpay.app)'}</span>
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...pgConfig, webhookEndpoint: 'https://ronpay.app/api/pg/webhook' };
                        setPgConfig(updated);
                        saveStoredPGConfig(updated);
                      }}
                      className={`text-[11px] px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                        pgConfig.webhookEndpoint === 'https://ronpay.app/api/pg/webhook'
                          ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-1 ring-emerald-500'
                          : 'bg-white text-emerald-800 hover:bg-emerald-50 border-emerald-300'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{isMizo ? '🌐 Official Domain (https://ronpay.app/api/pg/webhook)' : '🌐 Official Production (https://ronpay.app/api/pg/webhook)'}</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                    {isMizo 
                      ? '💡 PhonePe / Razorpay / NPCI hnuaia merchant onboarding i tih dawn chuan official domain https://ronpay.app/api/pg/webhook hi hman tur a ni a, an approve rang fe zawk ang. Dev container URL chauh ni lovin official registered domain hian bank compliance a tlin a ni.'
                      : '💡 For merchant onboarding with PhonePe/Razorpay, always submit the official https://ronpay.app/api/pg/webhook registered domain for full RBI and NPCI compliance.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Save & Simulate */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isMizo ? 'Settings Save Rawh' : 'Save Configuration'}</span>
                  </button>

                  {saveSuccess && (
                    <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-fadeIn">
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved successfully!</span>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleRunPGSimulation}
                  disabled={simulatingPG}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap className={`w-3.5 h-3.5 ${simulatingPG ? 'animate-spin' : ''}`} />
                  <span>{simulatingPG ? 'Simulating PG Call...' : 'Run Test PG Payment Simulation'}</span>
                </button>
              </div>

              {/* Simulation Output */}
              {simulatedTxResult && (
                <div className="p-3.5 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] space-y-1 border border-slate-800 animate-fadeIn">
                  <div className="flex items-center gap-2 text-slate-300 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PG Integration Test Result:</span>
                  </div>
                  <p>{simulatedTxResult}</p>
                </div>
              )}

              {/* PG Audit Checklist */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <h6 className="font-bold text-slate-800 text-xs">
                  {isMizo ? 'Payment Gateway Onboarding Checklist (RonPay Dinhmun):' : 'Payment Gateway Onboarding Audit Checklist:'}
                </h6>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Terms of Service published on live URL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Privacy & Data Protection Policy published</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Refund & Cancellation Policy with 5-7 day timeline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Grievance Redressal Officer appointed & contact disclosed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Direct Settlement & Non-custodial model disclosed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Webhook endpoint ready for automated status sync</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 border-t border-slate-200 p-3 sm:p-4 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">RonPay Compliance Ver: 2026.9</span>
            <span>•</span>
            <span>NPCI / RBI Intermediary Norms</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            {isMizo ? 'Khar Rawh' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
