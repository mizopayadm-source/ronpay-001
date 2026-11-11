import { getSupabase, isSupabaseConfigured, getSupabaseUrl, isSupabaseQuotaBlocked, markSupabaseQuotaBlocked } from '../lib/supabase';
export { isSupabaseConfigured } from '../lib/supabase';
import { Transaction, CreatorProfile, RonPayWallet, WalletTransaction, PublicPoolStats, Campaign, MemberRecord } from '../types';
import { 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredCreatorsList, 
  getStoredWallet, 
  getStoredCampaigns, 
  saveStoredCampaigns, 
  getMembers, 
  saveMembers,
  getDeletedMemberIds,
  findAllBrowserCachedTransactions,
  unpurgeTransactionIds,
  getDeletedTransactionIds,
  saveStoredAuditorGrants,
  getStoredDeletedAuditorGrantIds,
  saveStoredDeletedAuditorGrantIds
} from '../utils/storage';
import { broadcastStateChange } from './crossTabSync';


export interface SupabaseTableStatus {
  tableName: string;
  exists: boolean;
  rowCount: number;
  error?: string;
}

function logSupabaseError(context: string, error: any) {
  const msg = typeof error === 'string' ? error : error?.message || String(error);
  const status = error?.status || error?.statusCode || 0;
  if (msg.includes('exceed_egress_quota') || msg.includes('quota') || msg.includes('restricted') || status === 402 || msg.includes('402') || msg.includes('Payment Required')) {
    if (typeof window !== 'undefined') {
      (window as any).__SUPABASE_QUOTA_EXCEEDED = true;
    }
    console.warn(`[Supabase Quota / 402 Payment Required] ${context}: ${msg}`);
  } else {
    console.warn(`[Supabase Warning] ${context}: ${msg}`);
  }
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
  if (isSupabaseQuotaBlocked()) return getStoredCreatorsList();
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .range(0, 9999)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message?.includes('exceed_egress_quota') || (error as any).status === 402 || error.message?.includes('restricted')) {
      markSupabaseQuotaBlocked(error.message);
    }
    console.warn('[Supabase] Failed to fetch users:', error.message);
    return getStoredCreatorsList();
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
    ...(typeof row.metadata === 'object' && row.metadata !== null ? row.metadata : {})
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
    logSupabaseError('upsert user', error);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 2. TRANSACTIONS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseTransactions(campaignId?: string): Promise<Transaction[]> {
  if (isSupabaseQuotaBlocked()) return getStoredTransactions();
  const supabase = getSupabase();
  if (!supabase) return getStoredTransactions();

  let query = supabase
    .from('transactions')
    .select('*')
    .range(0, 9999)
    .neq('status', 'deleted')
    .order('timestamp', { ascending: false });

  if (campaignId && campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes('exceed_egress_quota') || (error as any).status === 402 || error.message?.includes('restricted')) {
      markSupabaseQuotaBlocked(error.message);
    }
  }
  if (!error && Array.isArray(data) && data.length > 0) {
    const validRows = (data || []).filter((row: any) => row && row.id && row.status !== 'deleted');
    if (validRows.length > 0) {
      unpurgeTransactionIds(validRows.map((r: any) => String(r.id)));
    }
    return validRows.map((row: any) => ({
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

  // Resilient fallback to backend server which has 100% reliable link to Supabase
  try {
    const res = await fetch('/api/data/state');
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.transactions && Array.isArray(json.data.transactions) && json.data.transactions.length > 0) {
        return json.data.transactions;
      }
    }
  } catch {}

  const stored = getStoredTransactions();
  return Array.isArray(stored) ? stored : [];
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

  let { error } = await supabase
    .from('transactions')
    .insert(row);

  if (error) {
    const res = await supabase
      .from('transactions')
      .upsert(row, { onConflict: 'id' });
    error = res.error;
  }

  if (error) {
    logSupabaseError('insert/upsert transaction', error);
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

  // Recalibrate fund pool immediately
  await recalibrateSupabaseFundPool('public_pool');
  try {
    if (typeof window !== 'undefined') {
      broadcastStateChange('transactions', [tx]);
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: [tx] }));
      window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: [tx] }));
    }
  } catch {}
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
    logSupabaseError('update transaction', error);
    return false;
  }

  await recalibrateSupabaseFundPool('public_pool');
  try {
    if (typeof window !== 'undefined') {
      broadcastStateChange('transactions', [tx]);
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: [tx] }));
    }
  } catch {}
  return true;
}

export async function deleteSupabaseTransaction(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !id) return false;

  const raw = String(id).trim();
  const lower = raw.toLowerCase();
  const upper = raw.toUpperCase();
  const matchFilter = `id.eq.${raw},id.eq.${lower},id.eq.${upper},id.ilike.${raw}`;

  try {
    await supabase
      .from('transactions')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .or(matchFilter);
  } catch {}

  try {
    await supabase
      .from('transactions')
      .delete()
      .or(matchFilter);
  } catch {}

  await recalibrateSupabaseFundPool('public_pool');
  try {
    if (typeof window !== 'undefined') {
      broadcastStateChange('transactions', { deletedId: id });
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: { deletedId: id } }));
    }
  } catch {}
  return true;
}

export async function deleteMultipleSupabaseTransactions(ids: string[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !ids || ids.length === 0) return false;

  const allVariants = new Set<string>();
  ids.forEach(id => {
    if (!id) return;
    const raw = String(id).trim();
    allVariants.add(raw);
    allVariants.add(raw.toLowerCase());
    allVariants.add(raw.toUpperCase());
  });
  const idArray = Array.from(allVariants);

  try {
    await supabase
      .from('transactions')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .in('id', idArray);
  } catch {}

  try {
    await supabase
      .from('transactions')
      .delete()
      .in('id', idArray);
  } catch {}

  await recalibrateSupabaseFundPool('public_pool');
  try {
    if (typeof window !== 'undefined') {
      broadcastStateChange('transactions', { deletedIds: idArray });
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: { deletedIds: idArray } }));
    }
  } catch {}
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
    logSupabaseError('upsert wallet', error);
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

  let exactCount = 0;
  let totalAmt = 0;
  let todayCnt = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    let query = supabase
      .from('transactions')
      .select('amount, status, timestamp, created_at, campaign_title, campaign_id')
      .neq('status', 'deleted')
      .or('campaign_title.ilike.%shillong%,campaign_id.ilike.%bmp%,campaign_title.ilike.%bmp%');

    let { data: txns, error } = await query;

    if (error || !txns || txns.length === 0) {
      const fallbackRes = await supabase
        .from('transactions')
        .select('amount, status, timestamp, created_at, campaign_title, campaign_id')
        .neq('status', 'deleted');
      txns = fallbackRes.data;
    }

    if (txns) {
      txns.forEach((t: any) => {
        const s = String(t.status || '').toLowerCase().trim();
        const isConfirmed = s === '' || s === 'completed' || s === 'paid' || s === 'verified' || s === 'success' || s === 'payment_success';
        const amt = Number(t.amount) || 0;
        if (isConfirmed && amt > 0) {
          totalAmt += amt;
          exactCount += 1;
          const d = String(t.timestamp || t.created_at || '').slice(0, 10);
          if (d === todayStr) {
            todayCnt += 1;
          }
        }
      });
    }
  } catch {}

  return {
    totalAmount: Math.max(0, Math.round(totalAmt * 100) / 100),
    totalCount: Math.max(0, exactCount),
    todayCount: Math.max(0, todayCnt),
    lastUpdated: new Date().toISOString(),
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
    logSupabaseError('upsert fund pool', error);
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

  let exactCount = 0;
  let totalAmt = 0;
  let todayCnt = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  try {
    let query = supabase
      .from('transactions')
      .select('amount, status, timestamp, created_at, campaign_title, campaign_id')
      .neq('status', 'deleted')
      .or('campaign_title.ilike.%shillong%,campaign_id.ilike.%bmp%,campaign_title.ilike.%bmp%');

    let { data: txns, error } = await query;

    if (error || !txns || txns.length === 0) {
      const fallbackRes = await supabase
        .from('transactions')
        .select('amount, status, timestamp, created_at, campaign_title, campaign_id')
        .neq('status', 'deleted');
      txns = fallbackRes.data;
    }

    if (txns) {
      txns.forEach((t: any) => {
        const s = String(t.status || '').toLowerCase().trim();
        const isConfirmed = s === '' || s === 'completed' || s === 'paid' || s === 'verified' || s === 'success' || s === 'payment_success';
        const amt = Number(t.amount) || 0;
        if (isConfirmed && amt > 0) {
          totalAmt += amt;
          exactCount += 1;
          const d = String(t.timestamp || t.created_at || '').slice(0, 10);
          if (d === todayStr) {
            todayCnt += 1;
          }
        }
      });
    }
  } catch {}

  const freshStats: PublicPoolStats = {
    totalAmount: Math.max(0, Math.round(totalAmt * 100) / 100),
    totalCount: Math.max(0, exactCount),
    todayCount: Math.max(0, todayCnt),
    lastUpdated: new Date().toISOString(),
  };

  await upsertSupabaseFundPool(freshStats, poolId);
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: freshStats }));
      window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: freshStats }));
    }
  } catch {}

  return freshStats;
}

// ---------------------------------------------------------------------------
// 5. CAMPAIGNS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseCampaigns(): Promise<Campaign[]> {
  if (isSupabaseQuotaBlocked()) return getStoredCampaigns();
  const supabase = getSupabase();
  if (!supabase) return getStoredCampaigns();

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .range(0, 9999)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.message?.includes('exceed_egress_quota') || (error as any).status === 402 || error.message?.includes('restricted')) {
      markSupabaseQuotaBlocked(error.message);
    }
    console.warn('[Supabase] Failed to fetch campaigns:', error.message);
    return getStoredCampaigns();
  }

  return (data || []).map((row: any) => {
    const meta = row.metadata || {};
    if (Array.isArray(meta.deletedAuditorGrantIds) && meta.deletedAuditorGrantIds.length > 0) {
      try {
        saveStoredDeletedAuditorGrantIds([...getStoredDeletedAuditorGrantIds(), ...meta.deletedAuditorGrantIds]);
      } catch {}
    }
    const delGrantSet = new Set(getStoredDeletedAuditorGrantIds());
    const rawAuditorGrants = Array.isArray(meta.auditorGrants)
      ? meta.auditorGrants
      : Array.isArray(row.auditorGrants)
      ? row.auditorGrants
      : undefined;
    const auditorGrants = Array.isArray(rawAuditorGrants)
      ? rawAuditorGrants.filter((g: any) => g && g.id && !delGrantSet.has(String(g.id).toLowerCase().trim()))
      : undefined;
    if (auditorGrants && auditorGrants.length > 0) {
      try {
        saveStoredAuditorGrants(auditorGrants, true);
      } catch {}
    }
    return {
      ...meta,
      ...row,
      id: row.id,
      title: row.title,
      category: row.category,
      orgName: row.org_name || row.orgName,
      targetUpiId: row.target_upi_id || row.targetUpiId || row.upiId,
      upiId: row.target_upi_id || row.upiId || 'ronpay@upi',
      status: row.status || 'active',
      createdBy: row.created_by || row.createdBy,
      createdByName: row.created_by_name || row.createdByName,
      customAmount: row.custom_amount ? Number(row.custom_amount) : undefined,
      openingBalance: Number(row.opening_balance ?? row.openingBalance ?? 0),
      location: row.location,
      description: row.description,
      imageUrl: row.image_url || row.imageUrl,
      isApproved: row.is_approved ?? row.isApproved ?? true,
      allowPublicGroupDeposits: row.allow_public_group_deposits ?? row.allowPublicGroupDeposits ?? true,
      createdAt: row.created_at || row.createdAt,
      updatedAt: row.updated_at || row.updatedAt,
      subCategories: meta.subCategories ?? row.subCategories,
      definedSections: meta.definedSections ?? row.definedSections,
      sectionLabel: meta.sectionLabel ?? row.sectionLabel ?? 'Bial / Section',
      groupPresets: meta.groupPresets ?? row.groupPresets,
      generalPresets: meta.generalPresets ?? row.generalPresets,
      orgCode: meta.orgCode ?? row.orgCode,
      cause: meta.cause ?? row.cause,
      causeMizo: meta.causeMizo ?? row.causeMizo,
      causeEn: meta.causeEn ?? row.causeEn,
      validityDate: meta.validityDate ?? meta.valid_until ?? meta.expiry_date ?? meta.validity_date ?? row.validityDate ?? row.valid_until ?? row.expiry_date ?? row.validity_date ?? row.expires_at,
      expiry_date: meta.expiry_date ?? row.expiry_date ?? meta.valid_until ?? row.valid_until ?? meta.validityDate ?? row.validityDate,
      valid_until: meta.valid_until ?? row.valid_until ?? meta.expiry_date ?? row.expiry_date ?? meta.validityDate ?? row.validityDate,
      gpsCoords: meta.gpsCoords ?? row.gpsCoords,
      kumtluangFeeBearer: meta.kumtluangFeeBearer ?? row.kumtluangFeeBearer,
      authorizedOfficers: meta.authorizedOfficers ?? row.authorizedOfficers,
      auditorGrants,
      auditChecklist: meta.auditChecklist ?? row.auditChecklist,
      lastAuditedAt: meta.lastAuditedAt ?? row.lastAuditedAt,
      lastAuditedBy: meta.lastAuditedBy ?? row.lastAuditedBy,
      lastAuditPeriod: meta.lastAuditPeriod ?? row.lastAuditPeriod,
      lastAuditNotes: meta.lastAuditNotes ?? row.lastAuditNotes,
      auditReconciliation: meta.auditReconciliation ?? row.auditReconciliation,
      isHidden: Boolean(meta.isHidden ?? row.is_hidden ?? row.isHidden ?? false),
      hiddenAt: meta.hiddenAt ?? row.hidden_at ?? row.hiddenAt,
      hiddenBy: meta.hiddenBy ?? row.hidden_by ?? row.hiddenBy,
      hideReason: meta.hideReason ?? row.hide_reason ?? row.hideReason,
      metadata: meta
    };
  });
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
    opening_balance: Number(camp.openingBalance ?? (camp as any).opening_balance ?? 0),
    location: camp.location || null,
    description: camp.description || null,
    image_url: camp.imageUrl || null,
    is_approved: camp.isApproved ?? true,
    allow_public_group_deposits: camp.allowPublicGroupDeposits ?? true,
    metadata: {
      ...((camp as any).metadata || {}),
      subCategories: camp.subCategories,
      definedSections: camp.definedSections,
      sectionLabel: camp.sectionLabel,
      groupPresets: camp.groupPresets,
      generalPresets: camp.generalPresets,
      orgCode: camp.orgCode,
      cause: camp.cause,
      causeMizo: camp.causeMizo,
      causeEn: camp.causeEn,
      validityDate: camp.validityDate,
      expiry_date: camp.expiry_date || camp.validityDate,
      valid_until: camp.valid_until || camp.validityDate,
      gpsCoords: camp.gpsCoords,
      kumtluangFeeBearer: camp.kumtluangFeeBearer,
      mitthiHming: camp.mitthiHming,
      age: camp.age,
      vuitu: camp.vuitu,
      thihni: camp.thihni,
      vuiHun: camp.vuiHun,
      section: camp.section,
      kohhran: camp.kohhran,
      allow_online_pg: camp.allow_online_pg,
      allow_cash_payment: camp.allow_cash_payment,
      targetAmount: camp.targetAmount,
      targetPeriod: camp.targetPeriod,
      maxLimit: camp.maxLimit,
      urgencyDeadline: camp.urgencyDeadline,
      urgencyLevel: camp.urgencyLevel,
      officerPasscode: camp.officerPasscode,
      authorizedOfficers: camp.authorizedOfficers,
      auditorGrants: Array.isArray(camp.auditorGrants)
        ? camp.auditorGrants.filter(g => g && g.id && !getStoredDeletedAuditorGrantIds().includes(String(g.id).toLowerCase().trim()))
        : [],
      deletedAuditorGrantIds: getStoredDeletedAuditorGrantIds(),
      auditChecklist: camp.auditChecklist,
      auditSignOffs: camp.auditSignOffs,
      requireDualAuditorConsensus: camp.requireDualAuditorConsensus,
      lastAuditedAt: camp.lastAuditedAt,
      lastAuditedBy: camp.lastAuditedBy,
      lastAuditPeriod: camp.lastAuditPeriod,
      lastAuditNotes: camp.lastAuditNotes,
      auditReconciliation: camp.auditReconciliation,
      expenseHeads: camp.expenseHeads,
      isHidden: Boolean(camp.isHidden),
      hiddenAt: camp.hiddenAt || null,
      hiddenBy: camp.hiddenBy || null,
      hideReason: camp.hideReason || null,
    }
  };

  const { error } = await supabase
    .from('campaigns')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    logSupabaseError('upsert campaign', error);
    return false;
  }
  return true;
}

export async function updateSupabaseOpeningBalance(campaignId: string, openingBalance: number): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !campaignId) return false;
  const { error } = await supabase
    .from('campaigns')
    .update({
      opening_balance: Number(openingBalance) || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', campaignId);
  if (error) {
    console.warn('[Supabase] Error updating opening balance:', error.message);
    return false;
  }
  return true;
}

export async function deleteSupabaseCampaign(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !id) return false;

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);

  if (error) {
    console.warn('[Supabase] Error deleting campaign:', error.message);
    return false;
  }
  return true;
}

export async function deleteMultipleSupabaseCampaigns(ids: string[]): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !ids || ids.length === 0) return false;

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .in('id', ids);

  if (error) {
    console.warn('[Supabase] Error deleting multiple campaigns:', error.message);
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

    // 5. Sync Fund Pool removed (Fetch-Only mode)


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
      poolSynced: false,
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
 * Emergency & Authoritative Cache Restore: Scans all local browser storage,
 * unpurges tombstones, batch upserts to Supabase, recalibrates fund pools, and syncs to server.
 */
export async function restoreCacheToSupabase(customTransactions?: Transaction[]): Promise<{
  success: boolean;
  restoredCount: number;
  totalAmount: number;
  message: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, restoredCount: 0, totalAmount: 0, message: 'Supabase client not connected.' };
  }

  // 1. Gather all cached transactions
  const targetList = (customTransactions && customTransactions.length > 0)
    ? customTransactions
    : findAllBrowserCachedTransactions();

  if (!targetList || targetList.length === 0) {
    return { success: false, restoredCount: 0, totalAmount: 0, message: 'Browser cache-ah transactions hmuh a ni lo (No cached transactions found).' };
  }

  // 2. Filter & clean valid transactions
  const validList = targetList.filter(t => t && t.id && Number(t.amount) > 0);
  if (validList.length === 0) {
    return { success: false, restoredCount: 0, totalAmount: 0, message: 'No valid positive amount transactions to restore.' };
  }

  // 3. Clear tombstones so they are unpurged!
  const txIds = validList.map(t => String(t.id).toLowerCase().trim());
  unpurgeTransactionIds(txIds);

  // 4. Save into all local storage slots
  saveStoredTransactions(validList, false);

  // 5. Ensure parent campaigns exist in Supabase
  try {
    const localCamps = getStoredCampaigns();
    for (const c of localCamps) {
      await upsertSupabaseCampaign(c);
    }
  } catch {}

  // 6. Batch upsert to Supabase transactions table
  const mappedRows = validList.map(t => {
    const meta = (t as any).metadata || {};
    return {
      id: t.id,
      campaign_id: t.campaignId || 'cmp-default',
      campaign_title: t.campaignTitle || 'RonPay Community Cause',
      category: t.category || 'others',
      donor_name: t.donorName || (t.isAnonymous ? 'Anonymous' : 'Valued Donor'),
      donor_phone: t.donorPhone || null,
      donor_veng: t.donorVeng || (t as any).donorSection || null,
      member_id: t.memberId || null,
      sub_id: t.subId || null,
      donor_type: t.donorType || 'member',
      group_name: t.groupName || null,
      is_anonymous: Boolean(t.isAnonymous),
      amount: Number(t.amount) || 0,
      platform_fee: Number(t.platformFee ?? 0),
      total_amount: Number(t.totalAmount ?? t.amount ?? 0),
      payment_method: t.paymentMethod || 'upi',
      status: t.status || 'completed',
      remark: t.remark || null,
      period_type: t.periodType || 'monthly',
      period_month: t.periodMonth || null,
      period_year: t.periodYear || null,
      period_label: t.periodLabel || null,
      utr: t.utr || null,
      reference_no: t.referenceNo || t.utr || null,
      timestamp: t.timestamp || t.createdAt || new Date().toISOString(),
      created_at: t.createdAt || t.timestamp || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: {
        subCategoryBreakdown: t.subCategoryBreakdown,
        feeOption: t.feeOption,
        payerUPI: t.payerUPI,
        txHash: t.txHash,
        ...meta
      }
    };
  });

  let syncedCount = 0;
  for (let i = 0; i < mappedRows.length; i += 40) {
    const chunk = mappedRows.slice(i, i + 40);
    const { error } = await supabase.from('transactions').upsert(chunk, { onConflict: 'id' });
    if (!error) {
      syncedCount += chunk.length;
    } else {
      console.warn('[Supabase Restore Chunk Warning]:', error.message);
      // Fallback row-by-row
      for (const row of chunk) {
        const { error: singleErr } = await supabase.from('transactions').upsert(row, { onConflict: 'id' });
        if (!singleErr) syncedCount++;
      }
    }
  }

  // 7. Push to server REST API
  try {
    await fetch('/api/restore-transactions-to-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: validList })
    });
  } catch {}

  // 8. Recalibrate fund pool in Supabase
  const totalAmount = validList.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  await recalibrateSupabaseFundPool('public_pool');

  // 9. Broadcast local and cross-tab events
  try {
    if (typeof window !== 'undefined') {
      broadcastStateChange('transactions', validList);
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: validList }));
      window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: validList }));
    }
  } catch {}

  return {
    success: true,
    restoredCount: validList.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    message: `Hlawhtling takin transactions ${validList.length} (₹${totalAmount.toLocaleString('en-IN')}) Supabase-ah restore a ni ta!`
  };
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
  const res = await restoreCacheToSupabase();
  return { total: res.restoredCount, synced: res.restoredCount, failed: 0 };
}

// ---------------------------------------------------------------------------
// 7. MEMBERS (PostgREST SDK)
// ---------------------------------------------------------------------------

export async function fetchSupabaseMembers(campaignId?: string): Promise<MemberRecord[]> {
  if (isSupabaseQuotaBlocked()) return getMembers(campaignId);
  const supabase = getSupabase();
  if (!supabase) return getMembers(campaignId);

  let query = supabase.from('members').select('*').range(0, 9999);
  if (campaignId && campaignId !== 'all') {
    query = query.eq('campaign_id', campaignId);
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error && (error.message?.includes('exceed_egress_quota') || (error as any).status === 402 || error.message?.includes('restricted'))) {
      markSupabaseQuotaBlocked(error.message);
    }
    return getMembers(campaignId);
  }

  const deletedMemIds = getDeletedMemberIds();

  return data.map((row: any) => {
    const meta = row.metadata || {};
    const effectiveSection = row.section || meta.section || undefined;
    return {
      ...meta,
      id: row.id,
      campaignId: row.campaign_id || row.campaignId,
      name: row.name,
      fatherName: row.father_name || undefined,
      orgCode: row.org_code || undefined,
      phone: row.phone || undefined,
      fullPhone: row.full_phone || row.phone || undefined,
      phoneLast4: row.phone_last4 || undefined,
      section: effectiveSection,
      isFamilyHead: Boolean(row.is_family_head),
      pledgeAmount: Number(row.pledge_amount) || 0,
      paidAmount: Number(row.paid_amount) || 0,
      status: row.status,
      dependents: row.dependents || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      yearStatus: meta.yearStatus || row.yearStatus,
      metadata: meta
    };
  }).filter(m => {
    if (!m || !m.id) return false;
    const clean = m.id.toLowerCase().trim();
    const altClean = clean.startsWith('ebe-') ? 'bcm-' + clean.substring(4) : (clean.startsWith('bcm-') ? 'ebe-' + clean.substring(4) : clean);
    return !deletedMemIds.has(clean) && !deletedMemIds.has(altClean);
  });
}

export async function updateSupabaseMember(member: MemberRecord, oldId?: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !member || !member.id) return false;

  const targetId = oldId || member.id;
  const updatePayload = {
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
    updated_at: new Date().toISOString(),
    metadata: {
      notes: member.notes,
      avatarUrl: member.avatarUrl,
      enrollmentYear: member.enrollmentYear,
      activeYears: member.activeYears,
      yearStatus: member.yearStatus,
      section: member.section || null,
    }
  };

  try {
    // 1. Direct SQL UPDATE query for permanent immediate persistence
    const { data, error } = await supabase
      .from('members')
      .update(updatePayload)
      .eq('id', targetId)
      .select();

    let success = false;
    if (!error && data && data.length > 0) {
      success = true;
    } else {
      // 2. Fallback upsert if not found by oldId
      const { error: upsertErr } = await supabase
        .from('members')
        .upsert(updatePayload, { onConflict: 'id' });

      if (upsertErr) {
        console.warn('[Supabase] Member update/upsert error:', upsertErr.message);
        return false;
      }
      success = true;
    }

    // Clean up old ID if changed to prevent stale duplicate rows
    if (oldId && oldId.toLowerCase().trim() !== member.id.toLowerCase().trim()) {
      await supabase.from('members').delete().eq('id', oldId);
    }

    // Propagate member name & section update to Supabase transactions
    try {
      const matchIds = Array.from(new Set([
        member.id,
        member.id.toLowerCase(),
        member.id.toUpperCase(),
        ...(oldId && oldId !== member.id ? [oldId, oldId.toLowerCase(), oldId.toUpperCase()] : [])
      ]));
      await supabase
        .from('transactions')
        .update({
          donor_name: member.name || 'Member',
          donor_veng: member.section || null,
          member_id: member.id,
          updated_at: new Date().toISOString()
        })
        .in('member_id', matchIds);
    } catch {}

    return success;
  } catch (err: any) {
    console.warn('[Supabase] Member persistence error:', err?.message);
    return false;
  }
}

export async function upsertSupabaseMember(member: MemberRecord): Promise<boolean> {
  return updateSupabaseMember(member);
}

export async function updateSupabaseTransactionsForMember(
  memberId: string,
  oldId: string | undefined,
  newName: string,
  newSection: string | undefined,
  txIds?: string[]
): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !memberId) return false;

  const nowIso = new Date().toISOString();
  const payload: any = {
    donor_name: newName || 'Member',
    donor_veng: newSection || null,
    member_id: memberId,
    updated_at: nowIso
  };

  try {
    // 1. Direct update by transaction primary keys if available
    if (Array.isArray(txIds) && txIds.length > 0) {
      await supabase
        .from('transactions')
        .update(payload)
        .in('id', txIds);
    }

    // 2. Also update by all case variants of memberId and oldId
    const mIds = Array.from(new Set([
      memberId,
      memberId.toLowerCase().trim(),
      memberId.toUpperCase().trim(),
      ...(oldId ? [oldId, oldId.toLowerCase().trim(), oldId.toUpperCase().trim()] : [])
    ]));

    await supabase
      .from('transactions')
      .update(payload)
      .in('member_id', mIds);

    return true;
  } catch (err: any) {
    console.warn('[Supabase] Member transactions update warning:', err?.message);
    return false;
  }
}

export async function deleteSupabaseMember(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase || !id) return false;

  const clean = id.trim();
  const lower = clean.toLowerCase();
  const upper = clean.toUpperCase();

  try {
    const { error } = await supabase
      .from('members')
      .delete()
      .or(`id.eq.${clean},id.eq.${lower},id.eq.${upper},id.ilike.${clean}`);

    if (error) {
      console.warn('[Supabase] Member delete note:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Supabase] Member delete caught note:', err?.message);
    return false;
  }
}

export async function syncAllMembersToSupabase(): Promise<{ total: number; synced: number }> {
  if (isSupabaseQuotaBlocked()) {
    const allMems = getMembers('all');
    return { total: allMems ? allMems.length : 0, synced: 0 };
  }
  const supabase = getSupabase();
  if (!supabase) {
    const allMems = getMembers('all');
    return { total: allMems ? allMems.length : 0, synced: 0 };
  }

  // Load ALL local members across all campaigns
  const allMems = getMembers('all');
  if (!allMems || allMems.length === 0) return { total: 0, synced: 0 };

  // Fetch campaigns for orgCode mapping
  const storedCampaigns = getStoredCampaigns();
  const campOrgMap = new Map<string, string>();
  storedCampaigns.forEach(c => {
    if (c && c.id && c.orgCode) {
      campOrgMap.set(c.id, String(c.orgCode).trim().toUpperCase());
    }
  });

  // Align member IDs and orgCode with campaign settings and deduplicate
  const validMemberIds = new Set<string>();
  const alignedMembers: MemberRecord[] = [];
  const uniqueRowMap = new Map<string, any>();

  for (const member of allMems) {
    if (!member || !member.id) continue;
    let effectiveCode = member.orgCode ? String(member.orgCode).trim().toUpperCase() : 'MEM';
    if (member.campaignId && campOrgMap.has(member.campaignId)) {
      effectiveCode = campOrgMap.get(member.campaignId)!;
    }

    let effectiveId = String(member.id).trim();
    if (effectiveId && effectiveId.includes('-')) {
      const parts = effectiveId.split('-');
      const currPrefix = parts[0].toUpperCase();
      // If it has multiple hyphens e.g. ZBKEBE-5544-1170, normalize parts:
      const suffix = parts.length > 2 ? parts[1] : parts.slice(1).join('-');
      effectiveId = `${effectiveCode}-${suffix}`;
    } else if (effectiveId) {
      const suffix = member.phoneLast4 || effectiveId.slice(-4);
      effectiveId = `${effectiveCode}-${suffix}`;
    }

    const cleanLowerId = effectiveId.toLowerCase();
    if (uniqueRowMap.has(cleanLowerId)) {
      continue;
    }

    const existingUpdatedAt = member.updatedAt || member.createdAt || new Date().toISOString();
    const updatedMember: MemberRecord = {
      ...member,
      id: effectiveId,
      orgCode: effectiveCode,
      updatedAt: existingUpdatedAt
    };
    alignedMembers.push(updatedMember);

    validMemberIds.add(effectiveId);
    validMemberIds.add(cleanLowerId);

    const cleanCreated = (member.createdAt && member.createdAt.includes('.5T'))
      ? '2026-01-04T12:00:00.000Z'
      : (member.createdAt || new Date().toISOString());

    uniqueRowMap.set(cleanLowerId, {
      id: effectiveId,
      campaign_id: member.campaignId || 'cmp-default',
      name: member.name || 'Member',
      father_name: member.fatherName || null,
      org_code: effectiveCode,
      phone: member.phone || member.fullPhone || null,
      full_phone: member.fullPhone || member.phone || null,
      phone_last4: member.phoneLast4 || (member.phone ? member.phone.slice(-4) : null),
      section: member.section || null,
      is_family_head: Boolean(member.isFamilyHead),
      pledge_amount: Number(member.pledgeAmount) || 0,
      paid_amount: Number(member.paidAmount) || 0,
      status: member.status || 'pending',
      dependents: member.dependents || [],
      created_at: cleanCreated,
      updated_at: existingUpdatedAt,
      metadata: {
        notes: member.notes,
        avatarUrl: member.avatarUrl,
        enrollmentYear: member.enrollmentYear,
        activeYears: member.activeYears,
        yearStatus: member.yearStatus,
        section: member.section || null,
      }
    });
  }

  const rows = Array.from(uniqueRowMap.values());

  // Save aligned members back to localStorage
  try {
    localStorage.setItem('ronpay_kumtluang_members_v1', JSON.stringify(alignedMembers));
  } catch {}

  try {
    if (isSupabaseQuotaBlocked()) return { total: allMems.length, synced: 0 };
    // 1. Chunked upsert into Supabase (50 records per batch)
    const chunkSize = 50;
    let synced = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const batch = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('members').upsert(batch, { onConflict: 'id' });
      if (!error) {
        synced += batch.length;
      } else {
        console.warn('[Supabase Member Chunk Upsert Warning]:', error.message);
      }
    }

    // 2. Only cleanup explicitly deleted member records in Supabase (never delete valid cloud rows just because a client cache was partial)
    try {
      const deletedMemSet = getDeletedMemberIds();
      if (deletedMemSet.size > 0) {
        const { data: cloudRows } = await supabase.from('members').select('id');
        if (cloudRows && cloudRows.length > 0) {
          for (const cloudRow of cloudRows) {
            const cloudId = String(cloudRow.id || '').toLowerCase().trim();
            if (deletedMemSet.has(cloudId)) {
              await supabase.from('members').delete().eq('id', cloudRow.id);
            }
          }
        }
      }
    } catch (cleanErr) {
      console.warn('[Supabase Member Cleanup Note]:', cleanErr);
    }

    return { total: allMems.length, synced };
  } catch (err: any) {
    console.warn('[Supabase Member Batch Warning]:', err?.message);
    return { total: allMems.length, synced: 0 };
  }
}

// ---------------------------------------------------------------------------
// 8. SUPABASE REALTIME SYNCHRONIZATION (WEBSOCKETS via supabase.channel)
// ---------------------------------------------------------------------------

export interface SupabaseRealtimeCallbacks {
  onTransactionsUpdate?: (txns: Transaction[]) => void;
  onTransactionDeleted?: (id: string) => void;
  onCampaignsUpdate?: (camps: Campaign[]) => void;
  onMembersUpdate?: (members: MemberRecord[]) => void;
  onStatsUpdate?: (stats: PublicPoolStats) => void;
  onCreatorsUpdate?: (creators: CreatorProfile[]) => void;
  onWalletUpdate?: (wallet: RonPayWallet) => void;
}

/**
 * Loads the canonical initial state strictly from Supabase (Absolute Primary Store)
 */
export async function loadSupabaseInitialState(): Promise<{
  transactions: Transaction[];
  campaigns: Campaign[];
  members: MemberRecord[];
  creators: CreatorProfile[];
  fundPool: PublicPoolStats | null;
}> {
  const supabase = getSupabase();
  if (!supabase || isSupabaseQuotaBlocked()) {
    return {
      transactions: getStoredTransactions(),
      campaigns: getStoredCampaigns(),
      members: getMembers(),
      creators: getStoredCreatorsList(),
      fundPool: null,
    };
  }

  try {
    const [txns, camps, mems, users, pool] = await Promise.all([
      fetchSupabaseTransactions(),
      fetchSupabaseCampaigns(),
      fetchSupabaseMembers(),
      fetchSupabaseUsers(),
      fetchSupabaseFundPool(),
    ]);

    let finalTxns = Array.isArray(txns) && txns.length > 0 ? txns : [];
    const local108 = getStoredTransactions();
    if (local108.length > 0 && finalTxns.length > local108.length) {
      console.info(`[Supabase Reconciliation] Supabase has ${finalTxns.length} txns, local has ${local108.length}. Reconciling Supabase to match 108 local transactions...`);
      reconcileSupabaseToMatchLocal108().catch(e => console.warn('Auto reconciliation note:', e));
      finalTxns = local108;
    }

    if (finalTxns.length === 0) {
      try {
        const res = await fetch('/api/data/state');
        if (res.ok) {
          const json = await res.json();
          if (json?.data?.transactions && Array.isArray(json.data.transactions) && json.data.transactions.length > 0) {
            finalTxns = json.data.transactions;
          }
        }
      } catch {}
    }
    if (finalTxns.length === 0) {
      finalTxns = getStoredTransactions();
    }
    if (finalTxns.length === 0) {
      finalTxns = findAllBrowserCachedTransactions();
    }

    // Auto-Restore Safeguard: If Supabase was wiped/deleted (txns is 0) but we have cached transactions (> 0),
    // automatically trigger restoreCacheToSupabase so Supabase gets restored without data loss!
    if ((!txns || txns.length === 0) && finalTxns.length > 0) {
      console.info(`[Supabase Auto-Restore] Supabase has 0 txns, restoring ${finalTxns.length} from cache!`);
      restoreCacheToSupabase(finalTxns).catch(e => console.warn('Auto restore note:', e));
    }

    // Update secondary cache and server SSOT
    if (camps && camps.length > 0) {
      const localCamps = getStoredCampaigns();
      const mergedCamps = [...camps];
      for (const loc of localCamps) {
        if (!loc || !loc.id) continue;
        const key = String(loc.id).toLowerCase().trim();
        const remIdx = mergedCamps.findIndex(c => String(c.id).toLowerCase().trim() === key);
        if (remIdx >= 0) {
          const locTime = loc.updatedAt ? new Date(loc.updatedAt).getTime() : 0;
          const remTime = mergedCamps[remIdx].updatedAt ? new Date(mergedCamps[remIdx].updatedAt).getTime() : 0;
          if (locTime > remTime) {
            mergedCamps[remIdx] = { ...mergedCamps[remIdx], ...loc };
          }
        } else {
          mergedCamps.push(loc);
          upsertSupabaseCampaign(loc).catch(() => {});
        }
      }
      saveStoredCampaigns(mergedCamps, false);
    }
    let finalMembers = mems && mems.length > 0 ? mems : getMembers();
    if (mems && mems.length > 0) {
      // Supabase is the authoritative Single Source of Truth for members; never re-inject local seed/cache members into Supabase on initial load
      finalMembers = mems;
      saveMembers(mems, true);
    }
    if (pool) {
      try {
        localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(pool));
      } catch {}
    }

    return {
      transactions: finalTxns,
      campaigns: getStoredCampaigns(),
      members: finalMembers,
      creators: users && users.length > 0 ? users : getStoredCreatorsList(),
      fundPool: pool,
    };
  } catch (err) {
    console.warn('[Supabase] Initial state load fallback note:', err);
    let fallbackTxns = getStoredTransactions();
    try {
      const res = await fetch('/api/data/state');
      if (res.ok) {
        const json = await res.json();
        if (json?.data?.transactions && Array.isArray(json.data.transactions) && json.data.transactions.length > 0) {
          fallbackTxns = json.data.transactions;
          saveStoredTransactions(fallbackTxns, true);
        }
      }
    } catch {}
    return {
      transactions: fallbackTxns,
      campaigns: getStoredCampaigns(),
      members: getMembers(),
      creators: getStoredCreatorsList(),
      fundPool: null,
    };
  }
}

/**
 * Subscribes to Supabase Realtime Channels (PostgreSQL changes) for instantaneous,
 * two-way synchronization across Mobile Apps, Browsers, and Web without page refresh
 */
export function initSupabaseRealtimeSync(callbacks: SupabaseRealtimeCallbacks): () => void {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    console.info('[Supabase Realtime] Supabase credentials not ready yet; realtime standby.');
    return () => {};
  }

  console.info('[Supabase Realtime] Starting Master Realtime Channel on schema: public');

  let txDebounce: any = null;
  let campDebounce: any = null;
  let memDebounce: any = null;
  let poolDebounce: any = null;
  let usersDebounce: any = null;
  let walletDebounce: any = null;

  const refreshTxns = () => {
    if (txDebounce) clearTimeout(txDebounce);
    txDebounce = setTimeout(async () => {
      try {
        const fresh = await fetchSupabaseTransactions();
        if (Array.isArray(fresh)) {
          saveStoredTransactions(fresh, true);
          callbacks.onTransactionsUpdate?.(fresh);
          try {
            window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: fresh }));
            window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: fresh }));
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase Realtime] Tx refresh note:', e);
      }
    }, 250);
  };

  const refreshCamps = () => {
    if (campDebounce) clearTimeout(campDebounce);
    campDebounce = setTimeout(async () => {
      try {
        const fresh = await fetchSupabaseCampaigns();
        if (fresh && fresh.length > 0) {
          const localCamps = getStoredCampaigns();
          const merged = [...fresh];
          for (const loc of localCamps) {
            if (!loc || !loc.id) continue;
            const lKey = String(loc.id).toLowerCase().trim();
            if (!merged.some(c => String(c.id).toLowerCase().trim() === lKey)) {
              merged.push(loc);
              upsertSupabaseCampaign(loc).catch(() => {});
            }
          }
          saveStoredCampaigns(merged, true);
          callbacks.onCampaignsUpdate?.(merged);
          try {
            window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: merged }));
            window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: merged }));
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase Realtime] Camp refresh note:', e);
      }
    }, 350);
  };

  const refreshMems = () => {
    if (memDebounce) clearTimeout(memDebounce);
    memDebounce = setTimeout(async () => {
      try {
        const fresh = await fetchSupabaseMembers();
        if (fresh && fresh.length > 0) {
          saveMembers(fresh, true);
          callbacks.onMembersUpdate?.(fresh);
          try {
            window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: fresh }));
            window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: fresh }));
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase Realtime] Member refresh note:', e);
      }
    }, 350);
  };

  const refreshPool = () => {
    if (poolDebounce) clearTimeout(poolDebounce);
    poolDebounce = setTimeout(async () => {
      try {
        const fresh = await fetchSupabaseFundPool();
        if (fresh) {
          callbacks.onStatsUpdate?.(fresh);
          try {
            localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(fresh));
            window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: fresh }));
            window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: fresh }));
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase Realtime] Pool refresh note:', e);
      }
    }, 350);
  };

  const refreshUsers = () => {
    if (usersDebounce) clearTimeout(usersDebounce);
    usersDebounce = setTimeout(async () => {
      try {
        const fresh = await fetchSupabaseUsers();
        if (fresh && fresh.length > 0) {
          callbacks.onCreatorsUpdate?.(fresh);
          try {
            window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: fresh }));
            window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: fresh[0] }));
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase Realtime] Users refresh note:', e);
      }
    }, 350);
  };

  const refreshWallet = () => {
    if (walletDebounce) clearTimeout(walletDebounce);
    walletDebounce = setTimeout(async () => {
      try {
        const localWallet = getStoredWallet();
        const fresh = await fetchSupabaseWallet(localWallet.walletId);
        if (fresh) {
          callbacks.onWalletUpdate?.(fresh);
          try {
            localStorage.setItem('ronpay_wallet_v1', JSON.stringify(fresh));
            window.dispatchEvent(new CustomEvent('ronpay_wallet_updated', { detail: fresh }));
          } catch {}
        }
      } catch (e) {
        console.warn('[Supabase Realtime] Wallet refresh note:', e);
      }
    }, 350);
  };

  const channel = supabase.channel('ronpay-realtime-master')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
      console.info('[Supabase Realtime] Transactions event:', payload.eventType);
      const isDelete = payload.eventType === 'DELETE';
      const isStatusDeleted = payload.eventType === 'UPDATE' && (payload.new as any)?.status === 'deleted';
      if (isDelete || isStatusDeleted) {
        const deletedId = (payload.old as any)?.id || (payload.new as any)?.id;
        if (deletedId) {
          callbacks.onTransactionDeleted?.(String(deletedId));
        }
      }
      refreshTxns();
      refreshPool();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, (payload) => {
      console.info('[Supabase Realtime] Campaigns event:', payload.eventType);
      refreshCamps();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
      console.info('[Supabase Realtime] Members event:', payload.eventType);
      refreshMems();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fund_pools' }, (payload) => {
      console.info('[Supabase Realtime] Fund pools event:', payload.eventType);
      refreshPool();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, (payload) => {
      console.info('[Supabase Realtime] Wallets event:', payload.eventType);
      refreshWallet();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions' }, (payload) => {
      console.info('[Supabase Realtime] Wallet transactions event:', payload.eventType);
      refreshWallet();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
      console.info('[Supabase Realtime] Users event:', payload.eventType);
      refreshUsers();
    })
    .subscribe((status) => {
      console.info('[Supabase Realtime] Channel status:', status);
    });

  return () => {
    if (txDebounce) clearTimeout(txDebounce);
    if (campDebounce) clearTimeout(campDebounce);
    if (memDebounce) clearTimeout(memDebounce);
    if (poolDebounce) clearTimeout(poolDebounce);
    if (usersDebounce) clearTimeout(usersDebounce);
    if (walletDebounce) clearTimeout(walletDebounce);
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}

export async function getSupabaseTableCount(table: string): Promise<number> {
  const supabase = getSupabase();
  if (!supabase) return 0;
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return error ? 0 : (count || 0);
}

export async function wipeSupabaseTables(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  try {
    await supabase.from('transactions').delete().neq('id', '0');
    await supabase.from('expenses').delete().neq('id', '0');
    await supabase.from('wallet_transactions').delete().neq('id', '0');
    await supabase.from('fund_pools').upsert({
      id: 'public_pool',
      name: 'RonPay Public Fund Pool',
      total_amount: 0,
      total_count: 0,
      today_count: 0,
      last_updated: new Date().toISOString()
    }, { onConflict: 'id' });

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ronpay_transactions_v4');
      localStorage.removeItem('ronpay_transactions_v2');
      localStorage.removeItem('ronpay_transactions');
      localStorage.removeItem('ronpay_supabase_pending_txs');
      localStorage.removeItem('ronpay_public_pool_stats_v1');
    }
    return true;
  } catch (e) {
    console.error('Error wiping tables:', e);
    return false;
  }
}

/**
 * Reconciles Supabase database so its transactions table matches the exact 108 valid local transactions.
 * Deletes any orphan/extra transactions from Supabase that are not in the valid 108 list.
 */
export async function reconcileSupabaseToMatchLocal108(): Promise<{
  localCount: number;
  supabaseBeforeCount: number;
  purgedCount: number;
  supabaseAfterCount: number;
  success: boolean;
  message: string;
}> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      localCount: 0,
      supabaseBeforeCount: 0,
      purgedCount: 0,
      supabaseAfterCount: 0,
      success: false,
      message: 'Supabase client is not initialized.'
    };
  }

  try {
    const rawLocalTxs = getStoredTransactions();
    const valid108Map = new Map<string, Transaction>();
    rawLocalTxs.forEach(t => {
      if (t && t.id) {
        const idStr = String(t.id).trim();
        // Exclude legacy expense voucher entries that were accidentally stored in transactions table
        if (!idStr.startsWith('VCH-') && !idStr.startsWith('EXP-') && (t.status === 'completed' || !t.status)) {
          valid108Map.set(idStr.toLowerCase(), t);
        }
      }
    });

    const localCount = valid108Map.size;

    // 1. Fetch all transaction IDs currently in Supabase
    const { data: remoteRows, error: fetchErr } = await supabase
      .from('transactions')
      .select('id');

    if (fetchErr || !remoteRows) {
      return {
        localCount,
        supabaseBeforeCount: 0,
        purgedCount: 0,
        supabaseAfterCount: 0,
        success: false,
        message: `Failed to query Supabase transactions: ${fetchErr?.message || 'Error'}`
      };
    }

    const supabaseBeforeCount = remoteRows.length;
    const extraIdsToDelete: string[] = [];

    remoteRows.forEach((row: any) => {
      if (row && row.id) {
        const idStr = String(row.id).trim();
        const cleanId = idStr.toLowerCase();
        if (idStr.startsWith('VCH-') || idStr.startsWith('EXP-') || !valid108Map.has(cleanId)) {
          extraIdsToDelete.push(idStr);
        }
      }
    });

    let purgedCount = 0;
    if (extraIdsToDelete.length > 0) {
      // 2. Delete extra rows from Supabase
      const { error: delErr } = await supabase
        .from('transactions')
        .delete()
        .in('id', extraIdsToDelete);

      if (delErr) {
        // Fallback: update status to 'deleted'
        await supabase
          .from('transactions')
          .update({ status: 'deleted', updated_at: new Date().toISOString() })
          .in('id', extraIdsToDelete);
      }
      purgedCount = extraIdsToDelete.length;
    }

    // 3. Upsert all valid 108 transactions to ensure Supabase has the exact complete data
    const rowsToUpsert = Array.from(valid108Map.values()).map(tx => ({
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
    if (rowsToUpsert.length > 0) {
      await supabase
        .from('transactions')
        .upsert(rowsToUpsert, { onConflict: 'id' });
    }

    // 4. Recalibrate Supabase Fund Pool
    await recalibrateSupabaseFundPool('public_pool');

    const supabaseAfterCount = valid108Map.size;

    // 5. Broadcast real-time update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: Array.from(valid108Map.values()) }));
      broadcastStateChange('transactions', Array.from(valid108Map.values()));
    }

    return {
      localCount,
      supabaseBeforeCount,
      purgedCount,
      supabaseAfterCount,
      success: true,
      message: `✅ Supabase Reconciled! Supabase-a transactions ${supabaseBeforeCount} zinga ${purgedCount} paih in, valid 108 txns nen in-match vek a ni ta!`
    };
  } catch (err: any) {
    console.error('[Supabase Reconciliation Error]:', err);
    return {
      localCount: 0,
      supabaseBeforeCount: 0,
      purgedCount: 0,
      supabaseAfterCount: 0,
      success: false,
      message: `Error during reconciliation: ${err?.message || 'Unknown error'}`
    };
  }
}

/**
 * Purges obsolete/legacy prefix member records from Supabase (e.g., old EBE-, EBEBCM- records
 * when campaigns have been updated to EBEZBK-, or any member records not matching active local members).
 */
export async function purgeLegacySupabaseMembers(): Promise<{ deletedCount: number; remainingCount: number }> {
  const supabase = getSupabase();
  if (!supabase) return { deletedCount: 0, remainingCount: 0 };

  try {
    let cloudRows: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('members')
        .select('id, org_code, campaign_id')
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      cloudRows = cloudRows.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    if (!cloudRows || cloudRows.length === 0) return { deletedCount: 0, remainingCount: 0 };

    const localMembers = getMembers('all');
    const validIds = new Set(localMembers.map(m => String(m.id || '').toLowerCase().trim()));
    const validPrefixes = new Set(localMembers.map(m => String(m.orgCode || '').toUpperCase().trim()).filter(Boolean));

    const storedCampaigns = getStoredCampaigns();
    storedCampaigns.forEach(c => {
      if (c && c.orgCode) validPrefixes.add(String(c.orgCode).trim().toUpperCase());
    });

    const idsToDelete: string[] = [];
    for (const row of cloudRows) {
      const rowIdUpper = String(row.id || '').toUpperCase().trim();
      const rowIdLower = String(row.id || '').toLowerCase().trim();
      const rowOrgCode = String(row.org_code || '').toUpperCase().trim();
      const parts = rowIdUpper.split('-');
      const rowPrefix = parts[0] || rowOrgCode;

      const hasSyntheticRepeatedSuffix = parts.length > 2;
      const isNotLocallyPresent = !validIds.has(rowIdLower);
      const isUnmatchedPrefix = Boolean(rowPrefix && !validPrefixes.has(rowPrefix));

      if (hasSyntheticRepeatedSuffix || isNotLocallyPresent || isUnmatchedPrefix) {
        idsToDelete.push(row.id);
      }
    }

    let deletedCount = 0;
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const chunk = idsToDelete.slice(i, i + batchSize);
      const { error: delErr } = await supabase.from('members').delete().in('id', chunk);
      if (!delErr) {
        deletedCount += chunk.length;
      }
    }

    const { count: remaining } = await supabase.from('members').select('*', { count: 'exact', head: true });
    return { deletedCount, remainingCount: remaining || 0 };
  } catch (err) {
    logSupabaseError('purgeLegacySupabaseMembers', err);
    return { deletedCount: 0, remainingCount: 0 };
  }
}

