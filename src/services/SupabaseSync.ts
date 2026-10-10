import { supabase } from '../lib/supabase';
import { Transaction, Campaign, MemberRecord, KumtluangExpense } from '../types';

// Subscribe to real-time changes from Supabase
export const subscribeToTable = (
  table: string, 
  onUpdate: (payload: any) => void
) => {
  const channelName = `${table}-sync-${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase.channel(channelName);
  channel
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      (payload) => {
        console.log(`[SupabaseSync] Change detected in ${table}:`, payload);
        onUpdate(payload);
      }
    )
    .subscribe();
  return channel;
};

// Authoritative Fetchers
export const fetchTableData = async <T>(table: string): Promise<T[]> => {
  const { data, error } = await supabase
    .from(table)
    .select('*');
  if (error) {
    console.error(`[SupabaseSync] Error fetching ${table}:`, error);
    throw error;
  }
  return data as T[];
};

// CRUD Operations for Transactions
export const upsertTransaction = async (tx: Transaction) => {
  const { data, error } = await supabase
    .from('transactions')
    .upsert(tx);
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
    .upsert(camp);
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
