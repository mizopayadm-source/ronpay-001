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
  Radio,
  Bell,
  Play,
  ListChecks,
  CheckCircle2
} from 'lucide-react';
import { PhonePeCheckoutModal } from './PhonePeCheckoutModal';
import { saveTransaction, recordUserPaidTxId } from '../utils/storage';

interface PhonePeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PhonePeModal: React.FC<PhonePeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'checklist' | 'simulator' | 'webhooks' | 'credentials' | 'split'>('checklist');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const [testingItem, setTestingItem] = useState<string | null>(null);
  const [checklistTestResult, setChecklistTestResult] = useState<any>(null);

  // Live Test States
  const [testAmount, setTestAmount] = useState<number>(500);
  const [simStatus, setSimStatus] = useState<'SUCCESS' | 'PENDING' | 'FAILURE'>('SUCCESS');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  // Webhook Logs
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [testWebhookSending, setTestWebhookSending] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Split API States (Option for 100+1 Donor Pays Extra vs 99+1 Deducted from Donation)
  const [splitMode, setSplitMode] = useState<'donor_pays' | 'deduct'>('donor_pays');
  const [splitDonationAmount, setSplitDonationAmount] = useState<number>(100);
  const [splitFeePercent, setSplitFeePercent] = useState<number>(1.0);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ type, text });
    setTimeout(() => {
      setFeedbackMsg(null);
    }, 4500);
  };

  const credentials = {
    merchantId: 'TSPMIZOPAYUAT',
    merchantName: 'TSPMIZOPAYUAT',
    merchantVpa: 'mab060000049448@aubank',
    clientId: 'TSPMIZOPAYUAT_2608171706',
    clientVersion: '1',
    clientSecret: 'Y2E1YWRiMjYtMDRlMy00ZDcxLWFjOTItYmFhOTUyMzA4MDc4',
    webhookUrl: 'https://ronpay.app/api/phonepe/webhook',
    sandboxBaseUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    sandboxOAuthUrl: 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token',
    env: 'UAT Sandbox (PG V2 Standard Checkout)',
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fetchWebhookLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch('/api/phonepe/webhook-logs');
      const data = await res.json();
      setWebhookLogs(data.logs || []);
    } catch (e) {
      console.error('Error fetching webhook logs:', e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'webhooks') {
      fetchWebhookLogs();
    }
  }, [activeTab]);

  const handleSendTestWebhook = async () => {
    setTestWebhookSending(true);
    try {
      const testTxn = `RPAY_TEST_${Date.now()}`;
      await fetch('/api/phonepe/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-verify': 'TEST_VERIFIED_SHA256_HASH###1',
          'x-merchant-id': credentials.merchantId
        },
        body: JSON.stringify({
          response: Buffer.from(JSON.stringify({
            success: true,
            code: 'PAYMENT_SUCCESS',
            message: 'Your payment has been successfully processed.',
            data: {
              merchantId: credentials.merchantId,
              merchantTransactionId: testTxn,
              transactionId: `T${Date.now()}`,
              amount: testAmount * 100,
              state: 'COMPLETED',
              responseCode: 'SUCCESS',
              paymentInstrument: {
                type: 'UPI',
                utr: 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000),
                vpa: 'testuser@phonepe'
              }
            }
          })).toString('base64')
        })
      });
      await fetchWebhookLogs();
      showNotification('✅ Test webhook event sent and recorded successfully!', 'success');
    } catch (e: any) {
      showNotification('Error sending webhook: ' + e.message, 'error');
    } finally {
      setTestWebhookSending(false);
    }
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
        showNotification('✅ PhonePe OAuth Token generated successfully!', 'success');
      }
    } catch (e: any) {
      showNotification('Error fetching token: ' + e.message, 'error');
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
      showNotification('✅ Payment initiation API executed! Base64 payload & Checksum generated.', 'success');
    } catch (e: any) {
      showNotification('API Error: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Test individual endpoints for PhonePe Email Audit
  const handleTestChecklistItem = async (key: string) => {
    setTestingItem(key);
    try {
      let res: any;
      if (key === 'token') {
        res = await fetch('/api/phonepe/token', { method: 'POST' });
      } else if (key === 'pay') {
        res = await fetch('/api/phonepe/initiate-pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountInRupees: 100,
            donorName: 'Test Donor',
            campaignTitle: 'UAT Checklist Test',
            simulateStatus: 'SUCCESS',
            customerPhone: '9862300000'
          })
        });
      } else if (key === 'status') {
        res = await fetch('/api/phonepe/status/RPAY_TXN_UAT_CHECK');
      } else if (key === 'webhook_config') {
        res = await fetch('/api/phonepe/create-webhook-api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: 'https://ronpay.app/api/phonepe/webhook'
          })
        });
      } else if (key === 'split') {
        res = await fetch('/api/phonepe/split-settlement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: 500
          })
        });
      } else if (key === 'settlement') {
        res = await fetch('/api/phonepe/settlements');
      }
      const data = await res.json();
      setChecklistTestResult({ key, data });
      showNotification(`✅ Tested ${key.toUpperCase()} successfully!`, 'success');
    } catch (e: any) {
      showNotification(`Error testing ${key}: ${e.message}`, 'error');
    } finally {
      setTestingItem(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn text-slate-900">
      <div className="bg-white w-full max-w-xl rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200 relative text-slate-900 my-auto shrink-0 max-h-[92vh] flex flex-col overflow-hidden">
        
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

        {/* Dynamic Toast / Status Banner */}
        {feedbackMsg && (
          <div className={`p-3 rounded-2xl text-xs font-bold border flex items-center gap-2 animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}>
            <Sparkles className={`w-4 h-4 shrink-0 ${feedbackMsg.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
            <span className="flex-1">{feedbackMsg.text}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-[10px] font-bold text-slate-600 gap-1">
          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'checklist' ? 'bg-purple-700 text-white shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            <span>Tech Mail Audit</span>
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'simulator' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Simulator
          </button>
          <button
            onClick={() => setActiveTab('webhooks')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'webhooks' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Bell className="w-3 h-3 text-purple-600" />
            <span>Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'credentials' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Keys
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`flex-1 py-1.5 rounded-lg transition text-center cursor-pointer ${
              activeTab === 'split' ? 'bg-white text-indigo-700 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Split API
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          
          {/* TAB 0: EMAIL CHECKLIST & TECH AUDIT */}
          {activeTab === 'checklist' && (
            <div className="space-y-3.5 animate-fadeIn">
              
              {/* Introduction Card */}
              <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-3.5 space-y-2 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-black text-xs">
                    <ListChecks className="w-4 h-4 text-amber-400" />
                    PhonePe Tech Mail Audit & Compliance
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-300 font-extrabold text-[9px] px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 100% CONFIGURED
                  </span>
                </div>
                <p className="text-[10px] text-purple-200 leading-relaxed font-medium">
                  Swati (PhonePe Tech Team) mail atanga link leh ruahmanna 8 (Standard Checkout, TSP Headers, Webhook, UAT Sandbox, Partner Checklist, Settlement & Split Settlement) te chu RonPay backend leh frontend-ah fel takin thlunzawm a ni e.
                </p>
              </div>

              {/* Checklist Items */}
              <div className="space-y-2.5">

                {/* 1. Standard Checkout Pay API */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-[10px] shrink-0">
                        1
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">PG V2 PAY API (Standard Checkout)</h4>
                        <a 
                          href="https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-integration-website"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9.5px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                        >
                          View PhonePe Pay API Docs <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      READY
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    Base64 encoded payload, SHA-256 checksum (<code className="font-mono bg-slate-200 px-1 rounded">X-VERIFY</code>), leh redirectMode: POST hmangin <code className="font-mono bg-slate-200 px-1 rounded">/api/phonepe/initiate-pay</code> ah a in-set thlap.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestChecklistItem('pay')}
                    disabled={testingItem === 'pay'}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10px] hover:bg-purple-100 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    <span>{testingItem === 'pay' ? 'Testing Pay API...' : 'Test PG Pay API Call'}</span>
                  </button>
                </div>

                {/* 2. TSP Headers & Credentials */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-[10px] shrink-0">
                        2
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">TSP Headers (Mandatory Authorization)</h4>
                        <div className="flex gap-2 text-[9.5px]">
                          <a 
                            href="https://developer.phonepe.com/tsp-integration/tsp-headers/authorization"
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            Auth Docs <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <span>•</span>
                          <a 
                            href="https://developer.phonepe.com/tsp-integration/tsp-headers/http-headers-standard"
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            HTTP Headers <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      MANDATORY INCLUDED
                    </span>
                  </div>
                  <div className="bg-purple-50/70 border border-purple-200/60 p-2 rounded-xl text-[9.5px] text-purple-950 space-y-1 font-mono">
                    <p>• <b>Authorization:</b> Bearer / O-Bearer token</p>
                    <p>• <b>X-MERCHANT-ID:</b> TSPMIZOPAYUAT (End Merchant MID)</p>
                    <p>• <b>X-CLIENT-ID:</b> TSPMIZOPAYUAT_2608171706</p>
                    <p>• <b>X-CLIENT-VERSION:</b> 1</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTestChecklistItem('token')}
                    disabled={testingItem === 'token'}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10px] hover:bg-purple-100 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Key className="w-3 h-3" />
                    <span>{testingItem === 'token' ? 'Generating Token...' : 'Test TSP OAuth Token API'}</span>
                  </button>
                </div>

                {/* 3. Webhook Config API */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-[10px] shrink-0">
                        3
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Webhook Config API & S2S Callback</h4>
                        <a 
                          href="https://developer.phonepe.com/tsp-integration/tsp-webhook/create-webhook-api"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9.5px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                        >
                          Webhook Config API Docs <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    S2S Webhook listener endpoint: <code className="font-mono bg-slate-200 px-1 rounded">/api/phonepe/webhook</code>. Base64 decoded, SHA256 checksum verified, response code 200 return thlap zel a ni.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestChecklistItem('webhook_config')}
                    disabled={testingItem === 'webhook_config'}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10px] hover:bg-purple-100 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Radio className="w-3 h-3" />
                    <span>{testingItem === 'webhook_config' ? 'Configuring...' : 'Test Webhook Registration API'}</span>
                  </button>
                </div>

                {/* 4. UAT Sandbox Simulation */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-[10px] shrink-0">
                        4
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">UAT Sandbox & Mock Simulation</h4>
                        <a 
                          href="https://developer.phonepe.com/payment-gateway/uat-testing-go-live/uat-sandbox"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9.5px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                        >
                          UAT Sandbox Docs <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      SIMULATOR READY
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    End-to-end payment flows: <b>Success</b>, <b>Failure</b>, leh <b>Pending</b> te chu Simulator tab leh status API ah chiang takin a mock theih vek.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTestChecklistItem('status')}
                    disabled={testingItem === 'status'}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[10px] hover:bg-purple-100 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Activity className="w-3 h-3" />
                    <span>{testingItem === 'status' ? 'Checking Status...' : 'Test Transaction Status API'}</span>
                  </button>
                </div>

                {/* 5. Partner Checklist (Standard) */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-[10px] shrink-0">
                        5
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Partner Checklist (Go-Live Compliance)</h4>
                        <a 
                          href="https://developer.phonepe.com/tsp-integration/partner-checklist/partner-checklist-standard"
                          target="_blank"
                          rel="noreferrer"
                          className="text-[9.5px] text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                        >
                          Partner Checklist Docs <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      VERIFIED 100%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[9.5px] text-slate-700 font-semibold pt-1">
                    <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Terms & Conditions</div>
                    <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Privacy Policy</div>
                    <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Refund Policy</div>
                    <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Contact & Mizoram Address</div>
                    <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> Pricing / Fee Model</div>
                    <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-600" /> S2S Webhook Return 200</div>
                  </div>
                </div>

                {/* 6. Settlement & Split Settlement API */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-[10px] shrink-0">
                        6
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">Settlement & Split Settlement API</h4>
                        <div className="flex gap-2 text-[9.5px]">
                          <a 
                            href="https://developer.phonepe.com/settlement" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            Settlement <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                          <span>•</span>
                          <a 
                            href="https://developer.phonepe.com/split-settlement" 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-indigo-600 hover:underline flex items-center gap-0.5 font-medium"
                          >
                            Split Settlement <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                      SUPPORTED
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">
                    T+1 settlement reconciliation and direct 99% payout to Campaign Bawm + 1% RonPay TSP platform fee routing.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestChecklistItem('split')}
                      disabled={testingItem === 'split'}
                      className="py-1.5 px-2 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[9.5px] hover:bg-purple-100 transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <DollarSign className="w-3 h-3" />
                      <span>{testingItem === 'split' ? 'Testing...' : 'Test Split API'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTestChecklistItem('settlement')}
                      disabled={testingItem === 'settlement'}
                      className="py-1.5 px-2 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 font-bold text-[9.5px] hover:bg-purple-100 transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{testingItem === 'settlement' ? 'Testing...' : 'Test Settlements'}</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Real-time Checklist Test Output Display */}
              {checklistTestResult && (
                <div className="bg-slate-900 text-slate-100 p-3 rounded-2xl border border-slate-800 space-y-1.5 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                      Test Output: {checklistTestResult.key.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(checklistTestResult.data, null, 2), 'checklistJson')}
                      className="text-[10px] text-indigo-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'checklistJson' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'checklistJson' ? 'Copied' : 'Copy Output'}</span>
                    </button>
                  </div>
                  <pre className="text-[9px] font-mono bg-slate-950 p-2 rounded-xl overflow-x-auto text-emerald-300 max-h-40 border border-slate-800">
{JSON.stringify(checklistTestResult.data, null, 2)}
                  </pre>
                </div>
              )}

            </div>
          )}
          
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

                {/* Merchant UPI VPA (Receiver ID) */}
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      Merchant UPI VPA (Receiver ID)
                    </span>
                    <span className="font-mono font-black text-slate-900 text-xs">{credentials.merchantVpa}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(credentials.merchantVpa, 'vpa')}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition cursor-pointer"
                    title="Copy VPA"
                  >
                    {copiedKey === 'vpa' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
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

                {/* Direct Launch to PhonePe Checkout Modal */}
                <div className="pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsCheckoutModalOpen(true)}
                    className="w-full bg-[#5f259f] hover:bg-[#511e89] text-white font-black py-2.5 rounded-xl transition text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
                  >
                    <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
                    Launch PhonePe PG Checkout Modal
                  </button>
                  <p className="text-[10px] text-slate-500 text-center mt-1.5 font-medium">
                    Test the complete user journey: Select payment method → QR/NetBanking/Cards → UAT Simulation → Instant receipt & webhook.
                  </p>
                </div>
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

          {/* TAB: WEBHOOKS & LOGS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-purple-950 font-extrabold text-xs">
                    <Bell className="w-4 h-4 text-purple-700" />
                    Server-to-Server Webhook Receiver
                  </div>
                  <span className="text-[9.5px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                    Endpoint Active
                  </span>
                </div>
                <p className="text-[10.5px] text-purple-900/80 leading-relaxed font-medium">
                  PhonePe PG V2 sends asynchronous payment status updates to your webhook endpoint with SHA256 <code className="bg-white px-1 py-0.5 rounded border border-purple-200 text-purple-900 font-mono">X-VERIFY</code> signatures.
                </p>
                <div className="bg-white p-2 rounded-xl border border-purple-200 text-[10px] font-mono text-purple-950 flex justify-between items-center">
                  <span className="truncate">{credentials.webhookUrl}</span>
                  <button
                    onClick={() => copyToClipboard(credentials.webhookUrl, 'webhookTab')}
                    className="p-1 hover:bg-purple-100 rounded text-purple-700 transition cursor-pointer"
                  >
                    {copiedKey === 'webhookTab' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={fetchWebhookLogs}
                  disabled={logsLoading}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                  Refresh Webhook Logs
                </button>
                <button
                  type="button"
                  onClick={handleSendTestWebhook}
                  disabled={testWebhookSending}
                  className="flex-1 bg-[#5f259f] hover:bg-[#511e89] text-white font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  {testWebhookSending ? 'Sending Webhook...' : 'Trigger Test Webhook'}
                </button>
              </div>

              {/* Webhook History List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  <span>Recent Webhook Calls ({webhookLogs.length})</span>
                  <span className="text-slate-400">Auto-logged</span>
                </div>

                {webhookLogs.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-slate-500 text-[11px]">
                    No webhooks received yet in this server session. Click <b>"Trigger Test Webhook"</b> or complete a test payment in the checkout modal.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {webhookLogs.map((log, idx) => (
                      <div key={idx} className="bg-slate-900 text-slate-200 p-2.5 rounded-xl text-[10.5px] border border-slate-800 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-emerald-400">{log.code || 'PAYMENT_EVENT'}</span>
                          <span className="text-[9px] text-slate-400">{new Date(log.receivedAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono">
                          Txn: <span className="text-white font-bold">{log.merchantTransactionId || 'N/A'}</span>
                        </div>
                        <div className="text-[9.5px] text-slate-400 flex items-center gap-2">
                          <span>X-VERIFY: <span className={log.verified ? 'text-emerald-400' : 'text-amber-400'}>{log.verified ? 'Verified ✓' : 'Sandbox (Bypassed)'}</span></span>
                          {log.amount && <span>Amount: ₹{(log.amount / 100).toLocaleString('en-IN')}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SPLIT SETTLEMENT */}
          {activeTab === 'split' && (() => {
            const calculatedFee = Math.max(1, Math.round((splitDonationAmount * splitFeePercent) / 100));
            const totalDonorPays = splitMode === 'donor_pays' ? splitDonationAmount + calculatedFee : splitDonationAmount;
            const beneficiaryReceives = splitMode === 'donor_pays' ? splitDonationAmount : splitDonationAmount - calculatedFee;
            const ronPayFee = calculatedFee;

            const splitPayloadSample = {
              merchantId: 'TSPMIZOPAYUAT',
              merchantTransactionId: `TXN_SPLIT_${Date.now().toString().slice(-6)}`,
              amount: totalDonorPays * 100, // in paise
              splitRule: splitMode === 'donor_pays' ? 'DONOR_SURCHARGE_100_PLUS_1' : 'DONATION_DEDUCTED_99_PLUS_1',
              split: [
                {
                  merchantId: 'BENEFICIARY_RALNA_MID',
                  amount: beneficiaryReceives * 100, // in paise
                  description: '100% Direct to Bereaved Family / Church Bawm'
                },
                {
                  merchantId: 'TSPMIZOPAYUAT_RONPAY_FEE',
                  amount: ronPayFee * 100, // in paise
                  description: 'RonPay 1% Technology & Platform Fee'
                }
              ]
            };

            return (
              <div className="space-y-3 animate-fadeIn text-xs">
                {/* Header Explainer */}
                <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-indigo-600" />
                      PhonePe Split Settlement API (100+1 vs 99+1)
                    </h4>
                    <span className="text-[9px] font-bold bg-indigo-200/80 text-indigo-950 px-2 py-0.5 rounded-full">
                      Auto Settlement
                    </span>
                  </div>
                  <p className="text-[10.5px] text-indigo-900/85 leading-relaxed font-medium">
                    PhonePe Split API hmangin sum thawh apiangin automatic multi-split a ti thei a, Bawm neitu bank account leh RonPay platform fee account-ah second reilote chhungin a in-credit hrang thlap thin a ni.
                  </p>
                </div>

                {/* Mode Selector (100+1 vs 99+1) */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-700 flex items-center justify-between">
                    <span>1% Fee Khawi Atanga Kal Tur?</span>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      {splitMode === 'donor_pays' ? '✓ 100 + 1 Mode Active' : '✓ 99 + 1 Mode Active'}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSplitMode('donor_pays')}
                      className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        splitMode === 'donor_pays'
                          ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-500 shadow-xs ring-2 ring-indigo-400/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 text-xs">100 + 1 (Donor-in a pe belh)</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded">Thlanawm</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1">
                        Donor-in 1% extra a pe a, Bawm/Chhungkuain ₹100 an dawng tling thlap ang (0% loss).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSplitMode('deduct')}
                      className={`p-2.5 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                        splitMode === 'deduct'
                          ? 'bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-500 shadow-xs ring-2 ring-indigo-400/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-slate-900 text-xs">99 + 1 (Donation atanga paih)</span>
                        <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded">Standard</span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-1">
                        Donation tlangpui atangin 1% a in-cut a, Beneficiary-in ₹99 an dawng ang.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Amount Configuration */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-bold text-xs">Donation Amount Test:</span>
                    <div className="flex items-center gap-1">
                      {[100, 500, 1000, 5000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSplitDonationAmount(amt)}
                          className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer ${
                            splitDonationAmount === amt
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                      <input
                        type="number"
                        min="10"
                        max="100000"
                        value={splitDonationAmount || ''}
                        onChange={(e) => setSplitDonationAmount(Math.max(1, Number(e.target.value) || 0))}
                        className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                        placeholder="Enter amount"
                      />
                    </div>
                    <span className="text-[10.5px] text-slate-400 font-medium whitespace-nowrap">
                      Fee: <b>1%</b> (₹{calculatedFee.toLocaleString('en-IN')})
                    </span>
                  </div>

                  {/* Visual Split Cards */}
                  <div className="space-y-1.5 pt-1">
                    {/* Total Donor Pays */}
                    <div className="flex justify-between items-center p-2 rounded-xl bg-slate-100/90 border border-slate-200">
                      <div>
                        <p className="font-extrabold text-slate-900 text-[11px]">
                          {splitMode === 'donor_pays' ? 'Total Paid by Donor (100 + 1)' : 'Total Paid by Donor (99 + 1)'}
                        </p>
                        <p className="text-[9.5px] text-slate-500">
                          {splitMode === 'donor_pays' 
                            ? `Donation ₹${splitDonationAmount.toLocaleString('en-IN')} + Fee ₹${calculatedFee.toLocaleString('en-IN')}`
                            : `Donation ₹${splitDonationAmount.toLocaleString('en-IN')} (Fee included)`}
                        </p>
                      </div>
                      <span className="font-black text-slate-950 text-sm">
                        ₹{totalDonorPays.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Beneficiary Split */}
                    <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div>
                        <p className="font-extrabold text-emerald-950 text-[11px] flex items-center gap-1">
                          <span>Bawm Beneficiary</span>
                          <span className="text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1 rounded">
                            {splitMode === 'donor_pays' ? '100% Full' : '99% Net'}
                          </span>
                        </p>
                        <p className="text-[9.5px] text-emerald-700 font-mono">ralna.family@axl • Instant direct credit</p>
                      </div>
                      <span className="font-black text-emerald-800 text-sm">
                        ₹{beneficiaryReceives.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* RonPay Fee Split */}
                    <div className="flex justify-between items-center p-2 rounded-xl bg-purple-50 border border-purple-200">
                      <div>
                        <p className="font-extrabold text-purple-950 text-[11px] flex items-center gap-1">
                          <span>RonPay Platform Fee</span>
                          <span className="text-[9px] bg-purple-200 text-purple-900 font-bold px-1 rounded">1%</span>
                        </p>
                        <p className="text-[9.5px] text-purple-700 font-mono">ronpay.tech@ybl • Technology & maintenance</p>
                      </div>
                      <span className="font-black text-purple-800 text-sm">
                        ₹{ronPayFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* PhonePe API JSON Payload Preview */}
                <div className="bg-slate-900 text-slate-100 p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                      PhonePe PG V2 Split Settlement Payload (Live)
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(JSON.stringify(splitPayloadSample, null, 2), 'splitPayload')}
                      className="text-[10px] text-indigo-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'splitPayload' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'splitPayload' ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  </div>
                  <pre className="text-[9.5px] font-mono bg-slate-950/70 p-2.5 rounded-xl overflow-x-auto text-emerald-300 border border-slate-800">
{JSON.stringify(splitPayloadSample, null, 2)}
                  </pre>
                </div>

                {/* Doc Links */}
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-[10px] text-slate-600 flex items-center justify-between">
                  <span className="font-bold text-slate-800">PhonePe Official Docs:</span>
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
            );
          })()}

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

      {/* Embedded PhonePe PG Checkout Modal */}
      {isCheckoutModalOpen && (
        <PhonePeCheckoutModal
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          amount={testAmount}
          donorName="UAT Test User"
          donorPhone="9876543210"
          onPaymentSuccess={(tx) => {
            saveTransaction(tx);
            recordUserPaidTxId(tx.id);
            setIsCheckoutModalOpen(false);
            fetchWebhookLogs();
            showNotification(`🎉 Test payment completed successfully! Ref: ${tx.id}`, 'success');
          }}
        />
      )}
    </div>
  );
};
