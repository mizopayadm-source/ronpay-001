import { supabase, isSupabaseQuotaBlocked } from '../lib/supabase';
import { Transaction, KumtluangExpense, Campaign, AuditorAccessGrant } from '../types';
import {
  getStoredTransactions,
  saveStoredTransactions,
  getStoredExpenses,
  saveStoredExpenses,
  getStoredCampaigns,
  saveStoredCampaigns,
  getStoredDeletedAuditorGrantIds,
  saveStoredDeletedAuditorGrantIds,
  saveStoredAuditorGrants,
  reconcileRecordAuditorVerifications,
  reconcileExpenses,
  broadcastTabSync
} from '../utils/storage';

export interface CoAuditDeltaPayload {
  transactions?: Transaction[];
  expenses?: KumtluangExpense[];
  campaigns?: Campaign[];
  auditorGrants?: AuditorAccessGrant[];
  deletedAuditorGrantIds?: string[];
  senderTabId?: string;
  ts?: number;
}

const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let coAuditChannel: any = null;
let isSubscribed = false;
const recentFingerprints = new Map<string, number>();

function trimHeavyDataUrls<T extends Record<string, any>>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const clone: any = { ...item };
  if (typeof clone.imageUrl === 'string' && clone.imageUrl.startsWith('data:') && clone.imageUrl.length > 2000) {
    delete clone.imageUrl;
  }
  if (typeof clone.attachmentUrl === 'string' && clone.attachmentUrl.startsWith('data:') && clone.attachmentUrl.length > 2000) {
    delete clone.attachmentUrl;
  }
  if (clone.metadata && typeof clone.metadata === 'object') {
    const metaClone = { ...clone.metadata };
    if (typeof metaClone.attachmentUrl === 'string' && metaClone.attachmentUrl.startsWith('data:') && metaClone.attachmentUrl.length > 2000) {
      delete metaClone.attachmentUrl;
    }
    clone.metadata = metaClone;
  }
  return clone;
}

/**
 * Applies a compact real-time delta payload directly to localStorage and UI listeners
 * without making any Supabase REST queries (0 KB Supabase Egress).
 */
export function applyCoAuditDeltaLocally(delta: CoAuditDeltaPayload): boolean {
  if (!delta || typeof window === 'undefined') return false;
  if (delta.senderTabId && delta.senderTabId === TAB_ID) return false;

  // Deduplicate identical deltas arriving via multiple fast channels (Broadcast + SSE + postgres_changes)
  const fpKey = JSON.stringify({
    t: (delta.transactions || []).map(x => `${x?.id}:${x?.updatedAt || ''}`),
    e: (delta.expenses || []).map(x => `${x?.id}:${x?.updatedAt || ''}`),
    c: (delta.campaigns || []).map(x => `${x?.id}:${x?.updatedAt || ''}`),
    g: (delta.auditorGrants || []).map(x => `${x?.id}:${x?.updatedAt || ''}`)
  });
  const now = Date.now();
  const prevSeen = recentFingerprints.get(fpKey);
  if (prevSeen && now - prevSeen < 1200) {
    return false;
  }
  recentFingerprints.set(fpKey, now);
  if (recentFingerprints.size > 80) {
    for (const [k, t] of recentFingerprints.entries()) {
      if (now - t > 10000) recentFingerprints.delete(k);
    }
  }

  let didApply = false;

  if (Array.isArray(delta.deletedAuditorGrantIds) && delta.deletedAuditorGrantIds.length > 0) {
    saveStoredDeletedAuditorGrantIds([
      ...getStoredDeletedAuditorGrantIds(),
      ...delta.deletedAuditorGrantIds
    ]);
    didApply = true;
  }

  if (Array.isArray(delta.transactions) && delta.transactions.length > 0) {
    const localTxs = getStoredTransactions();
    const map = new Map<string, Transaction>();
    for (const lt of localTxs) {
      if (lt && lt.id) map.set(String(lt.id).toLowerCase().trim(), lt);
    }
    let txChanged = false;
    for (const dt of delta.transactions) {
      if (!dt || !dt.id) continue;
      const k = String(dt.id).toLowerCase().trim();
      const prev = map.get(k);
      if (!prev) {
        map.set(k, { ...dt, isSynced: true });
        txChanged = true;
      } else {
        const prevTime = new Date(prev.updatedAt || prev.audit_marked_at || prev.audit_date || prev.timestamp || 0).getTime();
        const deltaTime = new Date(dt.updatedAt || dt.audit_marked_at || dt.audit_date || dt.timestamp || 0).getTime();
        const base = deltaTime >= prevTime ? { ...prev, ...dt, isSynced: true } : { ...dt, ...prev, isSynced: true };
        const merged = reconcileRecordAuditorVerifications(
          deltaTime >= prevTime ? prev : dt,
          deltaTime >= prevTime ? dt : prev,
          base
        );
        map.set(k, merged);
        txChanged = true;
      }
    }
    if (txChanged) {
      const mergedList = Array.from(map.values());
      saveStoredTransactions(mergedList, true);
      try {
        window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: mergedList }));
        broadcastTabSync('transactions');
      } catch {}
      didApply = true;
    }
  }

  if (Array.isArray(delta.expenses) && delta.expenses.length > 0) {
    const localExps = getStoredExpenses();
    const mergedExps = reconcileExpenses(localExps, delta.expenses);
    saveStoredExpenses(mergedExps, true);
    try {
      window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: mergedExps }));
      broadcastTabSync('expenses');
    } catch {}
    didApply = true;
  }

  if (Array.isArray(delta.campaigns) && delta.campaigns.length > 0) {
    const localCamps = getStoredCampaigns();
    const campMap = new Map<string, Campaign>();
    for (const lc of localCamps) {
      if (lc && lc.id) campMap.set(String(lc.id).toLowerCase().trim(), lc);
    }
    let campChanged = false;
    for (const dc of delta.campaigns) {
      if (!dc || !dc.id) continue;
      const k = String(dc.id).toLowerCase().trim();
      const prev = campMap.get(k);
      if (!prev) {
        campMap.set(k, dc);
        campChanged = true;
      } else {
        const prevTime = new Date(prev.updatedAt || (prev as any).updated_at || 0).getTime();
        const deltaTime = new Date(dc.updatedAt || (dc as any).updated_at || 0).getTime();
        if (deltaTime >= prevTime) {
          campMap.set(k, {
            ...prev,
            ...dc,
            imageUrl: dc.imageUrl || prev.imageUrl
          });
          campChanged = true;
        }
      }
    }
    if (campChanged) {
      const mergedCamps = Array.from(campMap.values());
      saveStoredCampaigns(mergedCamps, true);
      try {
        window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: mergedCamps }));
        window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: mergedCamps }));
        broadcastTabSync('campaigns');
      } catch {}
      didApply = true;
    }
  }

  if (Array.isArray(delta.auditorGrants) && delta.auditorGrants.length > 0) {
    saveStoredAuditorGrants(delta.auditorGrants, true);
    didApply = true;
  }

  return didApply;
}

/**
 * Ensures the zero-egress Supabase Realtime Broadcast channel is connected
 * for sub-second Auditor 1 <-> Auditor 2 sync across any domain or browser.
 */
export function ensureCoAuditRealtimeChannel(): void {
  if (typeof window === 'undefined' || isSubscribed || isSupabaseQuotaBlocked()) return;
  try {
    isSubscribed = true;
    coAuditChannel = supabase
      .channel('ronpay-coaudit-live', {
        config: {
          broadcast: { self: false, ack: false }
        }
      })
      .on('broadcast', { event: 'audit_delta' }, (msg: any) => {
        const payload = msg?.payload as CoAuditDeltaPayload | undefined;
        if (payload) {
          applyCoAuditDeltaLocally(payload);
        }
      })
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          isSubscribed = false;
        }
      });
  } catch {
    isSubscribed = false;
  }
}

/**
 * Broadcasts an audit verification, query, sign-off, alert, or lock delta instantaneously
 * over Supabase Realtime Broadcast (WebSocket pub/sub — 0 KB PostgREST DB egress).
 */
export function broadcastCoAuditDelta(delta: CoAuditDeltaPayload): void {
  if (typeof window === 'undefined' || isSupabaseQuotaBlocked()) return;
  try {
    ensureCoAuditRealtimeChannel();
    const compactPayload: CoAuditDeltaPayload = {
      senderTabId: TAB_ID,
      ts: Date.now(),
      ...(delta.transactions?.length
        ? { transactions: delta.transactions.slice(0, 60).map(trimHeavyDataUrls) }
        : {}),
      ...(delta.expenses?.length
        ? { expenses: delta.expenses.slice(0, 60).map(trimHeavyDataUrls) }
        : {}),
      ...(delta.campaigns?.length
        ? { campaigns: delta.campaigns.slice(0, 10).map(trimHeavyDataUrls) }
        : {}),
      ...(delta.auditorGrants?.length
        ? { auditorGrants: delta.auditorGrants }
        : {}),
      ...(delta.deletedAuditorGrantIds?.length
        ? { deletedAuditorGrantIds: delta.deletedAuditorGrantIds }
        : {})
    };
    if (coAuditChannel) {
      coAuditChannel.send({
        type: 'broadcast',
        event: 'audit_delta',
        payload: compactPayload
      }).catch(() => {});
    }
  } catch {}
}
