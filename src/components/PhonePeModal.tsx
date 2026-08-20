import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Key, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  Send, 
  Terminal, 
  Layers, 
  DollarSign, 
  Activity, 
  Lock, 
  AlertCircle, 
  Code,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Radio
} from 'lucide-react';

interface PhonePeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhonePeModal: React.FC<PhonePeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'simulator' | 'split' | 'guide'>('credentials');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<boolean>(false);

  // Live Test States
  const [testAmount, setTestAmount] = useState<number>(500);
  const [simStatus, setSimStatus] = useState<'SUCCESS' | 'PENDING' | 'FAILURE'>('SUCCESS');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);

  const credentials = {
    merchantId: 'TSPMIZOPAYUAT',
    clientId: 'TSPMIZOPAYUAT_2608171706',
    clientVersion: '1',
    clientSecret: 'Y2E1YWRiMjYtMDRlMy00ZDcxLWFjOTItYmFhOTUyMzA4MDc4',
    webhookUrl: window.location.origin + '/api/phonepe/webhook',
    env: 'UAT Sandbox (PG V2 Standard Checkout)',
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Generate Live Token
  const handleGenerateToken = async () => {
    setTokenLoading(true);
    try {
      const res = await fetch('/api/phonepe/token', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setAuthToken(data.data.access_token);
        setApiResponse(data);
      }
    } catch (e: any) {
      alert('Error fetching token: ' + e.message);
    } finally {
      setTokenLoading(false);
    }
  };

  // Run Test PG V2 Payment Initiation
  const handleTestInitiatePay = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/phonepe/initiate-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountInRupees: testAmount,
          donorName: 'Test Donor (MizoPay)',
          campaignTitle: 'PhonePe PG V2 Sandbox Test',
          simulateStatus: simStatus,
          customerPhone: '9862300000'
        })
      });
      const data = await res.json();
      setApiResponse(data);
    } catch (e: any) {
      alert('API Error: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-3xl p-5 space-y-4 shadow-2xl border border-indigo-200 relative text-slate-800 my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-purple-700 text-white rounded-xl flex items-center justify-center font-black shadow-md border-2 border-purple-300">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-black text-slate-900 text-sm">PhonePe PG V2 & TSP Portal</h3>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-300">
                  UAT ACTIVE
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">RonPay (MizoPay) Official Gateway Integration</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-[10.5px] font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'credentials' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Credentials
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'simulator' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            PG Simulator
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'split' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Split Settlement
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'guide' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Mizo Guide
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          
          {/* TAB 1: CREDENTIALS */}
          {activeTab === 'credentials' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-purple-950 font-extrabold text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-purple-700" />
                    PhonePe Authorized Partner (TSP)
                  </span>
                  <span className="text-[10px] bg-purple-200/80 px-2 py-0.5 rounded text-purple-900">
                    Standard Checkout
                  </span>
                </div>
                <p className="text-[10.5px] text-purple-900/80 leading-relaxed font-medium">
                  PhonePe tech team mail atanga dawn credentials te hi backend server-ah inject fel a ni a, API request reng rengah header-ah a kal nghal zel ang.
                </p>
              </div>

              <div className="space-y-2">
                {/* Merchant ID */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      End Merchant Test MID
                    </span>
                    <span className="font-mono font-black text-slate-900 text-xs">{credentials.merchantId}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.merchantId, 'mid')}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                    title="Copy MID"
                  >
                    {copiedKey === 'mid' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Client ID */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      TSP Client ID
                    </span>
                    <span className="font-mono font-black text-slate-900 text-xs">{credentials.clientId}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.clientId, 'cid')}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                    title="Copy Client ID"
                  >
                    {copiedKey === 'cid' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Client Secret */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      TSP Client Secret (Key)
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-xs">
                      {showSecret ? credentials.clientSecret : '••••••••••••••••••••••••••••••••'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setShowSecret(!showSecret)}
                      className="text-[9px] font-bold px-1.5 py-1 text-slate-600 hover:bg-slate-200 rounded cursor-pointer"
                    >
                      {showSecret ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(credentials.clientSecret, 'sec')}
                      className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                    >
                      {copiedKey === 'sec' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Webhook URL */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      Webhook Callback URL
                    </span>
                    <span className="font-mono text-[10px] text-indigo-700 truncate block font-bold">
                      {credentials.webhookUrl}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.webhookUrl, 'webhook')}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer shrink-0"
                  >
                    {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-900 text-slate-200 p-3 rounded-xl">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">TSP OAuth Token:</p>
                  <p className="font-mono text-[10.5px] text-emerald-400 truncate max-w-[200px]">
                    {authToken ? `${authToken.substring(0, 18)}...` : 'Not generated yet'}
                  </p>
                </div>
                <button
                  onClick={handleGenerateToken}
                  disabled={tokenLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3 py-1.5 rounded-lg text-[10px] transition flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${tokenLoading ? 'animate-spin' : ''}`} />
                  {authToken ? 'Refresh Token' : 'Generate Token'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: PG SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-800">Test Amount (₹):</label>
                  <input
                    type="number"
                    value={testAmount}
                    onChange={(e) => setTestAmount(Number(e.target.value))}
                    className="w-24 bg-white border border-slate-300 rounded-lg px-2 py-1 text-right font-black text-slate-900 text-xs"
                  />
                </div>

                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-800">UAT Simulation Result:</label>
                  <select
                    value={simStatus}
                    onChange={(e: any) => setSimStatus(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800 text-[11px]"
                  >
                    <option value="SUCCESS">Success (HTTP 200 / PAYMENT_SUCCESS)</option>
                    <option value="PENDING">Pending (Payment in Progress)</option>
                    <option value="FAILURE">Failure (PAYMENT_ERROR / Declined)</option>
                  </select>
                </div>

                <button
                  onClick={handleTestInitiatePay}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-black py-2.5 rounded-xl transition text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                >
                  <Send className={`w-3.5 h-3.5 ${isLoading ? 'animate-bounce' : ''}`} />
                  {isLoading ? 'Calling PhonePe PG V2 Pay API...' : 'Initiate PG V2 Pay Request'}
                </button>
              </div>

              {/* JSON Live Response */}
              {apiResponse && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1"><Terminal className="w-3.5 h-3.5 text-indigo-600" /> PhonePe API Response (Live)</span>
                    <span className="text-emerald-700">HTTP 200 OK</span>
                  </div>
                  <pre className="bg-slate-950 text-emerald-400 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-44 border border-slate-800 leading-tight">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SPLIT SETTLEMENT */}
          {activeTab === 'split' && (
            <div className="space-y-3 animate-fadeIn">
              <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-3.5 space-y-2">
                <h4 className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-indigo-600" />
                  Split Settlement API for RonPay
                </h4>
                <p className="text-[10.5px] text-indigo-900/80 leading-relaxed font-medium">
                  RonPay-ah hian miin Ralna/Khawlsak sum an thawh apiangin PhonePe-in auto-split a ti thei a, Bawm neitu bank account-ah 99% a lut nghal a, 1% platform fee chu RonPay account-ah a in-credit hrang thlap dawn a ni.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">Sample Donation:</span>
                  <span className="font-black text-slate-900">₹1,000.00</span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div>
                      <p className="font-extrabold text-emerald-950 text-[11px]">Bawm Beneficiary (99%)</p>
                      <p className="text-[9.5px] text-emerald-700 font-mono">ralna.family@axl</p>
                    </div>
                    <span className="font-black text-emerald-800 text-sm">₹990.00</span>
                  </div>

                  <div className="flex justify-between items-center p-2 rounded-xl bg-purple-50 border border-purple-200">
                    <div>
                      <p className="font-extrabold text-purple-950 text-[11px]">RonPay Platform Fee (1%)</p>
                      <p className="text-[9.5px] text-purple-700 font-mono">ronpay.tech@ybl</p>
                    </div>
                    <span className="font-black text-purple-800 text-sm">₹10.00</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10px] text-slate-600 space-y-1">
                <p className="font-bold text-slate-800">PhonePe Doc Links:</p>
                <div className="flex gap-2">
                  <a 
                    href="https://developer.phonepe.com/settlement" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    Settlement API <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <span>•</span>
                  <a 
                    href="https://developer.phonepe.com/split-settlement" 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    Split Settlement API <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MIZO GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-3 animate-fadeIn text-[11px]">
              <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-3.5 space-y-2">
                <h4 className="font-black text-amber-950 text-xs">
                  📧 PhonePe Mail Dawn Hman Tangkai Dan (Tihfel Ngaite):
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-amber-900/90 leading-relaxed font-medium">
                  <li>
                    <b>Tech Team Mail Thread-a chhan dan:</b> PhonePe tech team mail thread-ah khan i app URL (hei hi: <span className="font-mono text-[9px] bg-white px-1 py-0.5 rounded border border-amber-300">{window.location.origin}</span>) leh webhook URL <span className="font-mono text-[9px] bg-white px-1 py-0.5 rounded border border-amber-300">/api/phonepe/webhook</span> kha thawn let tur a ni.
                  </li>
                  <li>
                    <b>UAT Sandbox Test:</b> PG V2 Standard Checkout API leh Status API kan code tawh a, UAT-ah test transaction hlawhtling 3–5 tal kan execute ang.
                  </li>
                  <li>
                    <b>Production / Live MID dilna:</b> UAT test kan zawh hnuah PhonePe hian Production MID (Live Merchant ID) leh Salt Key tak tak an rawn issue ang a, Live-ah UPI, Cards leh NetBanking direct-in a kal nghal ang.
                  </li>
                </ol>
              </div>

              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                <p className="font-bold text-slate-800 text-xs">Sample Email Reply (PhonePe tech team hnenah copy & send theih):</p>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-[10px] text-slate-700 font-mono space-y-1">
                  <p>Hi PhonePe Team,</p>
                  <p className="mt-1">Thank you for sharing the UAT TSP credentials. We have integrated the PG V2 Standard Checkout and Authorization headers (X-MERCHANT-ID: TSPMIZOPAYUAT) in our RonPay app.</p>
                  <p className="mt-1"><b>App Base URL:</b> {window.location.origin}</p>
                  <p><b>Webhook URL:</b> {window.location.origin}/api/phonepe/webhook</p>
                  <p className="mt-1">We are verifying test transactions in sandbox and look forward to production cutover.</p>
                  <p className="mt-1">Best regards,<br/>RonPay Tech Team</p>
                </div>
                <button
                  onClick={() => copyToClipboard(`Hi PhonePe Team,\n\nThank you for sharing the UAT TSP credentials. We have integrated the PG V2 Standard Checkout and Authorization headers (X-MERCHANT-ID: TSPMIZOPAYUAT) in our RonPay app.\n\nApp Base URL: ${window.location.origin}\nWebhook URL: ${window.location.origin}/api/phonepe/webhook\n\nWe are verifying test transactions in sandbox and look forward to production cutover.\n\nBest regards,\nRonPay Tech Team`, 'mailReply')}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-1.5 rounded-lg text-[10px] transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'mailReply' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  Copy Sample Reply Text
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
          <span className="text-[10px] text-slate-400 font-mono">
            PhonePe PG V2 • MIZOPAY
          </span>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
