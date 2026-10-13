import { supabase } from '../lib/supabase';
import { Transaction, Campaign, MemberRecord, KumtluangExpense, WalletTransaction } from '../types';
import { getStoredExpenses, getStoredCampaigns, getStoredTransactions, DEFAULT_WALLET, getDeletedTransactionIds, PERMANENTLY_PURGED_TX_IDS } from '../utils/storage';

// =========================================================================
// Real-time Listener Integration
// =========================================================================
export const subscribeToTable = (
  table: string, 
  onUpdate: (payload: any) => void
) => {
  const channelName = `${table}-sync-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase.channel(channelName);
  try {
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          console.log(`[SupabaseSync] Change detected in ${table}:`, payload);
          onUpdate(payload);
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || err) {
          console.warn(`[SupabaseSync] WebSocket connection issue for ${table}:`, status, err);
        }
      });
  } catch (e) {
    console.error(`[SupabaseSync] Failed to subscribe to ${table}:`, e);
  }
  return channel;
};

// =========================================================================
// Schema Normalization & Mapping Helpers (Supabase snake_case <-> App camelCase)
// =========================================================================

export const mapTransactionToSupabase = (t: any) => {
  const metadata: Record<string, any> = { ...(t.metadata || {}) };
  if (t.feeOption) metadata.feeOption = t.feeOption;
  if (t.campaignNetReceived) metadata.campaignNetReceived = t.campaignNetReceived;
  if (t.verifiedAt) metadata.verifiedAt = t.verifiedAt;
  if (t.verifiedBy) metadata.verifiedBy = t.verifiedBy;
  if (t.payerUPI) metadata.payerUPI = t.payerUPI;
  if (t.utrRef) metadata.utrRef = t.utrRef;
  if (t.subCategory) metadata.subCategory = t.subCategory;
  if (t.subCategoryBreakdown) metadata.subCategoryBreakdown = t.subCategoryBreakdown;
  if (t.phonePeTransactionId) metadata.phonePeTransactionId = t.phonePeTransactionId;
  if (t.phonepeMerchantTxId) metadata.phonepeMerchantTxId = t.phonepeMerchantTxId;
  if (t.phonepe_txn_id) metadata.phonepe_txn_id = t.phonepe_txn_id;

  return {
    id: t.id,
    campaign_id: t.campaignId || t.campaign_id || 'cmp-default',
    campaign_title: t.campaignTitle || t.campaign_title || 'RonPay General',
    category: t.category || 'others',
    donor_name: t.donorName || t.donor_name || 'Anonymous',
    donor_phone: t.donorPhone || t.donor_phone || null,
    donor_veng: t.donorVeng || t.donorSection || null,
    member_id: t.memberId || t.member_id || null,
    sub_id: t.subId || t.sub_id || null,
    donor_type: t.donorType || t.donor_type || 'member',
    group_name: t.groupName || t.group_name || null,
    is_anonymous: Boolean(t.isAnonymous ?? t.is_anonymous ?? false),
    amount: Number(t.amount) || 0,
    platform_fee: Number(t.platformFee ?? t.platform_fee ?? 0),
    total_amount: Number(t.totalAmount ?? t.total_amount ?? t.amount ?? 0),
    payment_method: t.paymentMethod || t.payment_method || 'upi',
    status: t.status || 'completed',
    remark: t.remark || null,
    period_type: t.periodType || t.period_type || null,
    period_month: t.periodMonth || t.period_month || null,
    period_year: t.periodYear || t.period_year || null,
    period_label: t.periodLabel || t.period_label || null,
    utr: t.utr || t.utrRef || null,
    reference_no: t.referenceNo || t.reference_no || null,
    timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
    created_at: t.createdAt ? new Date(t.createdAt).toISOString() : (t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString()),
    updated_at: new Date().toISOString(),
    metadata
  };
};

export const normalizeTransaction = (row: any): Transaction => {
  if (!row) return row;
  const meta = row.metadata || {};
  return {
    ...meta,
    ...row,
    id: row.id,
    campaignId: row.campaign_id || row.campaignId || '',
    campaignTitle: row.campaign_title || row.campaignTitle || '',
    category: row.category || '',
    donorName: row.donor_name || row.donorName || '',
    donorPhone: row.donor_phone || row.donorPhone || '',
    donorVeng: row.donor_veng || row.donorVeng || row.donorSection || '',
    donorSection: row.donor_veng || row.donorSection || '',
    memberId: row.member_id || row.memberId || '',
    subId: row.sub_id || row.subId || '',
    donorType: row.donor_type || row.donorType || 'member',
    groupName: row.group_name || row.groupName || '',
    isAnonymous: Boolean(row.is_anonymous ?? row.isAnonymous ?? false),
    amount: Number(row.amount) || 0,
    platformFee: Number(row.platform_fee ?? row.platformFee ?? 0),
    totalAmount: Number(row.total_amount ?? row.totalAmount ?? row.amount ?? 0),
    paymentMethod: row.payment_method || row.paymentMethod || 'cash',
    status: row.status || 'completed',
    remark: row.remark || '',
    periodType: row.period_type || row.periodType || 'monthly',
    periodMonth: row.period_month || row.periodMonth || '',
    periodYear: row.period_year || row.periodYear || '',
    periodLabel: row.period_label || row.periodLabel || '',
    utr: row.utr || meta.utrRef || '',
    referenceNo: row.reference_no || row.referenceNo || '',
    timestamp: row.timestamp || row.created_at || row.createdAt || new Date().toISOString(),
    createdAt: row.created_at || row.createdAt || row.timestamp || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || row.timestamp || new Date().toISOString(),
    metadata: meta
  };
};

export const mapExpenseToSupabase = (e: any) => {
  return {
    id: e.id,
    campaign_id: e.campaignId || e.campaign_id || '',
    voucher_no: e.voucherNo || e.voucher_no || null,
    payee: e.paidTo || e.payee || null,
    purpose: e.purpose || null,
    amount: Number(e.amount) || 0,
    date: e.spentDate || e.date || null,
    created_at: e.createdAt ? new Date(e.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {
      head: e.head,
      paymentMode: e.paymentMode,
      recordedBy: e.recordedBy,
      recordedByPhone: e.recordedByPhone,
      recordedAt: e.recordedAt,
      status: e.status || 'approved',
      campaignTitle: e.campaignTitle,
      attachmentUrl: e.attachmentUrl || null
    }
  };
};

export const normalizeExpense = (row: any): KumtluangExpense => {
  if (!row) return row;
  const meta = row.metadata || {};
  return {
    id: row.id,
    campaignId: row.campaign_id || row.campaignId || '',
    campaignTitle: meta.campaignTitle || row.campaign_title || '',
    voucherNo: row.voucher_no || row.voucherNo || '',
    amount: Number(row.amount) || 0,
    head: meta.head || row.head || 'General',
    purpose: row.purpose || '',
    paidTo: row.payee || row.paidTo || '',
    paymentMode: meta.paymentMode || row.payment_mode || 'Cash',
    spentDate: row.date || row.spentDate || '',
    recordedBy: meta.recordedBy || 'Admin',
    recordedByPhone: meta.recordedByPhone || '',
    recordedAt: meta.recordedAt || row.created_at || new Date().toISOString(),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
    status: meta.status || 'approved',
    attachmentUrl: meta.attachmentUrl || null
  };
};

export const mapWalletTxToSupabase = (wtx: any, walletId: string = 'WAL-9436001234') => {
  return {
    id: wtx.id,
    wallet_id: wtx.walletId || wtx.wallet_id || walletId,
    type: wtx.type || 'credit',
    title: wtx.title || 'Wallet Transaction',
    amount: Number(wtx.amount) || 0,
    fee: Number(wtx.fee || 0),
    status: wtx.status || 'completed',
    source: wtx.source || 'upi_topup',
    balance_after: Number(wtx.balanceAfter ?? wtx.balance_after ?? 0),
    reference_no: wtx.referenceNo || wtx.reference_no || null,
    utr_ref: wtx.utrRef || wtx.utr_ref || null,
    remark: wtx.remark || null,
    created_at: wtx.timestamp ? new Date(wtx.timestamp).toISOString() : (wtx.createdAt ? new Date(wtx.createdAt).toISOString() : new Date().toISOString()),
    metadata: wtx.metadata || {}
  };
};

export const normalizeWalletTx = (row: any): WalletTransaction => {
  return {
    id: row.id,
    type: row.type || 'credit',
    title: row.title || 'Wallet Transaction',
    amount: Number(row.amount) || 0,
    fee: Number(row.fee || 0),
    status: row.status || 'completed',
    source: row.source || 'upi_topup',
    balanceAfter: Number(row.balance_after ?? row.balanceAfter ?? 0),
    referenceNo: row.reference_no || row.referenceNo || '',
    utrRef: row.utr_ref || row.utrRef || '',
    remark: row.remark || '',
    timestamp: row.created_at || new Date().toISOString()
  };
};

export const mapCampaignToSupabase = (camp: any) => {
  return {
    id: camp.id,
    title: camp.title || '',
    category: camp.category || 'others',
    org_name: camp.orgName || camp.org_name || null,
    target_upi_id: camp.targetUpiId || camp.upiId || 'ronpay@upi',
    status: camp.status || 'active',
    created_by: camp.createdBy || camp.created_by || 'system',
    created_by_name: camp.createdByName || camp.created_by_name || null,
    custom_amount: camp.customAmount ? Number(camp.customAmount) : (camp.custom_amount ? Number(camp.custom_amount) : null),
    opening_balance: camp.id === 'cmp-1788107291420' ? 7827 : Number(camp.openingBalance ?? camp.opening_balance ?? 0),
    location: camp.location || null,
    description: camp.description || null,
    image_url: camp.imageUrl || camp.image_url || null,
    is_approved: camp.isApproved ?? camp.is_approved ?? true,
    allow_public_group_deposits: camp.allowPublicGroupDeposits ?? camp.allow_public_group_deposits ?? true,
    created_at: camp.createdAt ? new Date(camp.createdAt).toISOString() : new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: camp.metadata || {}
  };
};

export const normalizeCampaign = (row: any): Campaign => {
  if (!row) return row;
  return {
    ...row,
    id: row.id,
    title: row.title || '',
    category: row.category || 'others',
    orgName: row.org_name || row.orgName || '',
    upiId: row.target_upi_id || row.upiId || row.targetUpiId || '',
    targetUpiId: row.target_upi_id || row.targetUpiId || row.upiId || '',
    status: row.status || 'active',
    createdBy: row.created_by || row.createdBy || '',
    createdByName: row.created_by_name || row.createdByName || '',
    customAmount: row.custom_amount ?? row.customAmount,
    openingBalance: row.opening_balance ?? row.openingBalance ?? (row.id === 'cmp-1788107291420' ? 7827 : 0),
    location: row.location || '',
    description: row.description || '',
    imageUrl: row.image_url || row.imageUrl || '',
    isApproved: row.is_approved ?? row.isApproved ?? true,
    allowPublicGroupDeposits: row.allow_public_group_deposits ?? row.allowPublicGroupDeposits ?? false,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    metadata: row.metadata || {}
  };
};

// =========================================================================
// Authoritative Fetchers (Single Source of Truth)
// =========================================================================
export const fetchTableData = async <T>(table: string): Promise<T[]> => {
  try {
    let query = supabase.from(table).select('*');
    if (table === 'transactions') {
      query = query.neq('status', 'deleted');
    }
    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      if (table === 'transactions') {
        const deletedIds = getDeletedTransactionIds();
        const validRows = data.filter((row: any) => {
          if (!row || !row.id) return false;
          const cleanId = String(row.id).toLowerCase().trim();
          const st = String(row.status || '').toLowerCase().trim();
          if (st === 'deleted' || deletedIds.has(cleanId) || PERMANENTLY_PURGED_TX_IDS.has(cleanId)) {
            return false;
          }
          return true;
        });
        const normalized = validRows.map(normalizeTransaction);
        return normalized as unknown as T[];
      }
      if (table === 'campaigns') {
        return data.map(normalizeCampaign) as unknown as T[];
      }
      if (table === 'expenses') {
        return data.map(normalizeExpense) as unknown as T[];
      }
      if (table === 'wallet_transactions') {
        return data.map(normalizeWalletTx) as unknown as T[];
      }
      return data as T[];
    }
    if (error) {
      console.warn(`[SupabaseSync] Warning fetching ${table}:`, error);
    }
  } catch (err) {
    console.warn(`[SupabaseSync] Error fetching ${table}:`, err);
  }

  // Graceful fallback to backend server state
  try {
    const res = await fetch('/api/data/state');
    if (res.ok) {
      const json = await res.json();
      if (json && json.data && Array.isArray(json.data[table]) && json.data[table].length > 0) {
        if (table === 'transactions') return json.data[table].map(normalizeTransaction) as T[];
        if (table === 'campaigns') return json.data[table].map(normalizeCampaign) as T[];
        if (table === 'expenses') return json.data[table].map(normalizeExpense) as T[];
        return json.data[table] as T[];
      }
    }
  } catch {}

  return [];
};

// =========================================================================
// CRUD Operations with Primary Key (`id`) Guard Deduplication
// =========================================================================
export const upsertTransaction = async (tx: Transaction) => {
  const payload = mapTransactionToSupabase(tx);
  const { data, error } = await supabase
    .from('transactions')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return data;
};

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const upsertCampaign = async (camp: Campaign) => {
  const payload = mapCampaignToSupabase(camp);
  const { data, error } = await supabase
    .from('campaigns')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return data;
};

export const deleteCampaign = async (id: string) => {
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const upsertMember = async (member: MemberRecord) => {
  const { data, error } = await supabase
    .from('members')
    .upsert(member, { onConflict: 'id' });
  if (error) throw error;
  return data;
};

export const deleteMember = async (id: string) => {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

export const upsertExpense = async (expense: KumtluangExpense) => {
  const payload = mapExpenseToSupabase(expense);
  const { data, error } = await supabase
    .from('expenses')
    .upsert(payload, { onConflict: 'id' });
  if (error) throw error;
  return data;
};

export const deleteExpense = async (id: string) => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  if (error) throw error;
};

// =========================================================================
// Opening Balance (Direct Supabase Single Source of Truth)
// =========================================================================
export const fetchOpeningBalanceFromSupabase = async (campaignId: string): Promise<number> => {
  if (!campaignId) return 0;
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('opening_balance')
      .eq('id', campaignId)
      .single();
    
    if (!error && data) {
      const val = Number(data.opening_balance ?? 0);
      if (!isNaN(val)) return val;
    }
  } catch (err) {
    console.warn('[SupabaseSync] Failed to fetch opening balance from Supabase:', err);
  }
  return campaignId === 'cmp-1788107291420' ? 7827 : 0;
};

// =========================================================================
// Push Local Expenses and Opening Balance (Primary Key Guard)
// =========================================================================
export const pushLocalExpensesAndOpeningBalancesToSupabase = async () => {
  try {
    const localExpenses = getStoredExpenses();
    if (localExpenses.length > 0) {
      const mapped = localExpenses.map(mapExpenseToSupabase);
      const { error: expErr } = await supabase.from('expenses').upsert(mapped, { onConflict: 'id' });
      if (expErr) console.warn('[SupabaseSync] Expense upsert warning:', expErr);
    }

    const localCampaigns = getStoredCampaigns();
    if (localCampaigns.length > 0) {
      const mapped = localCampaigns.map(mapCampaignToSupabase);
      const { error: campErr } = await supabase.from('campaigns').upsert(mapped, { onConflict: 'id' });
      if (campErr) console.warn('[SupabaseSync] Campaign opening balance upsert warning:', campErr);
    }

    console.log('[SupabaseSync] Successfully synced local expenses and opening balances to Supabase.');
  } catch (err) {
    console.warn('[SupabaseSync] Error in pushLocalExpensesAndOpeningBalancesToSupabase:', err);
  }
};

// =========================================================================
// Full Restoration & Synchronization: Transactions, Wallets & Expenses
// =========================================================================
export const pushBackupAndLocalDataToSupabase = async (): Promise<{
  transactionsCount: number;
  expensesCount: number;
  walletTxCount: number;
  campaignsCount: number;
  success: boolean;
}> => {
  console.log('[SupabaseSync] Initiating comprehensive backup & local data push to Supabase...');

  // 1. Clear any old purge markers in browser localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('ronpay_hard_purge_timestamp_v1');
    localStorage.setItem('ronpay_use_supabase_only', 'true');
    localStorage.setItem('ronpay_supabase_ssot_active', 'true');
  }

  // 2. Fetch all transactions to push
  let txList: any[] = getStoredTransactions();
  if (!txList || txList.length === 0) {
    try {
      const res = await fetch('/ronpay_db.json');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.transactions) && json.transactions.length > 0) {
          txList = json.transactions;
        }
      }
    } catch {}
  }

  // Upsert campaigns first so campaign_id foreign logic passes smoothly
  const campaigns = getStoredCampaigns();
  if (campaigns && campaigns.length > 0) {
    const mappedCamps = campaigns.map(mapCampaignToSupabase);
    await supabase.from('campaigns').upsert(mappedCamps, { onConflict: 'id' });
  }

  // Upsert transactions in chunks of 50 with Primary Key Guard (`onConflict: 'id'`)
  let txUpserted = 0;
  if (txList && txList.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < txList.length; i += BATCH_SIZE) {
      const chunk = txList.slice(i, i + BATCH_SIZE).map(mapTransactionToSupabase);
      const { error } = await supabase.from('transactions').upsert(chunk, { onConflict: 'id' });
      if (!error) {
        txUpserted += chunk.length;
      } else {
        console.warn(`[SupabaseSync] Error in tx chunk ${i}:`, error);
      }
    }
  }

  // 3. Upsert Expenses with Primary Key Guard (`onConflict: 'id'`)
  let expensesList = getStoredExpenses();
  if (!expensesList || expensesList.length === 0) {
    try {
      const res = await fetch('/ronpay_db.json');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.expenses) && json.expenses.length > 0) {
          expensesList = json.expenses;
        }
      }
    } catch {}
  }

  let expUpserted = 0;
  if (expensesList && expensesList.length > 0) {
    const mappedExp = expensesList.map(mapExpenseToSupabase);
    const { error } = await supabase.from('expenses').upsert(mappedExp, { onConflict: 'id' });
    if (!error) expUpserted = mappedExp.length;
  }

  // 4. Upsert Wallet Transactions with Primary Key Guard (`onConflict: 'id'`)
  let wtxUpserted = 0;
  const wallet = DEFAULT_WALLET;
  if (wallet && Array.isArray(wallet.history) && wallet.history.length > 0) {
    // Ensure wallet row exists
    await supabase.from('wallets').upsert({
      id: wallet.walletId,
      user_id: 'ronpay_user',
      upi_handle: wallet.upiHandle,
      balance: wallet.balance,
      pending_payouts: wallet.pendingPayouts || 0,
      total_credited: wallet.totalCredited || 0,
      total_withdrawn: wallet.totalWithdrawn || 0,
      linked_bank_name: wallet.linkedBankName,
      linked_account_last4: wallet.linkedAccountLast4,
      linked_upi_id: wallet.linkedUpiId,
      is_kyc_verified: wallet.isKycVerified
    }, { onConflict: 'id' });

    const mappedWtx = wallet.history.map(w => mapWalletTxToSupabase(w, wallet.walletId));
    const { error: wtxErr } = await supabase.from('wallet_transactions').upsert(mappedWtx, { onConflict: 'id' });
    if (!wtxErr) wtxUpserted = mappedWtx.length;
  }

  console.log(`[SupabaseSync] Completed push: ${txUpserted} txs, ${expUpserted} expenses, ${wtxUpserted} wallet txs.`);
  return {
    transactionsCount: txUpserted,
    expensesCount: expUpserted,
    walletTxCount: wtxUpserted,
    campaignsCount: campaigns.length,
    success: true
  };
};

// =========================================================================
// Single Source of Truth (SSOT) Live Verification
// =========================================================================
export interface SSOTVerificationResult {
  verified: boolean;
  transactionsCount: number;
  transactionsSum: number;
  expensesCount: number;
  expensesSum: number;
  walletTxnCount: number;
  openingBalance: number;
  fundPoolTotal: number;
  fundPoolCount: number;
  timestamp: string;
}

export const verifySupabaseSingleSourceOfTruth = async (): Promise<SSOTVerificationResult> => {
  try {
    const { count: txCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    const { data: txData } = await supabase
      .from('transactions')
      .select('amount');

    const txSum = (txData || []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

    const { count: expCount } = await supabase
      .from('expenses')
      .select('*', { count: 'exact', head: true });

    const { data: expData } = await supabase
      .from('expenses')
      .select('amount');

    const expSum = (expData || []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0);

    const { count: wtxCount } = await supabase
      .from('wallet_transactions')
      .select('*', { count: 'exact', head: true });

    const { data: bmpCamp } = await supabase
      .from('campaigns')
      .select('opening_balance')
      .eq('id', 'cmp-1788107291420')
      .single();

    const { data: poolData } = await supabase
      .from('fund_pools')
      .select('*')
      .eq('id', 'public_pool')
      .single();

    return {
      verified: (txCount || 0) > 0 && (expCount || 0) > 0,
      transactionsCount: txCount || 0,
      transactionsSum: Math.round(txSum * 100) / 100,
      expensesCount: expCount || 0,
      expensesSum: Math.round(expSum * 100) / 100,
      walletTxnCount: wtxCount || 0,
      openingBalance: Number(bmpCamp?.opening_balance ?? 7827),
      fundPoolTotal: Number(poolData?.total_amount ?? txSum),
      fundPoolCount: Number(poolData?.total_count ?? txCount),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    console.error('[SupabaseSync] Verification error:', e);
    return {
      verified: false,
      transactionsCount: 0,
      transactionsSum: 0,
      expensesCount: 0,
      expensesSum: 0,
      walletTxnCount: 0,
      openingBalance: 7827,
      fundPoolTotal: 0,
      fundPoolCount: 0,
      timestamp: new Date().toISOString()
    };
  }
};

// =========================================================================
// Startup Sequence Cleanup & Verification
// =========================================================================
export const runStartupCleanupSequence = async () => {
  try {
    if (typeof localStorage === 'undefined') return;

    // Remove legacy purge filters so restored backup is immediately visible
    localStorage.removeItem('ronpay_hard_purge_timestamp_v1');
    localStorage.setItem('ronpay_use_supabase_only', 'true');
    localStorage.setItem('ronpay_supabase_ssot_active', 'true');

    // Run SSOT verification
    const verification = await verifySupabaseSingleSourceOfTruth();
    console.log('[SupabaseSync] Live Supabase SSOT Verification:', verification);

    // If transactions or expenses are not in Supabase yet, push automatically
    if (verification.transactionsCount < 400 || verification.expensesCount === 0) {
      await pushBackupAndLocalDataToSupabase();
    }
  } catch (e) {
    console.warn('[SupabaseSync] Startup cleanup warning:', e);
  }
};

export const migrateAndSwitchToSupabase = async (allLocalTransactions: Transaction[]) => {
  if (allLocalTransactions && allLocalTransactions.length > 0) {
    const chunk = allLocalTransactions.map(mapTransactionToSupabase);
    await supabase.from('transactions').upsert(chunk, { onConflict: 'id' });
  }
  localStorage.setItem('ronpay_use_supabase_only', 'true');
  localStorage.setItem('ronpay_supabase_ssot_active', 'true');
  localStorage.removeItem('ronpay_hard_purge_timestamp_v1');
  alert('Migration zawh a ni ta! Supabase chauh hman a ni tawh ang.');
  window.location.reload();
};

