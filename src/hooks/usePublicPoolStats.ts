import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
      // Don't overwrite higher remote numbers with empty 0s
      if (fallback.totalCount > 0 || prev.totalCount === 0) {
        return fallback;
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchLiveStatsFromSupabase = async () => {
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
        // Log gracefully as a notice instead of raising unhandled console.error
        console.warn('[usePublicPoolStats] Network/offline fallback to local transaction store:', err?.message || err);
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

    // Safe Real-time subscription with unique channel name to prevent callback collision errors
    let channel: any = null;
    try {
      const uniqueChannelName = `public-transactions-${Math.random().toString(36).substring(2, 9)}`;
      channel = supabase
        .channel(uniqueChannelName)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          () => {
            if (isMounted) {
              fetchLiveStatsFromSupabase();
            }
          }
        )
        .subscribe((status: string) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[usePublicPoolStats] Supabase Realtime channel state:', status);
          }
        });
    } catch (e) {
      console.warn('[usePublicPoolStats] Could not initialize realtime channel, relying on local sync:', e);
    }

    return () => {
      isMounted = false;
      window.removeEventListener('ronpay_data_synced', handleSync);
      window.removeEventListener('ronpay_stats_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [refreshFromLocal]);

  return { stats, loading, error };
}
