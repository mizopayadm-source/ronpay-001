import { getSupabase, isSupabaseConfigured, getSupabaseUrl } from '../lib/supabase';
export { isSupabaseConfigured } from '../lib/supabase';
import { Transaction, CreatorProfile, RonPayWallet, WalletTransaction, PublicPoolStats, Campaign, MemberRecord } from '../types';
import { getStoredTransactions, getStoredCreatorsList, getStoredWallet, getStoredCampaigns, getMembers } from '../utils/storage';
import { getStoredPublicPoolStats } from './firestoreSync';

export interface SupabaseTableStatus {
  tableName: string;
  exists: boolean;
  rowCount: number;
  error?: string;
}

export interface SupabaseHealthCheckResult {
  connected: boolean;
  url: string;
  latencyMs: number;
  tables: Record<string, SupabaseTableStatus>;
  message: string;
}

// ---------------------------------------------------------------------------
// 1. USERS & CREATORS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseUsers(): Promise<CreatorProfile[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] Failed to fetch users:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    phone: row.phone,
    name: row.name,
    designation: row.designation,
    orgName: row.org_name,
    location: row.location,
    upiId: row.upi_id,
    targetUpiId: row.target_upi_id,
    category: row.category,
    role: row.role,
    status: row.status,
    isApproved: row.is_approved,
    isAdmin: row.is_admin,
    isPhoneVerified: row.is_phone_verified,
    plan: row.plan,
    avatarUrl: row.avatar_url,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.metadata || {})
  }));
}

export async function fetchSupabaseUserByPhone(phone: string): Promise<CreatorProfile | null> {
  const supabase = getSupabase();
  if (!supabase || !phone) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    phone: data.phone,
    name: data.name,
    designation: data.designation,
    orgName: data.org_name,
    location: data.location,
    upiId: data.upi_id,
    targetUpiId: data.target_upi_id,
    category: data.category,
    role: data.role,
    status: data.status,
    isApproved: data.is_approved,
    isAdmin: data.is_admin,
    isPhoneVerified: data.is_phone_verified,
    plan: data.plan,
    avatarUrl: data.avatar_url,
    logoUrl: data.logo_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    ...(data.metadata || {})
  };
}

export async function upsertSupabaseUser(user: CreatorProfile): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !user || !user.phone) return false;

  const row = {
    id: user.id || `usr-${user.phone}`,
    phone: user.phone,
    name: user.name || 'RonPay User',
    designation: user.designation || null,
    org_name: user.orgName || null,
    location: user.location || null,
    upi_id: user.upiId || null,
    target_upi_id: user.targetUpiId || null,
    category: user.category || 'ralna',
    role: user.role || (user.isAdmin ? 'ADMIN' : 'CREATOR'),
    status: user.status || 'approved',
    is_approved: user.isApproved ?? true,
    is_admin: user.isAdmin ?? false,
    is_phone_verified: user.isPhoneVerified ?? true,
    plan: user.plan || 'standard',
    avatar_url: user.avatarUrl || null,
    logo_url: user.logoUrl || null,
    metadata: {
      address: user.address,
      panNumber: user.panNumber,
      allowedCategories: user.allowedCategories,
    }
  };

  const { error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'phone' });

  if (error) {
    console.error('[Supabase] Error upserting user:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 2. TRANSACTIONS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseTransactions(campaignId?: string): Promise<Transaction[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase
    .from('transactions')
    .select('*')
    .order('timestamp', { ascending: false });

  if (campaignId && campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[Supabase] Failed to fetch transactions:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    category: row.category,
    donorName: row.donor_name,
    donorPhone: row.donor_phone,
    donorVeng: row.donor_veng,
    memberId: row.member_id,
    subId: row.sub_id,
    donorType: row.donor_type,
    groupName: row.group_name,
    isAnonymous: row.is_anonymous,
    amount: Number(row.amount) || 0,
    platformFee: Number(row.platform_fee) || 0,
    totalAmount: Number(row.total_amount) || Number(row.amount) || 0,
    paymentMethod: row.payment_method,
    status: row.status,
    remark: row.remark,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    periodLabel: row.period_label,
    utr: row.utr,
    referenceNo: row.reference_no,
    timestamp: row.timestamp || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.metadata || {})
  }));
}

// Debounced pool recalibration to prevent main-thread freezing and API flooding
let poolRecalibrateDebounceTimer: any = null;
export function scheduleDebouncedPoolRecalibration(): void {
  if (poolRecalibrateDebounceTimer) {
    clearTimeout(poolRecalibrateDebounceTimer);
  }
  poolRecalibrateDebounceTimer = setTimeout(() => {
    recalibrateSupabaseFundPool().catch(() => {});
  }, 3500);
}

export async function insertSupabaseTransaction(tx: Transaction): Promise<boolean> {
  if (!tx || !tx.id) return false;

  const supabase = getSupabase();
  if (!supabase) {
    // Queue for automatic synchronization when Supabase credentials connect
    try {
      const qRaw = localStorage.getItem('ronpay_supabase_pending_txs');
      const q: Record<string, Transaction> = qRaw ? JSON.parse(qRaw) : {};
      q[tx.id] = tx;
      localStorage.setItem('ronpay_supabase_pending_txs', JSON.stringify(q));
    } catch {}
    return false;
  }

  // 1. Ensure parent campaign row exists to prevent any foreign key constraint issues
  if (tx.campaignId) {
    try {
      const campRow = {
        id: tx.campaignId,
        title: tx.campaignTitle || 'RonPay Community Bawm',
        category: tx.category || 'ralna',
        target_upi_id: 'ronpay@upi',
        status: 'active',
        created_by: 'system',
        is_approved: true,
        allow_public_group_deposits: true,
        created_at: tx.timestamp || new Date().toISOString()
      };
      await supabase.from('campaigns').upsert(campRow, { onConflict: 'id', ignoreDuplicates: true });
    } catch (cErr) {
      // Ignore if campaigns table doesn't enforce strict FK
    }
  }

  // 2. Prepare canonical transaction row
  const row = {
    id: tx.id,
    campaign_id: tx.campaignId || 'cmp-default',
    campaign_title: tx.campaignTitle || 'RonPay Community Cause',
    category: tx.category || 'ralna',
    donor_name: tx.donorName || (tx.isAnonymous ? 'Anonymous' : 'Valued Donor'),
    donor_phone: tx.donorPhone || null,
    donor_veng: tx.donorVeng || null,
    member_id: tx.memberId || null,
    sub_id: tx.subId || null,
    donor_type: tx.donorType || 'member',
    group_name: tx.groupName || null,
    is_anonymous: Boolean(tx.isAnonymous),
    amount: Number(tx.amount) || 0,
    platform_fee: Number(tx.platformFee) || 0,
    total_amount: Number(tx.totalAmount) || Number(tx.amount) || 0,
    payment_method: tx.paymentMethod || 'upi',
    status: tx.status || 'completed',
    remark: tx.remark || null,
    period_type: tx.periodType || 'one_time',
    period_month: tx.periodMonth || null,
    period_year: tx.periodYear || null,
    period_label: tx.periodLabel || null,
    utr: tx.utr || null,
    reference_no: tx.referenceNo || tx.utr || null,
    timestamp: tx.timestamp || tx.createdAt || new Date().toISOString(),
    created_at: tx.createdAt || tx.timestamp || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      subCategoryBreakdown: tx.subCategoryBreakdown,
      feeOption: tx.feeOption,
      payerUPI: tx.payerUPI,
      txHash: tx.txHash,
    }
  };

  const { error } = await supabase
    .from('transactions')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Error inserting transaction:', error.message);
    // Queue on failure
    try {
      const qRaw = localStorage.getItem('ronpay_supabase_pending_txs');
      const q: Record<string, Transaction> = qRaw ? JSON.parse(qRaw) : {};
      q[tx.id] = tx;
      localStorage.setItem('ronpay_supabase_pending_txs', JSON.stringify(q));
    } catch {}
    return false;
  }

  // Remove from pending queue if present
  try {
    const qRaw = localStorage.getItem('ronpay_supabase_pending_txs');
    if (qRaw) {
      const q: Record<string, Transaction> = JSON.parse(qRaw);
      if (q[tx.id]) {
        delete q[tx.id];
        localStorage.setItem('ronpay_supabase_pending_txs', JSON.stringify(q));
      }
    }
  } catch {}

  // Recalibrate fund pool with safe debouncing
  scheduleDebouncedPoolRecalibration();
  return true;
}

export async function updateSupabaseTransaction(tx: Partial<Transaction> & { id: string }): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !tx.id) return false;

  const updateFields: Record<string, any> = {};
  if (tx.status !== undefined) updateFields.status = tx.status;
  if (tx.amount !== undefined) updateFields.amount = Number(tx.amount);
  if (tx.donorName !== undefined) updateFields.donor_name = tx.donorName;
  if (tx.donorPhone !== undefined) updateFields.donor_phone = tx.donorPhone;
  if (tx.donorVeng !== undefined) updateFields.donor_veng = tx.donorVeng;
  if (tx.remark !== undefined) updateFields.remark = tx.remark;
  if (tx.utr !== undefined) updateFields.utr = tx.utr;

  const { error } = await supabase
    .from('transactions')
    .update(updateFields)
    .eq('id', tx.id);

  if (error) {
    console.error('[Supabase] Error updating transaction:', error.message);
    return false;
  }

  scheduleDebouncedPoolRecalibration();
  return true;
}

export async function deleteSupabaseTransaction(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !id) return false;

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Supabase] Error deleting transaction:', error.message);
    return false;
  }

  scheduleDebouncedPoolRecalibration();
  return true;
}

export async function deleteMultipleSupabaseTransactions(ids: string[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !ids || ids.length === 0) return false;

  const { error } = await supabase
    .from('transactions')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('[Supabase] Error deleting multiple transactions:', error.message);
    return false;
  }

  scheduleDebouncedPoolRecalibration();
  return true;
}

// ---------------------------------------------------------------------------
// 3. WALLETS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseWallet(userIdOrWalletId: string): Promise<RonPayWallet | null> {
  const supabase = getSupabase();
  if (!supabase || !userIdOrWalletId) return null;

  const { data, error } = await supabase
    .from('wallets')
    .select('*, wallet_transactions(*)')
    .or(`id.eq.${userIdOrWalletId},user_id.eq.${userIdOrWalletId}`)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const history: WalletTransaction[] = Array.isArray(data.wallet_transactions)
    ? data.wallet_transactions.map((t: any) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        amount: Number(t.amount) || 0,
        fee: Number(t.fee) || 0,
        status: t.status,
        source: t.source,
        timestamp: t.created_at,
        referenceNo: t.reference_no,
        utrRef: t.utr_ref,
        remark: t.remark,
        balanceAfter: Number(t.balance_after) || 0,
      }))
    : [];

  return {
    walletId: data.id,
    upiHandle: data.upi_handle,
    balance: Number(data.balance) || 0,
    pendingPayouts: Number(data.pending_payouts) || 0,
    totalCredited: Number(data.total_credited) || 0,
    totalWithdrawn: Number(data.total_withdrawn) || 0,
    linkedBankName: data.linked_bank_name,
    linkedAccountLast4: data.linked_account_last4,
    linkedUpiId: data.linked_upi_id,
    isKycVerified: Boolean(data.is_kyc_verified),
    history,
  };
}

export async function upsertSupabaseWallet(wallet: RonPayWallet, userId?: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !wallet || !wallet.walletId) return false;

  const row = {
    id: wallet.walletId,
    user_id: userId || 'ronpay_user',
    upi_handle: wallet.upiHandle || 'ronpay@upi',
    balance: Math.max(0, Number(wallet.balance) || 0),
    pending_payouts: Math.max(0, Number(wallet.pendingPayouts) || 0),
    total_credited: Math.max(0, Number(wallet.totalCredited) || 0),
    total_withdrawn: Math.max(0, Number(wallet.totalWithdrawn) || 0),
    linked_bank_name: wallet.linkedBankName || null,
    linked_account_last4: wallet.linkedAccountLast4 || null,
    linked_upi_id: wallet.linkedUpiId || null,
    is_kyc_verified: Boolean(wallet.isKycVerified),
  };

  const { error } = await supabase
    .from('wallets')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Error upserting wallet:', error.message);
    return false;
  }
  return true;
}

export async function updateSupabaseWalletBalance(
  walletId: string, 
  delta: number, 
  title: string, 
  source: WalletTransaction['source'] = 'campaign_collection'
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !walletId) return false;

  // Fetch current
  const { data: currentWallet, error: fetchErr } = await supabase
    .from('wallets')
    .select('balance, total_credited, total_withdrawn')
    .eq('id', walletId)
    .single();

  if (fetchErr || !currentWallet) return false;

  const currentBal = Number(currentWallet.balance) || 0;
  const newBal = Math.max(0, currentBal + delta);
  const isCredit = delta >= 0;

  const updateRow: Record<string, any> = {
    balance: newBal,
    ...(isCredit 
      ? { total_credited: (Number(currentWallet.total_credited) || 0) + delta } 
      : { total_withdrawn: (Number(currentWallet.total_withdrawn) || 0) + Math.abs(delta) })
  };

  const { error: updateErr } = await supabase
    .from('wallets')
    .update(updateRow)
    .eq('id', walletId);

  if (updateErr) return false;

  // Insert wallet transaction record
  const txnRow = {
    id: `wtx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    wallet_id: walletId,
    type: isCredit ? 'credit' : 'debit',
    title,
    amount: Math.abs(delta),
    status: 'completed',
    source,
    balance_after: newBal,
  };

  await supabase.from('wallet_transactions').insert(txnRow);
  return true;
}

// ---------------------------------------------------------------------------
// 4. FUND POOLS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseFundPool(poolId: string = 'public_pool'): Promise<PublicPoolStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('fund_pools')
    .select('*')
    .eq('id', poolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    totalAmount: Math.max(0, Number(data.total_amount) || 0),
    totalCount: Math.max(0, Number(data.total_count) || 0),
    todayCount: Math.max(0, Number(data.today_count) || 0),
    lastUpdated: data.last_updated,
  };
}

export async function upsertSupabaseFundPool(stats: PublicPoolStats, poolId: string = 'public_pool'): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  const row = {
    id: poolId,
    name: 'RonPay Public Fund Pool',
    total_amount: Math.max(0, Math.round((Number(stats.totalAmount) || 0) * 100) / 100),
    total_count: Math.max(0, Number(stats.totalCount) || 0),
    today_count: Math.max(0, Number(stats.todayCount) || 0),
    last_updated: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('fund_pools')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Error upserting fund pool:', error.message);
    return false;
  }
  return true;
}

/**
 * Re-calculates fund_pools stats strictly from confirmed rows in the transactions table
 */
export async function recalibrateSupabaseFundPool(poolId: string = 'public_pool'): Promise<PublicPoolStats | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('amount, status, timestamp, created_at')
    .in('status', ['completed', 'SUCCESS', 'COMPLETED', 'paid', 'verified']);

  if (error) {
    console.warn('[Supabase] Recalibration failed to query transactions:', error.message);
    return null;
  }

  let totalAmt = 0;
  let totalCnt = 0;
  let todayCnt = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  (txns || []).forEach((t: any) => {
    const amt = Number(t.amount) || 0;
    if (amt > 0) {
      totalAmt += amt;
      totalCnt += 1;
      const d = String(t.timestamp || t.created_at || '').slice(0, 10);
      if (d === todayStr) {
        todayCnt += 1;
      }
    }
  });

  const freshStats: PublicPoolStats = {
    totalAmount: Math.max(0, Math.round(totalAmt * 100) / 100),
    totalCount: Math.max(0, totalCnt),
    todayCount: Math.max(0, todayCnt),
    lastUpdated: new Date().toISOString(),
  };

  await upsertSupabaseFundPool(freshStats, poolId);
  return freshStats;
}

// ---------------------------------------------------------------------------
// 5. CAMPAIGNS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseCampaigns(): Promise<Campaign[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[Supabase] Failed to fetch campaigns:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    orgName: row.org_name,
    targetUpiId: row.target_upi_id,
    status: row.status,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    customAmount: row.custom_amount ? Number(row.custom_amount) : undefined,
    location: row.location,
    description: row.description,
    imageUrl: row.image_url,
    isApproved: row.is_approved,
    allowPublicGroupDeposits: row.allow_public_group_deposits,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.metadata || {})
  }));
}

export async function upsertSupabaseCampaign(camp: Campaign): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !camp || !camp.id) return false;

  const row = {
    id: camp.id,
    title: camp.title || 'RonPay Bawm',
    category: camp.category || 'ralna',
    org_name: camp.orgName || null,
    target_upi_id: camp.targetUpiId || 'ronpay@upi',
    status: camp.status || 'active',
    created_by: camp.createdBy || 'ronpay_admin',
    created_by_name: (camp as any).createdByName || null,
    custom_amount: camp.customAmount ? Number(camp.customAmount) : null,
    location: camp.location || null,
    description: camp.description || null,
    image_url: camp.imageUrl || null,
    is_approved: camp.isApproved ?? true,
    allow_public_group_deposits: camp.allowPublicGroupDeposits ?? true,
    metadata: {
      officerPasscode: camp.officerPasscode,
      authorizedOfficers: camp.authorizedOfficers,
      expenseHeads: camp.expenseHeads,
    }
  };

  const { error } = await supabase
    .from('campaigns')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.error('[Supabase] Error upserting campaign:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 6. HEALTH CHECK & TABLES VERIFICATION
// ---------------------------------------------------------------------------

export async function checkSupabaseHealth(): Promise<SupabaseHealthCheckResult> {
  const url = getSupabaseUrl();
  const startTime = Date.now();
  const supabase = getSupabase();

  const tablesToCheck = ['users', 'campaigns', 'transactions', 'members', 'wallets', 'fund_pools', 'wallet_transactions'];
  const tableResults: Record<string, SupabaseTableStatus> = {};

  if (!supabase || !isSupabaseConfigured()) {
    tablesToCheck.forEach(t => {
      tableResults[t] = { tableName: t, exists: false, rowCount: 0, error: 'Anon key not configured' };
    });
    return {
      connected: false,
      url,
      latencyMs: 0,
      tables: tableResults,
      message: 'Supabase Anon Key is missing. Paste your Anon Key to connect.',
    };
  }

  let connected = false;

  try {
    // Check fund_pools table
    const { data, error, count } = await supabase
      .from('fund_pools')
      .select('id', { count: 'exact', head: true });

    connected = !error || !error.message.includes('FetchError');
  } catch (err: any) {
    connected = false;
  }

  // Check each table individually
  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        tableResults[tableName] = {
          tableName,
          exists: false,
          rowCount: 0,
          error: error.message,
        };
      } else {
        tableResults[tableName] = {
          tableName,
          exists: true,
          rowCount: count || 0,
        };
      }
    } catch (err: any) {
      tableResults[tableName] = {
        tableName,
        exists: false,
        rowCount: 0,
        error: err.message || 'Check failed',
      };
    }
  }

  const latencyMs = Date.now() - startTime;
  const existingCount = Object.values(tableResults).filter(t => t.exists).length;

  return {
    connected,
    url,
    latencyMs,
    tables: tableResults,
    message: existingCount === tablesToCheck.length
      ? `Supabase project connected! All ${existingCount} tables are ready in PostgreSQL.`
      : existingCount > 0
        ? `Connected, but only ${existingCount}/${tablesToCheck.length} tables found. Run the SQL migration script.`
        : `Connected to Supabase, but no tables found yet. Please run the SQL migration script in SQL Editor.`,
  };
}

// ---------------------------------------------------------------------------
// 7. BULK SYNC / MIGRATE LOCAL TO SUPABASE
// ---------------------------------------------------------------------------

export async function syncAllLocalToSupabase(): Promise<{
  success: boolean;
  usersSynced: number;
  campaignsSynced: number;
  transactionsSynced: number;
  walletsSynced: number;
  membersSynced?: number;
  poolSynced: boolean;
  error?: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, usersSynced: 0, campaignsSynced: 0, transactionsSynced: 0, walletsSynced: 0, poolSynced: false, error: 'Supabase not configured' };
  }

  try {
    // 1. Sync Users
    const localUsers = getStoredCreatorsList();
    let usersSynced = 0;
    for (const u of localUsers) {
      const ok = await upsertSupabaseUser(u);
      if (ok) usersSynced++;
    }

    // 2. Sync Campaigns
    const localCamps = getStoredCampaigns();
    let campaignsSynced = 0;
    for (const c of localCamps) {
      const ok = await upsertSupabaseCampaign(c);
      if (ok) campaignsSynced++;
    }

    // 3. Sync Transactions
    const localTxns = getStoredTransactions();
    let transactionsSynced = 0;
    for (const t of localTxns) {
      const ok = await insertSupabaseTransaction(t);
      if (ok) transactionsSynced++;
    }

    // 4. Sync Wallet
    const localWallet = getStoredWallet();
    let walletsSynced = 0;
    if (localWallet) {
      const ok = await upsertSupabaseWallet(localWallet);
      if (ok) walletsSynced = 1;
    }

    // 5. Sync Fund Pool
    const localPool = getStoredPublicPoolStats();
    const poolSynced = await upsertSupabaseFundPool(localPool, 'public_pool');

    // 6. Sync Members
    const localMembers = getMembers();
    let membersSynced = 0;
    for (const m of localMembers) {
      const ok = await upsertSupabaseMember(m);
      if (ok) membersSynced++;
    }

    return {
      success: true,
      usersSynced,
      campaignsSynced,
      transactionsSynced,
      walletsSynced,
      poolSynced,
      membersSynced,
    };
  } catch (err: any) {
    return {
      success: false,
      usersSynced: 0,
      campaignsSynced: 0,
      transactionsSynced: 0,
      walletsSynced: 0,
      membersSynced: 0,
      poolSynced: false,
      error: err.message || 'Sync failed',
    };
  }
}

/**
 * Specifically synchronizes all local transactions directly to Supabase transactions table
 * and processes any offline queued items
 */
export async function syncPendingTransactionsToSupabase(): Promise<{
  total: number;
  synced: number;
  failed: number;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { total: 0, synced: 0, failed: 0 };
  }

  const allTxns = getStoredTransactions();
  if (!allTxns || allTxns.length === 0) {
    return { total: 0, synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;

  // Batch in chunks of 50 in single network requests
  const CHUNK_SIZE = 50;
  for (let i = 0; i < allTxns.length; i += CHUNK_SIZE) {
    const chunk = allTxns.slice(i, i + CHUNK_SIZE);
    const rows = chunk.map(tx => ({
      id: tx.id,
      campaign_id: tx.campaignId || 'cmp-default',
      campaign_title: tx.campaignTitle || 'RonPay Community Cause',
      category: tx.category || 'ralna',
      donor_name: tx.donorName || (tx.isAnonymous ? 'Anonymous' : 'Valued Donor'),
      donor_phone: tx.donorPhone || null,
      donor_veng: tx.donorVeng || null,
      member_id: tx.memberId || null,
      sub_id: tx.subId || null,
      donor_type: tx.donorType || 'member',
      group_name: tx.groupName || null,
      is_anonymous: Boolean(tx.isAnonymous),
      amount: Number(tx.amount) || 0,
      platform_fee: Number(tx.platformFee) || 0,
      total_amount: Number(tx.totalAmount) || Number(tx.amount) || 0,
      payment_method: tx.paymentMethod || 'upi',
      status: tx.status || 'completed',
      remark: tx.remark || null,
      period_type: tx.periodType || 'one_time',
      period_month: tx.periodMonth || null,
      period_year: tx.periodYear || null,
      period_label: tx.periodLabel || null,
      utr: tx.utr || null,
      reference_no: tx.referenceNo || tx.utr || null,
      timestamp: tx.timestamp || tx.createdAt || new Date().toISOString(),
      created_at: tx.createdAt || tx.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        subCategoryBreakdown: tx.subCategoryBreakdown,
        feeOption: tx.feeOption,
        payerUPI: tx.payerUPI,
        txHash: tx.txHash,
      }
    }));

    try {
      const { error } = await supabase.from('transactions').upsert(rows, { onConflict: 'id' });
      if (!error) {
        synced += rows.length;
      } else {
        failed += rows.length;
      }
    } catch {
      failed += rows.length;
    }
  }

  // Recalibrate fund pools in Supabase once after all batches
  scheduleDebouncedPoolRecalibration();

  return {
    total: allTxns.length,
    synced,
    failed,
  };
}

// ---------------------------------------------------------------------------
// 7. MEMBERS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseMembers(campaignId?: string): Promise<MemberRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  let query = supabase.from('members').select('*');
  if (campaignId && campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data.map((row: any) => ({
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    fatherName: row.father_name,
    orgCode: row.org_code,
    phone: row.phone,
    fullPhone: row.full_phone || row.phone,
    phoneLast4: row.phone_last4,
    section: row.section,
    isFamilyHead: row.is_family_head,
    pledgeAmount: Number(row.pledge_amount) || 0,
    paidAmount: Number(row.paid_amount) || 0,
    status: row.status,
    dependents: row.dependents || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.metadata || {})
  }));
}

export async function upsertSupabaseMember(member: MemberRecord): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !member || !member.id) return false;

  const row = {
    id: member.id,
    campaign_id: member.campaignId || 'cmp-default',
    name: member.name || 'Member',
    father_name: member.fatherName || null,
    org_code: member.orgCode || null,
    phone: member.phone || member.fullPhone || null,
    full_phone: member.fullPhone || member.phone || null,
    phone_last4: member.phoneLast4 || (member.phone ? member.phone.slice(-4) : null),
    section: member.section || null,
    is_family_head: Boolean(member.isFamilyHead),
    pledge_amount: Number(member.pledgeAmount) || 0,
    paid_amount: Number(member.paidAmount) || 0,
    status: member.status || 'pending',
    dependents: member.dependents || [],
    created_at: member.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      notes: member.notes,
      avatarUrl: member.avatarUrl,
      enrollmentYear: member.enrollmentYear,
      activeYears: member.activeYears,
      yearStatus: member.yearStatus,
    }
  };

  const { error } = await supabase
    .from('members')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.warn('[Supabase] Member upsert note:', error.message);
    return false;
  }
  return true;
}

export async function deleteSupabaseMember(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !id) return false;

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) {
    console.warn('[Supabase] Member delete note:', error.message);
    return false;
  }
  return true;
}

export async function syncAllMembersToSupabase(): Promise<{ total: number; synced: number }> {
  const supabase = getSupabase();
  if (!supabase) return { total: 0, synced: 0 };

  const allMems = getMembers();
  if (!allMems || allMems.length === 0) return { total: 0, synced: 0 };

  const rows = allMems.map(member => ({
    id: member.id,
    campaign_id: member.campaignId || 'cmp-default',
    name: member.name || 'Member',
    father_name: member.fatherName || null,
    org_code: member.orgCode || null,
    phone: member.phone || member.fullPhone || null,
    full_phone: member.fullPhone || member.phone || null,
    phone_last4: member.phoneLast4 || (member.phone ? member.phone.slice(-4) : null),
    section: member.section || null,
    is_family_head: Boolean(member.isFamilyHead),
    pledge_amount: Number(member.pledgeAmount) || 0,
    paid_amount: Number(member.paidAmount) || 0,
    status: member.status || 'pending',
    dependents: member.dependents || [],
    created_at: member.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      notes: member.notes,
      avatarUrl: member.avatarUrl,
      enrollmentYear: member.enrollmentYear,
      activeYears: member.activeYears,
      yearStatus: member.yearStatus,
    }
  }));

  try {
    const { error } = await supabase.from('members').upsert(rows, { onConflict: 'id' });
    if (!error) {
      return { total: allMems.length, synced: allMems.length };
    }
  } catch (err: any) {
    console.warn('[Supabase Member Batch Warning]:', err?.message);
  }

  return { total: allMems.length, synced: 0 };
}
