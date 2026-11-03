import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseQuotaBlocked } from '../lib/supabase';
import { PublicPoolStats } from '../types';
import { getStoredTransactions } from '../utils/storage';

/**
 * Computes public pool stats from cached storage or local stored transactions.
 * Guarantees that stats are always immediately available without network blocking.
 */
function getFallbackPoolStats(): PublicPoolStats {
  try {
    const cached = localStorage.getItem('ronpay_public_pool_stats_v1');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && typeof parsed.totalAmount === 'number' && parsed.totalAmount > 0) {
        return parsed;
      }
    }
  } catch {}

  try {
    const txs = getStoredTransactions();
    let totalAmount = 0;
    let totalCount = 0;
    let todayCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);

    if (Array.isArray(txs)) {
      txs.forEach((tx: any) => {
        const s = String(tx.status || '').toLowerCase().trim();
        const isConfirmed = s === '' || s === 'completed' || s === 'paid' || s === 'verified' || s === 'success' || s === 'payment_success';
        const amt = Number(tx.amount) || Number(tx.total_amount) || 0;
        if (isConfirmed && amt > 0) {
          totalAmount += amt;
          totalCount += 1;
          const d = String(tx.timestamp || tx.createdAt || tx.date || '').slice(0, 10);
          if (d === todayStr) {
            todayCount += 1;
          }
        }
      });
    }

    return {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalCount,
      todayCount,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return {
      totalAmount: 0,
      totalCount: 0,
      todayCount: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}

/**
 * React Hook: Compute live stats directly from Supabase transactions table with safe Realtime sync
 * and seamless fallback to local transaction store.
 */
export function usePublicPoolStats(): {
  stats: PublicPoolStats;
  loading: boolean;
  error: string | null;
} {
  const [stats, setStats] = useState<PublicPoolStats>(() => getFallbackPoolStats());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFromLocal = useCallback(() => {
    const fallback = getFallbackPoolStats();
    setStats((prev) => {
      if (fallback.totalCount > 0 || prev.totalCount === 0) {
        return fallback;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Check circuit breaker first - if quota exceeded, skip network calls to prevent egress penalty
    if (isSupabaseQuotaBlocked()) {
      refreshFromLocal();
      return;
    }

    const fetchLiveStatsFromSupabase = async () => {
      if (isSupabaseQuotaBlocked()) {
        if (isMounted) refreshFromLocal();
        return;
      }

      // Check if we have recent cached stats (< 5 minutes old) to save Supabase Egress
      try {
        const cachedRaw = localStorage.getItem('ronpay_public_pool_stats_v1');
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.lastUpdated) {
            const ageMs = Date.now() - new Date(cached.lastUpdated).getTime();
            if (ageMs < 5 * 60 * 1000 && cached.totalCount > 0) {
              if (isMounted) {
                setStats(cached);
                setLoading(false);
              }
              return;
            }
          }
        }
      } catch {}

      try {
        const { data, error: supaError, count } = await supabase
          .from('transactions')
          .select('amount, timestamp, created_at, status', { count: 'exact' });

        if (supaError) {
          throw supaError;
        }

        let totalAmount = 0;
        let todayCount = 0;
        const todayStr = new Date().toISOString().slice(0, 10);

        if (data && Array.isArray(data)) {
          data.forEach((tx: any) => {
            const s = String(tx.status || '').toLowerCase().trim();
            const isConfirmed = s === '' || s === 'completed' || s === 'paid' || s === 'verified' || s === 'success' || s === 'payment_success';
            if (isConfirmed) {
              const amt = Number(tx.amount) || Number(tx.total_amount) || 0;
              totalAmount += amt;

              const txDate = (tx.timestamp || tx.created_at || '').slice(0, 10);
              if (txDate === todayStr) {
                todayCount += 1;
              }
            }
          });
        }

        if (isMounted) {
          const liveStats: PublicPoolStats = {
            totalAmount: Math.round(totalAmount * 100) / 100,
            totalCount: count !== null && count !== undefined ? count : (data ? data.length : 0),
            todayCount,
            lastUpdated: new Date().toISOString(),
          };

          setStats(liveStats);
          setError(null);
          setLoading(false);

          try {
            localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(liveStats));
          } catch {}
        }
      } catch (err: any) {
        if (isMounted) {
          const fallback = getFallbackPoolStats();
          setStats(fallback);
          setError(null);
          setLoading(false);
        }
      }
    };

    // Attempt live fetch
    fetchLiveStatsFromSupabase();

    // Listen for local and cross-tab sync events
    const handleSync = () => {
      if (isMounted) {
        refreshFromLocal();
      }
    };

    window.addEventListener('ronpay_data_synced', handleSync);
    window.addEventListener('ronpay_stats_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('ronpay_data_synced', handleSync);
      window.removeEventListener('ronpay_stats_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [refreshFromLocal]);

  return { stats, loading, error };
}
