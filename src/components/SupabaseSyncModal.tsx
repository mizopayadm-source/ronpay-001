import React, { useState, useEffect } from 'react';
import { 
  Database, 
  X, 
  Check, 
  Copy, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Key, 
  UploadCloud, 
  Server,
  Layers,
  Table,
  HelpCircle
} from 'lucide-react';
import { 
  getSupabaseUrl, 
  getSupabaseAnonKey, 
  setSupabaseConfig, 
  isSupabaseConfigured,
  DEFAULT_SUPABASE_PROJECT_ID,
  DEFAULT_SUPABASE_URL
} from '../lib/supabase';
import { 
  checkSupabaseHealth, 
  syncAllLocalToSupabase, 
  SupabaseHealthCheckResult 
} from '../services/supabaseService';

interface SupabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseSyncModal: React.FC<SupabaseSyncModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [anonKey, setAnonKey] = useState<string>(() => getSupabaseAnonKey());
  const [url, setUrl] = useState<string>(() => getSupabaseUrl());
  const [copiedSQL, setCopiedSQL] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [healthResult, setHealthResult] = useState<SupabaseHealthCheckResult | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'sql' | 'settings'>('status');

  const sqlMigrationCode = `-- =========================================================================
-- RonPay Platform - Supabase PostgreSQL Database Migration Script
-- Project ID: aqrplcmpealgruduwnhw (mizopay001 / ronpay-app)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    designation TEXT,
    org_name TEXT,
    location TEXT,
    upi_id TEXT,
    target_upi_id TEXT,
    category TEXT DEFAULT 'ralna',
    role TEXT NOT NULL DEFAULT 'CREATOR',
    status TEXT NOT NULL DEFAULT 'approved',
    is_approved BOOLEAN NOT NULL DEFAULT true,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    is_phone_verified BOOLEAN NOT NULL DEFAULT true,
    plan TEXT NOT NULL DEFAULT 'standard',
    avatar_url TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. CAMPAIGNS TABLE (BAWM / QR)
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    org_name TEXT,
    target_upi_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_by TEXT NOT NULL,
    created_by_name TEXT,
    custom_amount NUMERIC(12,2),
    location TEXT,
    description TEXT,
    image_url TEXT,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    allow_public_group_deposits BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 3. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    campaign_title TEXT,
    category TEXT,
    donor_name TEXT NOT NULL,
    donor_phone TEXT,
    donor_veng TEXT,
    member_id TEXT,
    sub_id TEXT,
    donor_type TEXT DEFAULT 'member',
    group_name TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    platform_fee NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'upi',
    status TEXT NOT NULL DEFAULT 'completed',
    remark TEXT,
    period_type TEXT DEFAULT 'one_time',
    period_month TEXT,
    period_year TEXT,
    period_label TEXT,
    utr TEXT,
    reference_no TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4. WALLETS TABLE
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    upi_handle TEXT NOT NULL,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    pending_payouts NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_credited NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    linked_bank_name TEXT,
    linked_account_last4 TEXT,
    linked_upi_id TEXT,
    is_kyc_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 5. WALLET TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(10,2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'completed',
    source TEXT NOT NULL,
    balance_after NUMERIC(12,2),
    reference_no TEXT,
    utr_ref TEXT,
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 6. FUND POOLS TABLE
CREATE TABLE IF NOT EXISTS public.fund_pools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'RonPay Public Fund Pool',
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    today_count INTEGER NOT NULL DEFAULT 0 CHECK (today_count >= 0),
    active_qrs_count INTEGER NOT NULL DEFAULT 0 CHECK (active_qrs_count >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON public.transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);

-- RLS POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_pools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read All" ON public.fund_pools FOR SELECT USING (true);
CREATE POLICY "Public Read Txns" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Public Read Camps" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Public Read Users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Read Wallets" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Public Read Wallet Txns" ON public.wallet_transactions FOR SELECT USING (true);

CREATE POLICY "Anon Insert Txns" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon Update Txns" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Anon Delete Txns" ON public.transactions FOR DELETE USING (true);

CREATE POLICY "Anon Upsert Users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Camps" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert FundPools" ON public.fund_pools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert WalletTxns" ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);

-- SEED INITIAL FUND POOL (Txns 39 / ₹262,125.90)
INSERT INTO public.fund_pools (id, name, total_amount, total_count, today_count, active_qrs_count, currency)
VALUES ('public_pool', 'RonPay Public Fund Pool', 262125.90, 39, 0, 4, 'INR')
ON CONFLICT (id) DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    total_count = EXCLUDED.total_count,
    last_updated = timezone('utc'::text, now());
`;

  useEffect(() => {
    if (isOpen) {
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsChecking(true);
    try {
      const res = await checkSupabaseHealth();
      setHealthResult(res);
    } catch {
      // Ignore
    } finally {
      setIsChecking(false);
    }
  };

  const handleSaveConfig = () => {
    setSupabaseConfig(url, anonKey);
    setSyncStatus('Configuration saved successfully!');
    setTimeout(() => setSyncStatus(null), 3000);
    handleTestConnection();
  };

  const handleCopySQL = async () => {
    try {
      await navigator.clipboard.writeText(sqlMigrationCode);
      setCopiedSQL(true);
      setTimeout(() => setCopiedSQL(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    setSyncStatus(null);
    try {
      const res = await syncAllLocalToSupabase();
      if (res.success) {
        setSyncStatus(`Sync Successful! ${res.transactionsSynced} Transactions, ${res.campaignsSynced} Bawms, ${res.usersSynced} Users uploaded.`);
        handleTestConnection();
      } else {
        setSyncStatus(`Sync Failed: ${res.error || 'Check that tables exist in Supabase.'}`);
      }
    } catch (err: any) {
      setSyncStatus(`Sync Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 via-slate-900 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-emerald-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center justify-center shadow-inner">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white">Supabase PostgREST Database</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-400/30">
                  {DEFAULT_SUPABASE_PROJECT_ID}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                PostgreSQL schema, PostgREST SDK client & table sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'status' 
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Tables & Health</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sql' 
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>SQL Migration Script</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'settings' 
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>API Credentials</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800 text-xs">
          
          {syncStatus && (
            <div className={`p-3 rounded-2xl border flex items-center gap-2 font-medium ${
              syncStatus.includes('Successful') || syncStatus.includes('saved')
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                : 'bg-amber-50 text-amber-900 border-amber-200'
            }`}>
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{syncStatus}</span>
            </div>
          )}

          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Connection Status Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full animate-pulse ${healthResult?.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {healthResult?.connected ? 'Supabase Project Connected' : 'Connection Standby'}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {healthResult?.url || DEFAULT_SUPABASE_URL}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isChecking}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>Check Again</span>
                  </button>

                  <a
                    href="https://supabase.com/dashboard/project/aqrplcmpealgruduwnhw/editor"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <span>Supabase Editor</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Status Message */}
              {healthResult && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Status: </span>
                    <span>{healthResult.message}</span>
                    {healthResult.latencyMs > 0 && (
                      <span className="ml-2 font-mono text-[10px] text-indigo-600">({healthResult.latencyMs}ms)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Required Tables Status */}
              <div>
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-slate-500" />
                  <span>PostgreSQL Tables (users, transactions, wallets, fund_pools)</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: 'users', label: 'Users & Creators (users)', desc: 'Store app creators, members, and roles' },
                    { key: 'transactions', label: 'Transactions (transactions)', desc: 'Donation records with amounts, categories & UTR' },
                    { key: 'wallets', label: 'Digital Wallets (wallets)', desc: 'RonPay creator balances and UPI handles' },
                    { key: 'fund_pools', label: 'Fund Pools (fund_pools)', desc: 'Live counters (Txns 39 / ₹262,125.90)' },
                    { key: 'campaigns', label: 'Campaigns / QRs (campaigns)', desc: 'Active causes & target UPI codes' },
                    { key: 'wallet_transactions', label: 'Wallet History (wallet_transactions)', desc: 'Credit & debit ledger history' }
                  ].map((tbl) => {
                    const status = healthResult?.tables?.[tbl.key];
                    const exists = status?.exists;
                    return (
                      <div 
                        key={tbl.key}
                        className={`p-3 rounded-2xl border transition-all ${
                          exists 
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950' 
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">{tbl.label}</span>
                          {exists ? (
                            <span className="bg-emerald-200/70 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{status.rowCount} Rows</span>
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>Pending Migration</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">{tbl.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Data Sync Button */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleSyncData}
                  disabled={isSyncing || !healthResult?.connected}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold px-4 py-3 rounded-2xl flex items-center justify-center gap-2 transition cursor-pointer shadow-md active:scale-98 disabled:opacity-50"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                  <span>{isSyncing ? 'Uploading to Supabase...' : 'Sync Current Local Records to Supabase'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-xs">A Tih Dan (Step-by-step in Mizo):</h4>
                  <ol className="list-decimal list-inside space-y-1 mt-1 text-[11px] text-amber-900">
                    <li>Hnuai a <strong>"Copy SQL Migration Script"</strong> button hi hmet rawh.</li>
                    <li>Supabase Dashboard-ah lut la, dinglam menu-a <strong>SQL Editor (&gt;_ icon)</strong> kha thlang rawh.</li>
                    <li><strong>"New query"</strong> hmet la, he script copy hi paste-in <strong>"Run"</strong> hmet tawp rawh le.</li>
                    <li>Table 6 (`users`, `transactions`, `wallets`, `fund_pools`, `campaigns`, `wallet_transactions`) an in-create vek ang.</li>
                  </ol>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-700">Supabase SQL Editor Code:</span>
                <button
                  type="button"
                  onClick={handleCopySQL}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                >
                  {copiedSQL ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL Migration Script</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative">
                <pre className="w-full max-h-72 bg-slate-900 text-emerald-400 p-3.5 rounded-2xl text-[10px] font-mono overflow-auto border border-slate-800 leading-relaxed">
                  {sqlMigrationCode}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-emerald-600" />
                  <span>Supabase Credentials</span>
                </h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://aqrplcmpealgruduwnhw.supabase.co"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Default project ref: {DEFAULT_SUPABASE_PROJECT_ID}
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Supabase Anon Public API Key (sb_publishable_... or JWT)
                  </label>
                  <input
                    type="password"
                    value={anonKey}
                    onChange={(e) => setAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Supabase Dashboard &gt; Project Settings &gt; API &gt; Project API keys (anon public)
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Test Credentials</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-500">
            PostgREST SDK Client ready for users, transactions, wallets & fund_pools
          </span>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-1.5 rounded-xl text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
