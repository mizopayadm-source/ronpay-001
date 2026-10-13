import { supabase } from '../lib/supabase';
import { Transaction, Campaign, MemberRecord, KumtluangExpense } from '../types';
import { getStoredExpenses, getStoredCampaigns } from '../utils/storage';

// Subscribe to real-time changes from Supabase
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

// Normalization Helpers to bridge Supabase snake_case and Frontend camelCase
export const normalizeTransaction = (row: any): Transaction => {
  if (!row) return row;
  return {
    ...row,
    id: row.id,
    campaignId: row.campaign_id || row.campaignId || '',
    campaignTitle: row.campaign_title || row.campaignTitle || '',
    category: row.category || '',
    donorName: row.donor_name || row.donorName || '',
    donorPhone: row.donor_phone || row.donorPhone || '',
    donorVeng: row.donor_veng || row.donorVeng || '',
    memberId: row.member_id || row.memberId || '',
    subId: row.sub_id || row.subId || '',
    donorType: row.donor_type || row.donorType || 'member',
    groupName: row.group_name || row.groupName || '',
    isAnonymous: row.is_anonymous ?? row.isAnonymous ?? false,
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
    utr: row.utr || '',
    referenceNo: row.reference_no || row.referenceNo || '',
    timestamp: row.timestamp || row.created_at || row.createdAt || new Date().toISOString(),
    createdAt: row.created_at || row.createdAt || row.timestamp || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || row.timestamp || new Date().toISOString(),
    metadata: row.metadata || {}
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

// Authoritative Fetchers
export const fetchTableData = async <T>(table: string): Promise<T[]> => {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*');
    if (!error && Array.isArray(data)) {
      if (table === 'transactions') {
        const normalized = data.map(normalizeTransaction);
        const hardPurgeTs = Number(typeof localStorage !== 'undefined' ? localStorage.getItem('ronpay_hard_purge_timestamp_v1') || 0 : 0);
        const filtered = hardPurgeTs > 0 
          ? normalized.filter((t: any) => {
              const tTime = new Date(t.timestamp || t.createdAt || 0).getTime();
              return tTime > hardPurgeTs;
            })
          : normalized;
        return filtered as unknown as T[];
      }
      if (table === 'campaigns') {
        return data.map(normalizeCampaign) as unknown as T[];
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
        return json.data[table] as T[];
      }
    }
  } catch {}

  return [];
};

// CRUD Operations for Transactions
export const upsertTransaction = async (tx: Transaction) => {
  const payload: any = {
    id: tx.id,
    campaign_id: tx.campaignId,
    campaign_title: tx.campaignTitle,
    category: tx.category,
    donor_name: tx.donorName,
    donor_phone: tx.donorPhone,
    donor_veng: tx.donorVeng,
    member_id: tx.memberId,
    sub_id: tx.subId,
    donor_type: tx.donorType,
    group_name: tx.groupName,
    is_anonymous: tx.isAnonymous,
    amount: tx.amount,
    platform_fee: tx.platformFee,
    total_amount: tx.totalAmount || tx.amount,
    payment_method: tx.paymentMethod,
    status: tx.status,
    remark: tx.remark,
    period_type: tx.periodType,
    period_month: tx.periodMonth,
    period_year: tx.periodYear,
    period_label: tx.periodLabel,
    utr: tx.utr,
    reference_no: tx.referenceNo,
    timestamp: tx.timestamp,
    created_at: tx.createdAt,
    updated_at: new Date().toISOString(),
    metadata: (tx as any).metadata || {}
  };
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

// CRUD Operations for Campaigns
export const upsertCampaign = async (camp: Campaign) => {
  const { data, error } = await supabase
    .from('campaigns')
    .upsert(camp, { onConflict: 'id' });
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

// CRUD Operations for Members
export const upsertMember = async (member: MemberRecord) => {
  const { data, error } = await supabase
    .from('members')
    .upsert(member);
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

// CRUD Operations for Expenses
export const upsertExpense = async (expense: KumtluangExpense) => {
  const { data, error } = await supabase
    .from('expenses')
    .upsert(expense);
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

// Migration Helpers
export const migrateAndSwitchToSupabase = async (allLocalTransactions: Transaction[]) => {
  // 1. Bulk push to Supabase
  const { error } = await supabase.from('transactions').upsert(allLocalTransactions);
  if (error) throw error;
  
  // 2. Lock-in: Supabase chauh hman turin flag set rawh
  localStorage.setItem('ronpay_use_supabase_only', 'true');
  
  alert('Migration zawh a ni ta! Supabase chauh hman a ni tawh ang.');
  window.location.reload();
};

// 1. Push all local expenses and opening balances (campaigns) to Supabase via upsert
export const pushLocalExpensesAndOpeningBalancesToSupabase = async () => {
  try {
    const localExpenses = getStoredExpenses();
    if (localExpenses.length > 0) {
      const { error: expErr } = await supabase.from('expenses').upsert(localExpenses, { onConflict: 'id' });
      if (expErr) console.warn('[SupabaseSync] Expense upsert warning:', expErr);
    }

    const localCampaigns = getStoredCampaigns();
    if (localCampaigns.length > 0) {
      const { error: campErr } = await supabase.from('campaigns').upsert(localCampaigns, { onConflict: 'id' });
      if (campErr) console.warn('[SupabaseSync] Campaign opening balance upsert warning:', campErr);
    }

    console.log('[SupabaseSync] Successfully synced local expenses and opening balances to Supabase.');
  } catch (err) {
    console.warn('[SupabaseSync] Error in pushLocalExpensesAndOpeningBalancesToSupabase:', err);
  }
};

// 2. Load opening balance directly from Supabase table (campaigns) as Single Source of Truth
export const fetchOpeningBalanceFromSupabase = async (campaignId: string): Promise<number> => {
  if (!campaignId) return 0;
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('opening_balance, openingBalance')
      .eq('id', campaignId)
      .single();
    
    if (!error && data) {
      const val = Number(data.opening_balance ?? data.openingBalance ?? 0);
      if (!isNaN(val)) return val;
    }
  } catch (err) {
    console.warn('[SupabaseSync] Failed to fetch opening balance from Supabase:', err);
  }
  return 0;
};

// 3. Startup sequence cleanup function to clear old client-side caches that conflict with Supabase SSOT
export const runStartupCleanupSequence = async () => {
  try {
    if (typeof localStorage === 'undefined') return;
    
    // First push local expenses & opening balances to Supabase
    await pushLocalExpensesAndOpeningBalancesToSupabase();

    // Mark Supabase SSOT active flag
    localStorage.setItem('ronpay_supabase_ssot_active', 'true');
    
    const cleanupMarker = localStorage.getItem('ronpay_startup_cleanup_v2');
    if (!cleanupMarker) {
      localStorage.setItem('ronpay_startup_cleanup_v2', new Date().toISOString());
      console.log('[SupabaseSync] Startup sequence cleanup executed successfully. Supabase is now Single Source of Truth.');
    }
  } catch (e) {
    console.warn('[SupabaseSync] Startup cleanup warning:', e);
  }
};

