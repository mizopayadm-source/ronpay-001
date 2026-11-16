// Legacy stub for backward compatibility after migration to Supabase
import { fetchTableData } from './SupabaseSync';
import { getStoredExpenses, saveStoredExpenses } from '../utils/storage';
import { KumtluangExpense } from '../types';

export const syncCreatorToFirestore = async (...args: any[]) => {};
export const syncPricingConfigToFirestore = async (...args: any[]) => {};
export const syncAnnouncementToFirestore = async (...args: any[]) => {};
export const recalibratePublicPoolStatsFromFirestore = async (...args: any[]) => {};
export const syncAllLocalExpensesToFirestore = async (...args: any[]) => {};
export const fetchExpensesFromFirestore = async (force: boolean = false, ..._args: any[]): Promise<KumtluangExpense[]> => {
  try {
    const fresh = await fetchTableData<KumtluangExpense>('expenses', { forceAll: true, bypassCache: Boolean(force) });
    if (Array.isArray(fresh) && fresh.length > 0) {
      saveStoredExpenses(fresh, true);
      return getStoredExpenses();
    }
  } catch {}
  return getStoredExpenses();
};
export const fetchMembersFromFirestore = async (...args: any[]): Promise<any[]> => [];
export const deleteCampaignFromFirestore = async (...args: any[]) => {};
export const syncCampaignToFirestore = async (...args: any[]) => {};
export const syncAuditLogToFirestore = async (...args: any[]) => {};
export const syncMemberToFirestore = async (...args: any[]) => {};
export const deleteMemberFromFirestore = async (...args: any[]) => {};
export const syncTransactionToFirestore = async (...args: any[]) => {};
export const syncExpenseToFirestore = async (...args: any[]) => {};
export const deleteExpenseFromFirestore = async (...args: any[]) => {};
export const initFirestoreRealtimeSync = (...args: any[]) => () => {};
export const resetCloudSessionGuards = () => {};
export type DeepAuditResult = any;

