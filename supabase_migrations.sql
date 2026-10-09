-- =========================================================================
-- RonPay Platform - Supabase PostgreSQL Database Migration Script
-- Project ID: aqrplcmpealgruduwnhw (mizopay001 / ronpay-app)
-- 
-- Instructions (Mizo):
-- 1. Supabase Dashboard-ah lut la, dinglam menu-a SQL Editor (>_ icon) kha hmet rawh.
-- 2. "New query" hmet la, he SQL script hi paste rawh.
-- 3. "Run" button hmet rawh le. Table mamawh zawng zawng a in-create nghal vek ang.
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. USERS & CREATORS TABLE
-- =========================================================================
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
    role TEXT NOT NULL DEFAULT 'CREATOR', -- SUPER_ADMIN, ADMIN, MODERATOR, CREATOR, MEMBER
    status TEXT NOT NULL DEFAULT 'approved', -- approved, pending, rejected, blocked
    is_approved BOOLEAN NOT NULL DEFAULT true,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    is_phone_verified BOOLEAN NOT NULL DEFAULT true,
    plan TEXT NOT NULL DEFAULT 'standard', -- trial, standard, premium, kumtluang
    subscription_expires_at TIMESTAMPTZ,
    pan_number TEXT,
    avatar_url TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- 2. CAMPAIGNS (BAWM / QR CODES) TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL, -- ralna, khawlsak, rikrum, kumtluang, others
    org_name TEXT,
    target_upi_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, voided, pending_approval
    created_by TEXT NOT NULL, -- user phone or id
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

-- =========================================================================
-- 3. TRANSACTIONS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    campaign_title TEXT,
    category TEXT,
    donor_name TEXT NOT NULL,
    donor_phone TEXT,
    donor_veng TEXT,
    member_id TEXT,
    sub_id TEXT,
    donor_type TEXT DEFAULT 'member', -- member, group, general
    group_name TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    platform_fee NUMERIC(10,2) DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'upi', -- online, cash, upi, bank_transfer, phonepe
    status TEXT NOT NULL DEFAULT 'completed', -- completed, pending, failed, rejected
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

-- Ensure no foreign key locks transactions if parent campaign is queued
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_campaign_id_fkey;

-- =========================================================================
-- 4. WALLETS TABLE (RONPAY DIGITAL WALLET)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.wallets (
    id TEXT PRIMARY KEY, -- wallet_id e.g. "WAL-9862000000"
    user_id TEXT, -- user id or phone number
    upi_handle TEXT NOT NULL, -- e.g. "ronpay.adm@upi"
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

-- =========================================================================
-- 5. WALLET TRANSACTIONS TABLE
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id TEXT PRIMARY KEY,
    wallet_id TEXT NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    title TEXT NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    fee NUMERIC(10,2) DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'completed', -- completed, pending, failed
    source TEXT NOT NULL, -- upi_topup, card_topup, campaign_collection, bank_withdrawal, qr_payment, cashback
    balance_after NUMERIC(12,2),
    reference_no TEXT,
    utr_ref TEXT,
    remark TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- 6. FUND POOLS TABLE (DISTRIBUTED COUNTERS & TOTAL STATS)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.fund_pools (
    id TEXT PRIMARY KEY, -- e.g. 'public_pool', 'ralna', 'kumtluang'
    name TEXT NOT NULL DEFAULT 'RonPay Public Fund Pool',
    total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
    today_count INTEGER NOT NULL DEFAULT 0 CHECK (today_count >= 0),
    active_qrs_count INTEGER NOT NULL DEFAULT 0 CHECK (active_qrs_count >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- 7. MEMBERS TABLE (KUMTLUANG / KOHHRAN / PAWL ROLL LIST)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.members (
    id TEXT PRIMARY KEY, -- e.g. "BMPSHL-001", "EBE-1460"
    campaign_id TEXT NOT NULL,
    name TEXT NOT NULL,
    father_name TEXT,
    org_code TEXT,
    phone TEXT,
    full_phone TEXT,
    phone_last4 TEXT,
    section TEXT,
    is_family_head BOOLEAN DEFAULT false,
    pledge_amount NUMERIC(12,2) DEFAULT 0.00,
    paid_amount NUMERIC(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'pending',
    dependents JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- =========================================================================
-- INDEXES FOR FAST PERFORMANCE
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

CREATE INDEX IF NOT EXISTS idx_campaigns_created_by ON public.campaigns(created_by);
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON public.campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(status);

CREATE INDEX IF NOT EXISTS idx_transactions_campaign_id ON public.transactions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON public.transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_donor_phone ON public.transactions(donor_phone);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_id ON public.wallet_transactions(wallet_id);

-- =========================================================================
-- AUTOMATIC updated_at TIMESTAMP TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON public.users;
CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER set_campaigns_updated_at
    BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_transactions_updated_at ON public.transactions;
CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_wallets_updated_at ON public.wallets;
CREATE TRIGGER set_wallets_updated_at
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =========================================================================
-- AUTOMATIC FUND POOL RECALIBRATION TRIGGER
-- =========================================================================
CREATE OR REPLACE FUNCTION public.recalibrate_fund_pools_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_total_amt NUMERIC(14,2);
    v_total_cnt INTEGER;
    v_today_cnt INTEGER;
    v_today_str TEXT;
BEGIN
    v_today_str := to_char(timezone('utc'::text, now()), 'YYYY-MM-DD');

    SELECT 
        COALESCE(SUM(amount), 0),
        COUNT(*),
        COUNT(*) FILTER (WHERE to_char(timestamp, 'YYYY-MM-DD') = v_today_str)
    INTO 
        v_total_amt, 
        v_total_cnt, 
        v_today_cnt
    FROM public.transactions
    WHERE status IN ('completed', 'SUCCESS', 'COMPLETED', 'paid', 'verified');

    INSERT INTO public.fund_pools (id, name, total_amount, total_count, today_count, last_updated)
    VALUES ('public_pool', 'RonPay Public Fund Pool', v_total_amt, v_total_cnt, v_today_cnt, timezone('utc'::text, now()))
    ON CONFLICT (id) DO UPDATE SET
        total_amount = EXCLUDED.total_amount,
        total_count = EXCLUDED.total_count,
        today_count = EXCLUDED.today_count,
        last_updated = timezone('utc'::text, now());

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalibrate_fund_pools ON public.transactions;
CREATE TRIGGER trg_recalibrate_fund_pools
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH STATEMENT EXECUTE FUNCTION public.recalibrate_fund_pools_trigger();

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fund_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active campaigns and public pool stats
CREATE POLICY "Public Read Campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Public Read Fund Pools" ON public.fund_pools FOR SELECT USING (true);
CREATE POLICY "Public Read Transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Public Read Users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Read Wallets" ON public.wallets FOR SELECT USING (true);
CREATE POLICY "Public Read Wallet Transactions" ON public.wallet_transactions FOR SELECT USING (true);
CREATE POLICY "Public Read Members" ON public.members FOR SELECT USING (true);

-- Permissive write policies for anon key (client app interactions)
CREATE POLICY "Anon Insert Transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon Update Transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Anon Delete Transactions" ON public.transactions FOR DELETE USING (true);

CREATE POLICY "Anon Upsert Users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Wallets" ON public.wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Fund Pools" ON public.fund_pools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Wallet Txns" ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Anon Upsert Members" ON public.members FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- SEED INITIAL DATA: RONPAY PUBLIC FUND POOL (39 TXNS / ₹262,125.90)
-- =========================================================================
INSERT INTO public.fund_pools (id, name, total_amount, total_count, today_count, active_qrs_count, currency)
VALUES ('public_pool', 'RonPay Public Fund Pool', 262125.90, 39, 0, 4, 'INR')
ON CONFLICT (id) DO UPDATE SET
    total_amount = EXCLUDED.total_amount,
    total_count = EXCLUDED.total_count,
    last_updated = timezone('utc'::text, now());

-- Enable Realtime for live cross-device synchronization
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.fund_pools;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;
    EXCEPTION
        WHEN others THEN
            NULL; -- In case publication does not exist or already added
    END;
END $$;
